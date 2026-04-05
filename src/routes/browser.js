/**
 * 浏览器扩展专用路由
 * 处理来自浏览器扩展的一键部署请求
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { validateRepositoryUrl } = require('../utils/validators');
const { autoDeploy } = require('../services/deploy');
const { ProjectDB, DeployLogDB } = require('../services/database');

// 浏览器扩展的部署请求队列
const browserDeployQueue = new Map();

// CORS中间件 - 允许浏览器扩展访问
router.use((req, res, next) => {
  // 允许来自localhost的所有请求（浏览器扩展）
  const origin = req.get('origin');
  if (origin && (origin.includes('chrome-extension://') || origin.includes('moz-extension://') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // 其他来源只允许localhost
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// 浏览器扩展健康检查
router.get('/health', async (req, res) => {
  try {
    // 检查数据库连接
    const dbStatus = await ProjectDB.checkConnection();
    
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: require('../../package.json').version,
      database: dbStatus ? 'connected' : 'disconnected',
      queueSize: browserDeployQueue.size,
      extensions: {
        browser: true,
        api: true
      }
    });
  } catch (error) {
    logger.error('Browser health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 浏览器扩展部署请求验证
router.post('/deploy/validate', async (req, res) => {
  try {
    const { repositoryUrl, repositoryInfo } = req.body;
    
    if (!repositoryUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少repositoryUrl参数'
      });
    }
    
    // 验证仓库URL
    const validation = validateRepositoryUrl(repositoryUrl);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }
    
    // 检查是否已经在部署队列中
    const existingDeployment = Array.from(browserDeployQueue.values()).find(
      deploy => deploy.repositoryUrl === repositoryUrl && deploy.status === 'pending'
    );
    
    if (existingDeployment) {
      return res.json({
        success: true,
        valid: true,
        message: '该仓库已在部署队列中',
        deploymentId: existingDeployment.id,
        status: 'queued'
      });
    }
    
    res.json({
      success: true,
      valid: true,
      message: '仓库URL验证通过',
      repositoryInfo: validation,
      platform: validation.platform
    });
  } catch (error) {
    logger.error('部署验证错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 处理浏览器扩展的一键部署请求
router.post('/deploy', async (req, res) => {
  let deploymentId = uuidv4();
  
  try {
    const { 
      repositoryUrl, 
      repositoryInfo, 
      action = 'deploy',
      source = 'browser-extension',
      userAgent
    } = req.body;
    
    logger.info(`收到浏览器扩展部署请求 [${deploymentId}]:`, {
      repositoryUrl,
      source,
      userAgent: userAgent?.substring(0, 100)
    });
    
    if (!repositoryUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少repositoryUrl参数',
        deploymentId
      });
    }
    
    // 验证仓库URL
    const validation = validateRepositoryUrl(repositoryUrl);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        deploymentId
      });
    }
    
    // 创建部署记录
    const deploymentRecord = {
      id: deploymentId,
      repositoryUrl,
      repositoryInfo: repositoryInfo || validation,
      action,
      source,
      userAgent,
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };
    
    // 添加到队列
    browserDeployQueue.set(deploymentId, deploymentRecord);
    
    // 立即响应，表示请求已接收
    res.json({
      success: true,
      message: '部署请求已接收，正在处理中',
      deploymentId,
      status: 'queued',
      statusUrl: `/api/browser/deployments/${deploymentId}`,
      estimatedTime: '30-60秒',
      timestamp: new Date().toISOString()
    });
    
    // 异步处理部署（不阻塞响应）
    setTimeout(async () => {
      try {
        await processBrowserDeployment(deploymentId);
      } catch (error) {
        logger.error(`处理浏览器部署失败 [${deploymentId}]:`, error);
      }
    }, 100);
    
  } catch (error) {
    logger.error('处理部署请求错误:', error);
    
    // 清理失败的部署记录
    browserDeployQueue.delete(deploymentId);
    
    res.status(500).json({
      success: false,
      error: error.message,
      deploymentId
    });
  }
});

// 获取部署状态
router.get('/deployments/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const deployment = browserDeployQueue.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: '部署记录不存在',
        deploymentId
      });
    }
    
    // 如果部署已完成，从数据库中获取详细结果
    let detailedResult = null;
    if (deployment.status === 'completed' && deployment.result?.deployId) {
      try {
        const deployLog = await DeployLogDB.getById(deployment.result.deployId);
        if (deployLog) {
          detailedResult = deployLog;
        }
      } catch (dbError) {
        logger.warn('获取部署日志详情失败:', dbError);
      }
    }
    
    res.json({
      success: true,
      deployment: {
        ...deployment,
        detailedResult
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取部署状态错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有浏览器部署记录
router.get('/deployments', async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    let deployments = Array.from(browserDeployQueue.values());
    
    // 按状态过滤
    if (status) {
      deployments = deployments.filter(d => d.status === status);
    }
    
    // 按时间排序（最新的在前）
    deployments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 限制数量
    deployments = deployments.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      count: deployments.length,
      total: browserDeployQueue.size,
      deployments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取部署列表错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 取消部署
router.post('/deployments/:deploymentId/cancel', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const deployment = browserDeployQueue.get(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: '部署记录不存在'
      });
    }
    
    if (deployment.status === 'completed' || deployment.status === 'failed') {
      return res.status(400).json({
        success: false,
        error: '部署已完成或已失败，无法取消'
      });
    }
    
    // 更新状态
    deployment.status = 'cancelled';
    deployment.cancelledAt = new Date().toISOString();
    deployment.error = '用户取消部署';
    
    // TODO: 实际取消部署过程
    
    res.json({
      success: true,
      message: '部署已取消',
      deployment
    });
  } catch (error) {
    logger.error('取消部署错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清理过期的部署记录
setInterval(() => {
  const now = new Date();
  const expirationTime = 24 * 60 * 60 * 1000; // 24小时
  
  for (const [deploymentId, deployment] of browserDeployQueue.entries()) {
    const createdAt = new Date(deployment.createdAt);
    if (now - createdAt > expirationTime) {
      browserDeployQueue.delete(deploymentId);
      logger.debug(`清理过期部署记录: ${deploymentId}`);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

// 处理浏览器部署的异步函数
async function processBrowserDeployment(deploymentId) {
  const deployment = browserDeployQueue.get(deploymentId);
  if (!deployment) {
    logger.error(`部署记录不存在: ${deploymentId}`);
    return;
  }
  
  try {
    // 更新状态为处理中
    deployment.status = 'processing';
    deployment.startedAt = new Date().toISOString();
    
    logger.info(`开始处理浏览器部署 [${deploymentId}]: ${deployment.repositoryUrl}`);
    
    // 提取仓库信息
    const repoInfo = deployment.repositoryInfo;
    const repoUrl = deployment.repositoryUrl;
    
    // 创建项目配置
    const projectConfig = {
      name: repoInfo.repo || 'browser-deployment',
      repo_url: repoUrl,
      platform: repoInfo.platform || 'github',
      owner: repoInfo.owner || 'unknown',
      repo: repoInfo.repo || 'unknown',
      source: 'browser-extension',
      auto_deploy: true,
      deploymentId
    };
    
    // 调用自动部署服务
    const deployResult = await autoDeploy(projectConfig);
    
    // 更新部署结果
    deployment.status = 'completed';
    deployment.completedAt = new Date().toISOString();
    deployment.result = {
      success: true,
      deployId: deployResult.deployId,
      projectId: deployResult.projectId,
      message: deployResult.message || '部署成功',
      details: deployResult
    };
    
    logger.info(`浏览器部署完成 [${deploymentId}]: ${deployResult.message}`);
    
    // 保存到数据库
    try {
      await DeployLogDB.create({
        deployment_id: deploymentId,
        repository_url: repoUrl,
        source: 'browser-extension',
        status: 'completed',
        result: deployment.result,
        created_at: deployment.createdAt,
        completed_at: deployment.completedAt
      });
    } catch (dbError) {
      logger.warn('保存部署日志到数据库失败:', dbError);
    }
    
  } catch (error) {
    logger.error(`处理浏览器部署失败 [${deploymentId}]:`, error);
    
    // 更新为失败状态
    deployment.status = 'failed';
    deployment.completedAt = new Date().toISOString();
    deployment.error = error.message;
    deployment.result = {
      success: false,
      error: error.message,
      stack: error.stack
    };
    
    // 保存错误日志到数据库
    try {
      await DeployLogDB.create({
        deployment_id: deploymentId,
        repository_url: deployment.repositoryUrl,
        source: 'browser-extension',
        status: 'failed',
        error: error.message,
        created_at: deployment.createdAt,
        completed_at: deployment.completedAt
      });
    } catch (dbError) {
      logger.warn('保存错误日志到数据库失败:', dbError);
    }
  }
}

module.exports = router;
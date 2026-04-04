/**
 * 部署前预检路由
 */

const express = require('express');
const router = express.Router();
const DeployPrecheck = require('../deploy-precheck');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 启动部署前预检
 * POST /api/precheck/start
 */
router.post('/start', async (req, res) => {
  try {
    const { projectId, checkItems = ['all'], forceRefresh = false } = req.body;

    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: projectId' 
      });
    }

    // 获取项目信息
    const project = await ProjectDB.getById(projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }

    // 启动预检
    const result = await DeployPrecheck.runPrecheck({
      project,
      checkItems,
      forceRefresh
    });

    res.json({
      success: true,
      data: {
        checkId: result.checkId,
        status: result.status,
        startTime: result.startTime,
        projectId: project.id,
        projectName: project.name
      }
    });

    logger.info(`预检启动成功: ${result.checkId}, 项目: ${project.name}`);

  } catch (error) {
    logger.error('启动预检失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取预检结果
 * GET /api/precheck/result/:checkId
 */
router.get('/result/:checkId', async (req, res) => {
  try {
    const { checkId } = req.params;
    const { format } = req.query;

    const result = DeployPrecheck.getResult(checkId);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: '预检结果不存在或已过期' 
      });
    }

    // 如果指定了格式，返回格式化报告
    if (format && ['json', 'markdown', 'html'].includes(format)) {
      try {
        const report = await DeployPrecheck.exportReport(result, format);
        
        if (format === 'json') {
          res.json(JSON.parse(report));
        } else if (format === 'html') {
          res.setHeader('Content-Type', 'text/html');
          res.send(report);
        } else {
          res.setHeader('Content-Type', 'text/markdown');
          res.send(report);
        }
        return;
      } catch (reportError) {
        logger.error('生成报告失败:', reportError);
      }
    }

    // 返回原始结果
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('获取预检结果失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取预检进度
 * GET /api/precheck/progress/:checkId
 */
router.get('/progress/:checkId', async (req, res) => {
  try {
    const { checkId } = req.params;

    const progress = DeployPrecheck.getProgress(checkId);
    
    if (progress.status === 'not_found') {
      return res.status(404).json({ 
        success: false, 
        error: '预检不存在或已结束' 
      });
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('获取预检进度失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取支持的检测项
 * GET /api/precheck/check-items
 */
router.get('/check-items', async (req, res) => {
  try {
    const checkItems = DeployPrecheck.getAvailableCheckItems();
    
    res.json({
      success: true,
      data: checkItems
    });

  } catch (error) {
    logger.error('获取检测项失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 清理预检缓存
 * POST /api/precheck/clear-cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const { maxAge } = req.body; // 毫秒
    
    const cleared = DeployPrecheck.clearCache(maxAge);
    
    res.json({
      success: true,
      data: {
        clearedCount: cleared,
        message: `清理了 ${cleared} 个缓存项`
      }
    });

    logger.info(`清理预检缓存: ${cleared} 个项`);

  } catch (error) {
    logger.error('清理缓存失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 批量检查多个项目
 * POST /api/precheck/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { projectIds, checkItems = ['all'] } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: projectIds (数组)' 
      });
    }

    if (projectIds.length > 10) {
      return res.status(400).json({ 
        success: false, 
        error: '批量检查最多支持10个项目' 
      });
    }

    const results = [];
    const errors = [];

    // 并行检查所有项目
    const promises = projectIds.map(async (projectId) => {
      try {
        const project = await ProjectDB.getById(projectId);
        if (!project) {
          errors.push({ projectId, error: '项目不存在' });
          return null;
        }

        const result = await DeployPrecheck.runPrecheck({
          project,
          checkItems,
          forceRefresh: true // 批量检查强制刷新
        });

        return {
          projectId,
          projectName: project.name,
          checkId: result.checkId,
          status: result.status,
          issuesCount: result.issues?.length || 0,
          overallStatus: result.overallStatus || 'unknown'
        };
      } catch (error) {
        errors.push({ projectId, error: error.message });
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    
    // 过滤掉失败的结果
    const successfulResults = batchResults.filter(r => r !== null);
    results.push(...successfulResults);

    res.json({
      success: true,
      data: {
        total: projectIds.length,
        successful: successfulResults.length,
        failed: errors.length,
        results: successfulResults,
        errors: errors.length > 0 ? errors : undefined
      }
    });

    logger.info(`批量预检完成: ${successfulResults.length}/${projectIds.length} 成功`);

  } catch (error) {
    logger.error('批量预检失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取项目历史预检记录
 * GET /api/precheck/history/:projectId
 */
router.get('/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;

    // 这里可以从数据库获取历史记录
    // 目前先返回一个空数组，实际实现时需要存储预检结果到数据库
    const history = [];

    res.json({
      success: true,
      data: {
        projectId,
        history,
        total: history.length
      }
    });

  } catch (error) {
    logger.error('获取历史记录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 导出预检报告
 * GET /api/precheck/export/:checkId
 */
router.get('/export/:checkId', async (req, res) => {
  try {
    const { checkId } = req.params;
    const { format = 'markdown' } = req.query;

    const result = DeployPrecheck.getResult(checkId);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: '预检结果不存在或已过期' 
      });
    }

    if (!['json', 'markdown', 'html'].includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: '不支持的格式，支持: json, markdown, html' 
      });
    }

    const report = await DeployPrecheck.exportReport(result, format);
    const projectName = result.projectId.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `precheck_report_${projectName}_${timestamp}`;

    // 设置响应头
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(report);
    } else if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.send(report);
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
      res.send(report);
    }

    logger.info(`导出预检报告: ${checkId}, 格式: ${format}`);

  } catch (error) {
    logger.error('导出报告失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 健康检查端点
 * GET /api/precheck/health
 */
router.get('/health', async (req, res) => {
  try {
    const activeChecks = DeployPrecheck.activeChecks?.size || 0;
    const cacheSize = DeployPrecheck.resultsCache?.size || 0;
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        activeChecks,
        cacheSize,
        detectors: DeployPrecheck.detectors?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
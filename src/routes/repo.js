/**
 * 仓库相关路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { analyzeRepository, cloneRepository, parseGitHubUrl } = require('../services/github');
const { analyzeRepo, getAvailableProviders } = require('../services/ai');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

// 简单内存限速：analyze 接口每 IP 每 10 秒最多 3 次
const analyzeRateLimit = {};
function checkRateLimit(ip) {
  const now = Date.now();
  const window = 10000; // 10s
  const max = 3;
  if (!analyzeRateLimit[ip]) analyzeRateLimit[ip] = [];
  analyzeRateLimit[ip] = analyzeRateLimit[ip].filter(t => now - t < window);
  if (analyzeRateLimit[ip].length >= max) return false;
  analyzeRateLimit[ip].push(now);
  return true;
}

/**
 * 解析仓库
 * POST /api/repo/analyze
 */
router.post('/analyze', async (req, res) => {
  // 限速检查
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试（10秒内最多3次）' });
  }

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const parsed = parseGitHubUrl(url);
    if (!parsed) return res.status(400).json({ error: '无效的 GitHub 地址，请检查格式' });

    logger.info(`Analyzing repository: ${url}`);
    const analysis = await analyzeRepository(url);

    let aiAnalysis = null, aiError = null;
    try {
      const availableProviders = getAvailableProviders();
      if (availableProviders.length > 0) {
        aiAnalysis = await analyzeRepo(analysis, availableProviders[0].key);
      } else {
        aiError = '未配置 AI 提供商。请在「AI 设置」页面添加 API Key，或在 .env 中设置 OPENAI_API_KEY / DEEPSEEK_API_KEY。';
        logger.warn(aiError);
      }
    } catch (err) {
      aiError = err.message;
      logger.warn(`AI analysis failed: ${err.message}`);
    }

    res.json({ success: true, data: { ...analysis, aiAnalysis, aiError } });
  } catch (error) {
    logger.error('Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 克隆仓库
 * POST /api/repo/clone
 */
router.post('/clone', async (req, res) => {
  try {
    const { url, name, types, packageJson, envExample } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const parsed = parseGitHubUrl(url);
    if (!parsed) return res.status(400).json({ error: '无效的 GitHub 地址' });

    const projectName = name || parsed.repo;
    const localPath = path.join(WORK_DIR, projectName);

    // 目录已存在时，检查是否已在数据库中
    if (await fs.pathExists(localPath)) {
      const existing = await ProjectDB.getByName(projectName).catch(() => null);
      if (existing) {
        logger.info(`Project already exists: ${projectName}, returning existing record`);
        return res.json({ success: true, data: existing, message: '项目已存在，使用现有记录' });
      }
      // 目录存在但数据库没有记录：重命名旧目录后重新克隆
      const backupPath = localPath + '_backup_' + Date.now();
      await fs.move(localPath, backupPath);
      logger.warn(`Directory existed without DB record, moved to: ${backupPath}`);
    }

    logger.info(`Cloning repository: ${url} to ${localPath}`);
    await cloneRepository(url, localPath);

    const project = await ProjectDB.create({
      name: projectName,
      repo_url: url,
      local_path: localPath,
      status: 'cloned',
      project_type: types?.join(','),
      config: { packageJson, envExample }
    });

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Clone error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取仓库文件内容
 * POST /api/repo/file
 */
router.post('/file', async (req, res) => {
  try {
    const { owner, repo, path: filePath } = req.body;
    if (!owner || !repo || !filePath) return res.status(400).json({ error: 'Missing required parameters' });
    const { getFileContent } = require('../services/github');
    const content = await getFileContent(owner, repo, filePath);
    res.json({ success: true, data: { content } });
  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


/**
 * 解析仓库
 * POST /api/repo/analyze
 */
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // 验证 URL
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }
    
    logger.info(`Analyzing repository: ${url}`);
    
    // 分析仓库
    const analysis = await analyzeRepository(url);
    
    // 使用 AI 生成部署指南
    let aiAnalysis = null;
    let aiError = null;
    try {
      const availableProviders = getAvailableProviders();
      if (availableProviders.length > 0) {
        aiAnalysis = await analyzeRepo(analysis, availableProviders[0].key);
      } else {
        aiError = 'No AI provider configured. Set OPENAI_API_KEY or DEEPSEEK_API_KEY in .env';
        logger.warn(aiError);
      }
    } catch (err) {
      aiError = err.message;
      logger.warn(`AI analysis failed: ${err.message}`);
    }
    
    res.json({
      success: true,
      data: {
        ...analysis,
        aiAnalysis,
        aiError
      }
    });
    
  } catch (error) {
    logger.error('Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 克隆仓库
 * POST /api/repo/clone
 */
router.post('/clone', async (req, res) => {
  try {
    const { url, name, types, packageJson, envExample } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }
    
    const projectName = name || parsed.repo;
    const localPath = path.join(WORK_DIR, projectName);
    
    logger.info(`Cloning repository: ${url} to ${localPath}`);
    
    // 克隆仓库
    await cloneRepository(url, localPath);
    
    // 保存到数据库
    const project = await ProjectDB.create({
      name: projectName,
      repo_url: url,
      local_path: localPath,
      status: 'cloned',
      project_type: types?.join(','),
      config: {
        packageJson,
        envExample
      }
    });
    
    res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error('Clone error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取仓库文件内容
 * POST /api/repo/file
 */
router.post('/file', async (req, res) => {
  try {
    const { owner, repo, path: filePath } = req.body;
    
    if (!owner || !repo || !filePath) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const { getFileContent } = require('../services/github');
    const content = await getFileContent(owner, repo, filePath);
    
    res.json({
      success: true,
      data: { content }
    });
    
  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

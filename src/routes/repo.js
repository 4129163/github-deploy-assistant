/**
 * 仓库相关路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { analyzeRepository, cloneRepository, parseGitHubUrl, getLocalProjectInfo } = require('../services/github');
const { analyzeRepo, getAvailableProviders } = require('../services/ai');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');
const { checkGitHubNetwork } = require('../services/network-checker');
const { getBestCloneStrategy } = require('../services/clone-optimizer');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(WORK_DIR, '_uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB 限制
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.zip') || file.originalname.endsWith('.tar.gz') || file.originalname.endsWith('.tar')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 zip/tar.gz/tar 格式的压缩包'));
    }
  }
});

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
 * 检测 GitHub 网络状态
 * GET /api/repo/network-check
 */
router.get('/network-check', async (req, res) => {
  try {
    const networkStatus = await checkGitHubNetwork();
    res.json({ success: true, data: networkStatus });
  } catch (error) {
    logger.error('Network check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 手动上传项目压缩包
 * POST /api/repo/upload
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { name, types } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: '请上传项目压缩包' });
    }

    const fileName = req.file.originalname;
    const projectName = name || fileName.replace(/\.(zip|tar\.gz|tar)$/, '');
    const uploadPath = req.file.path;
    const targetPath = path.join(WORK_DIR, projectName);

    // 确保目标目录不存在
    if (await fs.pathExists(targetPath)) {
      const backupPath = targetPath + '_backup_' + Date.now();
      await fs.move(targetPath, backupPath);
    }
    await fs.ensureDir(targetPath);

    // 解压文件
    logger.info(`Extracting ${uploadPath} to ${targetPath}`);
    const { safeExec } = require('../utils/security');
    let extractCmd = '';
    
    if (fileName.endsWith('.zip')) {
      extractCmd = `unzip -o "${uploadPath}" -d "${targetPath}"`;
    } else if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tar')) {
      extractCmd = `tar -xf "${uploadPath}" -C "${targetPath}"`;
    }

    // 验证解压命令是否安全
    const { validateCommand } = require('../utils/security');
    const validation = validateCommand(extractCmd);
    if (!validation.safe) {
      throw new Error(`解压命令安全检查失败: ${validation.reason}`);
    }

    const result = await safeExec(extractCmd);
    if (!result.success) {
      logger.error(`Extract error: ${result.stderr}`);
      throw new Error('压缩包解压失败，请检查文件格式是否正确');
    }

    // 清理上传的压缩包
    await fs.remove(uploadPath);

    // 检查解压后的目录结构，如果只有一个子目录，把内容移出来
    const files = await fs.readdir(targetPath);
    if (files.length === 1) {
      const subDir = path.join(targetPath, files[0]);
      const stat = await fs.stat(subDir);
      if (stat.isDirectory()) {
        const subFiles = await fs.readdir(subDir);
        for (const f of subFiles) {
          await fs.move(path.join(subDir, f), path.join(targetPath, f));
        }
        await fs.remove(subDir);
      }
    }

    // 分析本地项目
    const localInfo = await getLocalProjectInfo(targetPath);
    if (!localInfo) {
      return res.status(500).json({ error: '项目分析失败' });
    }

    // 保存到数据库
    const project = await ProjectDB.create({
      name: projectName,
      repo_url: 'manual-upload',
      local_path: targetPath,
      status: 'cloned',
      project_type: types?.join(',') || localInfo.types?.join(','),
      config: {
        packageJson: localInfo.packageJson,
        isManualUpload: true
      }
    });

    res.json({ 
      success: true, 
      data: project,
      message: '项目上传成功，可继续部署' 
    });

  } catch (error) {
    logger.error('Upload error:', error);
    // 清理临时文件
    if (req.file?.path) {
      try { await fs.remove(req.file.path); } catch (_) {}
    }
    res.status(500).json({ error: error.message });
  }
});

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

    // 先检测网络状态
    const networkStatus = await checkGitHubNetwork();
    
    // 网络完全不通的情况
    if (networkStatus.quality === 'unreachable') {
      return res.status(200).json({ 
        success: true, 
        data: {
          networkStatus,
          manualUploadAvailable: true,
          hint: '当前网络无法访问 GitHub API，建议选择手动上传项目压缩包，或检查网络后重试。'
        }
      });
    }

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

    res.json({ success: true, data: { ...analysis, networkStatus, aiAnalysis, aiError } });
  } catch (error) {
    logger.error('Analyze error:', error);
    // 如果分析失败，检查是否是网络问题
    const networkStatus = await checkGitHubNetwork();
    if (networkStatus.quality !== 'smooth') {
      return res.status(200).json({ 
        success: true, 
        data: {
          networkStatus,
          manualUploadAvailable: true,
          hint: 'GitHub 访问失败，建议选择手动上传项目压缩包，或检查网络后重试。'
        }
      });
    }
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

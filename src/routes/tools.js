/**
 * 批量备份与精细化管理路由
 */

const express = require('express');
const router = express.Router();
const { batchBackupUserRepos } = require('../services/clone-optimizer');
const { partialCloneRepository } = require('../services/github');
const { logger } = require('../utils/logger');

/**
 * 批量备份用户所有仓库
 * POST /api/tools/backup-user
 */
router.post('/backup-user', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: '请输入 GitHub 用户名' });
    const repos = await batchBackupUserRepos(username);
    res.json({ success: true, message: `已找到 ${repos.length} 个项目，正在后台依次备份...`, data: repos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 精细化下载 (仅下载子目录)
 * POST /api/tools/partial-clone
 */
router.post('/partial-clone', async (req, res) => {
  try {
    const { url, subDir, targetName } = req.body;
    const targetPath = require('path').join(require('../config').WORK_DIR, targetName || 'partial-project');
    await partialCloneRepository(url, targetPath, subDir);
    res.json({ success: true, message: `已成功精细化下载子目录: ${subDir}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
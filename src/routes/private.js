/**
 * 私有仓库路由（功能40）
 *
 * POST   /api/private/tokens           — 保存访问令牌
 * GET    /api/private/tokens           — 列出令牌（脱敏）
 * DELETE /api/private/tokens/:tokenId  — 删除令牌
 * POST   /api/private/tokens/:tokenId/validate — 验证令牌有效性
 * POST   /api/private/clone            — 克隆私有仓库
 */

const express = require('express');
const router = express.Router();
const { saveToken, listTokens, deleteToken, clonePrivateRepo, validateToken } = require('../services/private-repo');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');
const path = require('path');

/**
 * 保存访问令牌
 * POST /api/private/tokens
 * body: { name, token, provider }
 */
router.post('/tokens', async (req, res) => {
  try {
    const { name, token, provider } = req.body;
    if (!name || !token) return res.status(400).json({ error: '缺少 name 或 token' });
    const result = await saveToken(name, token, provider || 'github');
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Save token error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 列出所有令牌（脱敏）
 */
router.get('/tokens', (req, res) => {
  try {
    res.json({ success: true, data: listTokens() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 删除令牌
 */
router.delete('/tokens/:tokenId', async (req, res) => {
  try {
    await deleteToken(req.params.tokenId);
    res.json({ success: true, message: '令牌已删除' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * 验证令牌
 */
router.post('/tokens/:tokenId/validate', async (req, res) => {
  try {
    const result = await validateToken(req.params.tokenId);
    res.json({ success: result.valid, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 克隆私有仓库
 * POST /api/private/clone
 * body: { repoUrl, tokenId, name?, types? }
 */
router.post('/clone', async (req, res) => {
  try {
    const { repoUrl, tokenId, name, types } = req.body;
    if (!repoUrl || !tokenId) {
      return res.status(400).json({ error: '缺少 repoUrl 或 tokenId' });
    }

    const logs = [];
    const onLog = (msg) => logs.push(msg);

    const localPath = await clonePrivateRepo(repoUrl, tokenId, name, onLog);
    const projectName = name || repoUrl.split('/').pop().replace(/\.git$/, '');

    // 保存到数据库，记录使用的 tokenId（供远程部署时注入认证）
    const project = await ProjectDB.create({
      name: projectName,
      repo_url: repoUrl,
      local_path: localPath,
      status: 'cloned',
      project_type: types?.join(',') || '',
      config: { privateRepo: true, tokenId },
    });

    res.json({
      success: true,
      data: {
        project,
        localPath,
        logs,
      },
    });
  } catch (err) {
    logger.error('Private clone error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

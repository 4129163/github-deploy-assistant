/**
 * 部署记录分享路由
 * 功能19：一键分享部署记录
 *
 * GET  /api/share/view/:token        — 公开查看分享（无需认证）
 * POST /api/share/create/:projectId  — 创建分享链接
 * GET  /api/share/list/:projectId    — 列出项目的分享
 * DELETE /api/share/:token           — 删除分享
 */

const express = require('express');
const router = express.Router();
const { createShare, getShare, listSharesByProject, deleteShare } = require('../services/share');
const { logger } = require('../utils/logger');

/**
 * 创建分享链接
 * POST /api/share/create/:projectId
 * body: { logId?, expireHours?, includeConfig?, includeSteps? }
 */
router.post('/create/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { logId = null, expireHours = 72, includeConfig = true, includeSteps = true } = req.body;

    const shareData = await createShare(projectId, logId, { expireHours, includeConfig, includeSteps });

    const host = req.get('host') || 'localhost:3456';
    const protocol = req.secure ? 'https' : 'http';
    const shareUrl = `${protocol}://${host}/api/share/view/${shareData.token}`;
    const pageUrl = `${protocol}://${host}/#share-${shareData.token}`;

    res.json({
      success: true,
      data: {
        token: shareData.token,
        shareUrl,
        pageUrl,
        expireAt: shareData.expireAt,
        expireHours,
        project: shareData.project,
      },
    });
  } catch (err) {
    logger.error('Create share error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 公开查看分享（返回 JSON 供前端渲染）
 * GET /api/share/view/:token
 */
router.get('/view/:token', (req, res) => {
  try {
    const share = getShare(req.params.token);
    if (!share) {
      return res.status(404).json({ error: '分享链接不存在或已过期' });
    }
    res.json({ success: true, data: share });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 列出项目的所有分享
 * GET /api/share/list/:projectId
 */
router.get('/list/:projectId', (req, res) => {
  try {
    const list = listSharesByProject(req.params.projectId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 删除分享
 * DELETE /api/share/:token
 */
router.delete('/:token', async (req, res) => {
  try {
    await deleteShare(req.params.token);
    res.json({ success: true, message: '分享已删除' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;

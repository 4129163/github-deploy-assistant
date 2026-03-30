/**
 * 国内网络优化路由
 * GET  /api/network-opt/status   — 查看当前镜像配置
 * POST /api/network-opt/apply    — 一键自动优化（选最快镜像）
 * POST /api/network-opt/npm      — 手动设置 npm registry
 * POST /api/network-opt/pip      — 手动设置 pip mirror
 * GET  /api/network-opt/mirrors  — 列出所有可用镜像（含延迟测试）
 */

const express = require('express');
const router = express.Router();
const {
  getOptimizationStatus, applyOptimization,
  autoSelectNpmRegistry, autoSelectPipMirror,
  setNpmRegistry, setPipMirror, CN_MIRRORS,
} = require('../services/network-optimizer');
const { logger } = require('../utils/logger');

router.get('/status', async (req, res) => {
  try {
    const status = await getOptimizationStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const logs = [];
    const result = await applyOptimization((msg) => {
      logs.push(msg);
      if (global.broadcastLog) global.broadcastLog('system', msg);
    });
    res.json({ success: true, data: { result, logs } });
  } catch (err) {
    logger.error('Network optimize error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/npm', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '缺少 url' });
  try {
    await setNpmRegistry(url);
    res.json({ success: true, message: `npm registry 已设置为 ${url}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/pip', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '缺少 url' });
  try {
    await setPipMirror(url);
    res.json({ success: true, message: `pip mirror 已设置为 ${url}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mirrors', async (req, res) => {
  try {
    const [npm, pip] = await Promise.all([
      autoSelectNpmRegistry(),
      autoSelectPipMirror(),
    ]);
    res.json({ success: true, data: { npm, pip, github: CN_MIRRORS.github } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

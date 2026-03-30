/**
 * 环境检测与安装路由
 * GET  /api/env/detect          — 全量扫描所有工具
 * POST /api/env/detect-project  — 按项目类型检测所需环境
 * POST /api/env/install         — 自动安装指定工具
 */

const express = require('express');
const router = express.Router();
const { detectAll, detectForProject, installTool } = require('../services/env-detector');
const { logger } = require('../utils/logger');

// 全量检测
router.get('/detect', async (req, res) => {
  try {
    const result = await detectAll();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Env detect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 按项目类型检测
router.post('/detect-project', async (req, res) => {
  try {
    const { types = [] } = req.body;
    const result = await detectForProject(types);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 安装工具
router.post('/install', async (req, res) => {
  const { tool_id } = req.body;
  if (!tool_id) return res.status(400).json({ error: '缺少 tool_id' });

  // 白名单检查：只允许安装预定义工具
  const { INSTALL_GUIDES } = require('../services/env-detector');
  if (!INSTALL_GUIDES[tool_id]) {
    return res.status(403).json({ error: `不支持安装: ${tool_id}` });
  }

  try {
    if (global.broadcastLog) global.broadcastLog('env', `🔧 正在安装 ${tool_id}...`);
    const result = await installTool(tool_id);
    if (global.broadcastLog) global.broadcastLog('env', result.message);
    res.json({ success: result.success, data: result });
  } catch (err) {
    logger.error('Env install error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

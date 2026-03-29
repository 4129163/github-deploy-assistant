/**
 * 配置相关路由
 */

const express = require('express');
const router = express.Router();
const { ConfigDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 获取配置
 * GET /api/config/:key
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    // 屏蔽敏感配置的读取
    const SENSITIVE = ['custom_ai_providers', 'api_key', 'token', 'secret'];
    if (SENSITIVE.some(s => key.toLowerCase().includes(s))) {
      return res.status(403).json({ error: '此配置项不允许通过 API 读取' });
    }
    const value = await ConfigDB.get(key);
    res.json({
      success: true,
      data: { key, value }
    });
    
  } catch (error) {
    logger.error('Get config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 设置配置
 * POST /api/config/:key
 */
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await ConfigDB.set(key, value);
    
    res.json({
      success: true,
      message: 'Config saved'
    });
    
  } catch (error) {
    logger.error('Set config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有配置
 * GET /api/config
 */
router.get('/', async (req, res) => {
  try {
    // 返回当前环境配置（隐藏敏感信息）
    const config = {
      port: process.env.PORT || 3456,
      workDir: require('../config').WORK_DIR,
      allowAutoExec: process.env.ALLOW_AUTO_EXEC !== 'false',
      logLevel: process.env.LOG_LEVEL || 'info',
      ai: {
        openai: { configured: !!process.env.OPENAI_API_KEY },
        deepseek: { configured: !!process.env.DEEPSEEK_API_KEY },
        gemini: { configured: !!process.env.GEMINI_API_KEY },
        claude: { configured: !!process.env.CLAUDE_API_KEY }
      }
    };
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    logger.error('Get all config error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

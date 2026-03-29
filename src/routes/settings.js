/**
 * 系统设置路由（.env 编辑、健康检查配置等）
 */
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

const ENV_FILE = path.join(__dirname, '../../.env');
const ENV_EXAMPLE = path.join(__dirname, '../../.env.example');

// 敏感字段不允许通过 API 读取值（只能写入）
const SENSITIVE_KEYS = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD'];

function isSensitive(key) {
  return SENSITIVE_KEYS.some(k => key.toUpperCase().includes(k));
}

/**
 * 读取当前 .env 配置（敏感值脱敏）
 * GET /api/settings/env
 */
router.get('/env', async (req, res) => {
  try {
    let content = '';
    if (await fs.pathExists(ENV_FILE)) {
      content = await fs.readFile(ENV_FILE, 'utf8');
    } else if (await fs.pathExists(ENV_EXAMPLE)) {
      content = await fs.readFile(ENV_EXAMPLE, 'utf8');
    }

    // 解析为 key-value，敏感值脱敏
    const lines = content.split('\n');
    const parsed = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return { type: 'comment', raw: line };
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return { type: 'raw', raw: line };
      const key = match[1].trim();
      const value = match[2].trim();
      const sensitive = isSensitive(key);
      return {
        type: 'kv',
        key,
        value: sensitive ? (value ? '••••••••' : '') : value,
        hasValue: !!value,
        sensitive
      };
    });

    res.json({ success: true, data: { lines: parsed, hasFile: await fs.pathExists(ENV_FILE) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 更新 .env 中的特定 key
 * POST /api/settings/env
 * body: { key, value }
 */
router.post('/env', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: '缺少 key' });
    // 禁止注入换行
    if (String(key).includes('\n') || String(value).includes('\n')) {
      return res.status(400).json({ error: '非法字符' });
    }

    let content = '';
    if (await fs.pathExists(ENV_FILE)) {
      content = await fs.readFile(ENV_FILE, 'utf8');
    } else if (await fs.pathExists(ENV_EXAMPLE)) {
      content = await fs.readFile(ENV_EXAMPLE, 'utf8');
    }

    const lines = content.split('\n');
    const keyPattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=`);
    let found = false;
    const updated = lines.map(line => {
      if (keyPattern.test(line.trim())) { found = true; return `${key}=${value}`; }
      return line;
    });
    if (!found) updated.push(`${key}=${value}`);

    await fs.writeFile(ENV_FILE, updated.join('\n'), 'utf8');
    // 立即更新 process.env
    process.env[key] = String(value);
    logger.info(`Env updated: ${key}=${isSensitive(key) ? '***' : value}`);
    res.json({ success: true, message: `${key} 已更新` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

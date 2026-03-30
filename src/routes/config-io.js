/**
 * 配置导入/导出路由
 * GET  /api/config/export           — 下载导出 JSON
 * GET  /api/config/export/data      — 返回导出数据（JSON）
 * POST /api/config/import/preview   — 预览导入（不写库）
 * POST /api/config/import           — 执行导入
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { exportConfig, exportToFile, importConfig } = require('../services/config-io');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// 下载导出文件
router.get('/export', async (req, res) => {
  try {
    const data = await exportConfig();
    const filename = `gada-config-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 返回导出数据（不触发下载）
router.get('/export/data', async (req, res) => {
  try {
    const data = await exportConfig();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 预览导入
router.post('/import/preview', upload.single('file'), async (req, res) => {
  try {
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (req.body.data) {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ error: '请上传文件或提供数据' });
    }
    const preview = await importConfig(data, 'preview');
    res.json({ success: true, data: preview });
  } catch (err) {
    res.status(400).json({ error: '解析失败: ' + err.message });
  }
});

// 执行导入
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    let data;
    if (req.file) {
      data = JSON.parse(req.file.buffer.toString('utf8'));
    } else if (req.body.data) {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else {
      return res.status(400).json({ error: '请上传文件或提供数据' });
    }
    const conflict = req.body.conflict || req.query.conflict || 'skip';
    const result = await importConfig(data, 'import', conflict);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Import error:', err);
    res.status(400).json({ error: '导入失败: ' + err.message });
  }
});

module.exports = router;

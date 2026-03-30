/**
 * 设备扫描路由
 * GET  /api/device/scan          — 全身扫描（不含网速）
 * GET  /api/device/scan?speed=1  — 全身扫描 + 网速测试
 * GET  /api/device/speedtest     — 单独测速
 */

const express = require('express');
const router = express.Router();
const { runDeviceScan, runSpeedTestOnly } = require('../services/device-scan');
const { logger } = require('../utils/logger');

router.get('/scan', async (req, res) => {
  try {
    const includeSpeed = req.query.speed === '1';
    const result = await runDeviceScan(includeSpeed);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Device scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/speedtest', async (req, res) => {
  try {
    const result = await runSpeedTestOnly();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

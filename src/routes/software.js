/**
 * 软件扫描与卸载路由
 * GET  /api/software/scan         — 全量扫描
 * POST /api/software/uninstall    — 卸载指定软件
 * POST /api/software/self-uninstall — GADA 自卸载
 */

const express = require('express');
const router = express.Router();
const { runSoftwareScan, uninstallSoftware, selfUninstall } = require('../services/software-scanner');
const { logger } = require('../utils/logger');

// 全量扫描
router.get('/scan', async (req, res) => {
  try {
    const result = await runSoftwareScan();
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Software scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 卸载软件
router.post('/uninstall', async (req, res) => {
  const { manager, name, apt_package, uninstall_cmd } = req.body;
  if (!name || !manager) return res.status(400).json({ error: '缺少 name 或 manager' });
  // 安全检查：禁止卸载关键系统包
  const PROTECTED = ['bash', 'libc6', 'coreutils', 'systemd', 'linux-base', 'apt', 'dpkg', 'sudo', 'openssh-server', 'ssh'];
  if (PROTECTED.includes(name)) {
    return res.status(403).json({ error: `「${name}」是系统关键组件，禁止卸载` });
  }
  try {
    const result = await uninstallSoftware({ manager, name, apt_package, uninstall_cmd });
    // 推送日志到前端
    if (global.broadcastLog) {
      result.steps.forEach(s => global.broadcastLog('software', s));
    }
    res.json({ success: result.success, data: result });
  } catch (err) {
    logger.error('Uninstall error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GADA 自卸载
router.post('/self-uninstall', async (req, res) => {
  const { keep_data = false } = req.body;
  try {
    const result = await selfUninstall({ keep_data });
    res.json({ success: true, data: result });
    // 延迟退出进程
    setTimeout(() => {
      logger.info('GADA self-uninstall complete, exiting...');
      process.exit(0);
    }, 3000);
  } catch (err) {
    logger.error('Self-uninstall error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

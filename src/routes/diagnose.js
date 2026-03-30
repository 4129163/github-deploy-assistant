/**
 * 网络检测 + AI Key 检测 + 代码风险扫描路由
 * GET  /api/diagnose/network       — 检测网络连通性
 * GET  /api/diagnose/ai            — 检测所有 AI 提供商 Key
 * POST /api/diagnose/risk/:projectId — 扫描项目代码风险
 * GET  /api/diagnose/preflight     — 部署前综合检测（网络+AI）
 */

const express = require('express');
const router = express.Router();
const { checkNetworkConnectivity, checkAllAIProviders } = require('../services/network-checker');
const { scanProject } = require('../services/risk-scanner');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

// 网络检测
router.get('/network', async (req, res) => {
  try {
    const result = await checkNetworkConnectivity();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Key 检测
router.get('/ai', async (req, res) => {
  try {
    const result = await checkAllAIProviders();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 代码风险扫描
router.post('/risk/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.local_path) return res.status(400).json({ error: '项目尚未克隆' });
    logger.info(`Risk scan for project: ${project.name}`);
    const result = await scanProject(project.local_path);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Risk scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 风险扫描（by local_path，部署前使用）
router.post('/risk-path', async (req, res) => {
  try {
    const { local_path } = req.body;
    if (!local_path) return res.status(400).json({ error: '缺少 local_path' });
    const result = await scanProject(local_path);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 部署前综合检测
router.get('/preflight', async (req, res) => {
  try {
    const [network, ai] = await Promise.all([
      checkNetworkConnectivity(),
      checkAllAIProviders(),
    ]);
    const ready = network.critical_ok && ai.any_ok;
    const issues = [];
    if (!network.critical_ok) issues.push(`网络问题: ${network.critical_failed.join('、')} 无法访问`);
    if (!ai.any_ok) issues.push('AI Key: 没有可用的 AI 提供商，AI 功能将不可用');
    res.json({
      success: true,
      data: {
        ready,
        issues,
        network: { critical_ok: network.critical_ok, suggestions: network.suggestions },
        ai: { any_ok: ai.any_ok, configured: ai.results.filter(r => r.configured).length },
        suggestions: [...network.suggestions, ...issues],
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

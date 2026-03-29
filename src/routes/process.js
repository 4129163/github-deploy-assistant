/**
 * 进程管理路由
 */

const express = require('express');
const router = express.Router();
const { startProject, stopProject, restartProject, getProcessStatus, getAllProcesses } = require('../services/process-manager');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 获取所有运行中进程
 * GET /api/process
 */
router.get('/', (req, res) => {
  res.json({ success: true, data: getAllProcesses() });
});

/**
 * 获取单个项目进程状态
 * GET /api/process/:projectId
 */
router.get('/:projectId', (req, res) => {
  const status = getProcessStatus(req.params.projectId);
  res.json({ success: true, data: status });
});

/**
 * 启动项目
 * POST /api/process/:projectId/start
 */
router.post('/:projectId/start', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const result = await startProject(project);
    await ProjectDB.update(project.id, { status: 'running' });
    res.json({ success: true, data: result, message: `项目已启动，端口: ${result.port}` });
  } catch (err) {
    logger.error('Start project error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 停止项目
 * POST /api/process/:projectId/stop
 */
router.post('/:projectId/stop', async (req, res) => {
  try {
    await stopProject(req.params.projectId);
    await ProjectDB.update(req.params.projectId, { status: 'stopped' });
    res.json({ success: true, message: '项目已停止' });
  } catch (err) {
    logger.error('Stop project error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 重启项目
 * POST /api/process/:projectId/restart
 */
router.post('/:projectId/restart', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const result = await restartProject(project);
    res.json({ success: true, data: result, message: `项目已重启，端口: ${result.port}` });
  } catch (err) {
    logger.error('Restart project error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

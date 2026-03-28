/**
 * 部署相关路由
 */

const express = require('express');
const router = express.Router();
const { autoDeploy, generateManualGuide } = require('../services/deploy');
const { ProjectDB, DeployLogDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 自动生成部署指南
 * GET /api/deploy/guide/:projectId
 */
router.get('/guide/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await ProjectDB.getById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 解析类型
    project.types = project.project_type ? project.project_type.split(',') : [];
    
    const guide = await generateManualGuide(project);
    
    res.json({
      success: true,
      data: { guide, mode: 'manual' }
    });
    
  } catch (error) {
    logger.error('Generate guide error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 自动部署
 * POST /api/deploy/auto/:projectId
 */
router.post('/auto/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await ProjectDB.getById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 解析类型
    project.types = project.project_type ? project.project_type.split(',') : [];
    
    logger.info(`Starting auto deploy for project: ${project.name}`);
    
    const outputs = [];
    
    const result = await autoDeploy(project, (progress) => {
      outputs.push(progress);
    });
    
    // 更新项目状态
    await ProjectDB.update(projectId, { status: result.success ? 'deployed' : 'failed' });
    
    res.json({
      success: result.success,
      data: { outputs }
    });
    
  } catch (error) {
    logger.error('Auto deploy error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取部署日志
 * GET /api/deploy/logs/:projectId
 */
router.get('/logs/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const logs = await DeployLogDB.getByProjectId(projectId);
    
    res.json({
      success: true,
      data: logs
    });
    
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

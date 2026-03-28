/**
 * 项目相关路由
 */

const express = require('express');
const router = express.Router();
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 获取所有项目
 * GET /api/project/list
 */
router.get('/list', async (req, res) => {
  try {
    const projects = await ProjectDB.getAll();
    
    res.json({
      success: true,
      data: projects
    });
    
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取单个项目
 * GET /api/project/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await ProjectDB.getById(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新项目
 * PUT /api/project/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    await ProjectDB.update(id, updates);
    
    const project = await ProjectDB.getById(id);
    
    res.json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除项目
 * DELETE /api/project/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await ProjectDB.delete(id);
    
    res.json({
      success: true,
      message: 'Project deleted'
    });
    
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

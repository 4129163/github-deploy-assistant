/**
 * 部署相关路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { autoDeploy, generateManualGuide } = require('../services/deploy');
const { ProjectDB, DeployLogDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

/**
 * 自动生成部署指南
 * GET /api/deploy/guide/:projectId
 */
router.get('/guide/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.types = project.project_type ? project.project_type.split(',') : [];
    const guide = await generateManualGuide(project);
    res.json({ success: true, data: { guide, mode: 'manual' } });
  } catch (error) {
    logger.error('Generate guide error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 自动部署（带 WebSocket 实时日志）
 * POST /api/deploy/auto/:projectId
 */
router.post('/auto/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.types = project.project_type ? project.project_type.split(',') : [];

    logger.info(`Starting auto deploy for project: ${project.name}`);

    // 部署前备份
    await backupProject(project);

    const outputs = [];
    const result = await autoDeploy(project, (progress) => {
      outputs.push(progress);
      // 实时推送到 WebSocket
      if (global.broadcastLog) {
        global.broadcastLog(projectId, progress.message || JSON.stringify(progress));
      }
    });

    await ProjectDB.update(projectId, { status: result.success ? 'deployed' : 'failed' });

    // 广播部署完成事件
    if (global.broadcast) {
      global.broadcast('deploy_done', { projectId, success: result.success });
    }

    res.json({ success: result.success, data: { outputs } });
  } catch (error) {
    logger.error('Auto deploy error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 部署前备份项目目录
 */
async function backupProject(project) {
  try {
    if (!project.local_path || !await fs.pathExists(project.local_path)) return;
    const backupDir = path.join(WORK_DIR, '.backups');
    await fs.ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${project.name}-${timestamp}.tar.gz`;
    const backupPath = path.join(backupDir, backupName);
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(`tar -czf "${backupPath}" -C "${path.dirname(project.local_path)}" "${path.basename(project.local_path)}" 2>/dev/null`,
        (err) => err ? reject(err) : resolve());
    });
    logger.info(`Backup created: ${backupName}`);
    return backupPath;
  } catch (err) {
    logger.warn(`Backup failed (non-fatal): ${err.message}`);
  }
}

/**
 * 获取备份列表
 * GET /api/deploy/backups/:projectName
 */
router.get('/backups/:projectName', async (req, res) => {
  try {
    const backupDir = path.join(WORK_DIR, '.backups');
    await fs.ensureDir(backupDir);
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith(req.params.projectName + '-') && f.endsWith('.tar.gz'))
      .sort()
      .reverse()
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: f.replace(req.params.projectName + '-', '').replace('.tar.gz', '')
      }));
    res.json({ success: true, data: backups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 回滚到备份
 * POST /api/deploy/rollback/:projectId
 */
router.post('/rollback/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { backupName } = req.body;
    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const backupDir = path.join(WORK_DIR, '.backups');
    const backupPath = path.join(backupDir, backupName);
    if (!await fs.pathExists(backupPath)) {
      return res.status(404).json({ error: '备份文件不存在' });
    }

    // 删除当前目录，解压备份
    await fs.remove(project.local_path);
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(`tar -xzf "${backupPath}" -C "${path.dirname(project.local_path)}"`,
        (err) => err ? reject(err) : resolve());
    });

    await ProjectDB.update(projectId, { status: 'rolled_back' });
    if (global.broadcastLog) global.broadcastLog(projectId, `✅ 已回滚到备份: ${backupName}`);
    res.json({ success: true, message: `已回滚到: ${backupName}` });
  } catch (error) {
    logger.error('Rollback error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取部署日志
 * GET /api/deploy/logs/:projectId
 */
router.get('/logs/:projectId', async (req, res) => {
  try {
    const logs = await DeployLogDB.getByProjectId(req.params.projectId);
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

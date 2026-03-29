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
    const { spawn } = require('child_process');
    await new Promise((resolve, reject) => {
      // 用 spawn 数组参数，避免特殊字符注入
      const tar = spawn('tar', [
        '-czf', backupPath,
        '-C', path.dirname(project.local_path),
        path.basename(project.local_path)
      ]);
      tar.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)));
      tar.on('error', reject);
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

    // 删除当前目录，解压备份（用 spawn 数组参数，避免特殊字符注入）
    await fs.remove(project.local_path);
    const { spawn } = require('child_process');
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', backupPath, '-C', path.dirname(project.local_path)]);
      tar.on('close', (code) => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)));
      tar.on('error', reject);
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

/**
 * 重试上次失败的部署
 * POST /api/deploy/retry/:projectId
 */
router.post('/retry/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!['failed', 'cloned', 'rolled_back'].includes(project.status)) {
      return res.status(400).json({ error: `当前状态 "${project.status}" 不支持重试，只有失败/已克隆/已回滚的项目可以重试` });
    }
    logger.info(`Retrying deploy for project: ${project.name}`);
    // 复用 auto deploy 逻辑
    const result = await autoDeploy(project, (progress) => {
      if (global.broadcastLog) {
        global.broadcastLog(projectId, progress.message || JSON.stringify(progress));
      }
    });
    if (global.broadcast) {
      global.broadcast('deploy_done', { projectId, success: result.success });
    }
    await ProjectDB.update(projectId, { status: result.success ? 'deployed' : 'failed' });
    res.json({ success: result.success, data: result, message: result.success ? '重试部署成功' : '重试部署失败，请查看日志' });
  } catch (error) {
    logger.error('Retry deploy error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 拉取最新代码（git pull）
 * POST /api/deploy/pull/:projectId
 */
router.post('/pull/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.local_path || !require('fs-extra').pathExists(project.local_path)) {
      return res.status(400).json({ error: '项目目录不存在，请重新克隆' });
    }
    const simpleGit = require('simple-git');
    const git = simpleGit(project.local_path);
    if (global.broadcastLog) global.broadcastLog(projectId, '🔄 正在拉取最新代码...');
    const pullResult = await git.pull();
    const summary = `已更新: +${pullResult.insertions} 行, -${pullResult.deletions} 行, ${pullResult.files?.length || 0} 个文件`;
    if (global.broadcastLog) global.broadcastLog(projectId, `✅ ${summary}`);
    await ProjectDB.update(projectId, { updated_at: new Date().toISOString() });
    res.json({ success: true, message: summary, data: pullResult });
  } catch (error) {
    logger.error('Pull error:', error);
    if (global.broadcastLog) global.broadcastLog(req.params.projectId, `❌ 拉取失败: ${error.message}`);
    res.status(500).json({ error: `git pull 失败: ${error.message}` });
  }
});

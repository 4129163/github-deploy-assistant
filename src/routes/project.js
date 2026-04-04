/**
 * 项目相关路由
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { stopProject, getProcessStatus } = require('../services/process-manager');
const { WORK_DIR } = require('../config');

// 导入审计日志功能
const { auditLogEnhanced, AUDIT_ACTION_TYPES } = require('../services/audit-log-enhanced');

/**
 * 获取所有项目
 * GET /api/project/list
 */
router.get('/list', async (req, res) => {
  try {
    const projects = await ProjectDB.getAll();
    res.json({ success: true, data: projects });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有项目（兼容 GET /api/project）
 */
router.get('/', async (req, res) => {
  try {
    const projects = await ProjectDB.getAll();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取单个项目
 * GET /api/project/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新项目
 * PUT /api/project/:id
 */
router.put('/:id', async (req, res) => {
  try {
    await ProjectDB.update(req.params.id, req.body);
    const project = await ProjectDB.getById(req.params.id);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 预览卸载内容（不实际删除）
 * GET /api/project/:id/uninstall-preview
 */
router.get('/:id/uninstall-preview', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const preview = await buildUninstallPreview(project);
    res.json({ success: true, data: preview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 卸载项目
 * DELETE /api/project/:id/uninstall
 * body: { keepBackups?: boolean, keepData?: boolean }
 */
router.delete('/:id/uninstall', async (req, res) => {
  const startTime = Date.now();
  let project = null;
  let keepBackups = false;
  let keepData = false;
  
  try {
    const { id } = req.params;
    const options = req.body || {};
    keepBackups = options.keepBackups || false;
    keepData = options.keepData || false;

    project = await ProjectDB.getById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    logger.info(`Uninstalling project: ${project.name}`);
    const results = [];

    // 1. 停止运行中的进程
    const procStatus = getProcessStatus(id);
    if (procStatus.status === 'running') {
      try {
        await stopProject(id);
        results.push({ step: 'stop_process', success: true, msg: `进程已停止 (PID: ${procStatus.pid})` });
      } catch (e) {
        results.push({ step: 'stop_process', success: false, msg: `停止进程失败: ${e.message}` });
      }
    }

    // 2. 删除项目目录（包含 node_modules / venv）
    if (project.local_path && await fs.pathExists(project.local_path)) {
      try {
        await fs.remove(project.local_path);
        results.push({ step: 'remove_files', success: true, msg: `已删除目录: ${project.local_path}` });
      } catch (e) {
        results.push({ step: 'remove_files', success: false, msg: `删除目录失败: ${e.message}` });
      }
    } else {
      results.push({ step: 'remove_files', success: true, msg: '项目目录不存在，跳过' });
    }

    // 3. 删除备份（可选保留）
    if (!keepBackups) {
      const backupDir = path.join(WORK_DIR, '.backups');
      try {
        if (await fs.pathExists(backupDir)) {
          const files = await fs.readdir(backupDir);
          const toDelete = files.filter(f => f.startsWith(project.name + '-'));
          for (const f of toDelete) await fs.remove(path.join(backupDir, f));
          results.push({ step: 'remove_backups', success: true, msg: `已删除 ${toDelete.length} 个备份文件` });
        }
      } catch (e) {
        results.push({ step: 'remove_backups', success: false, msg: `删除备份失败: ${e.message}` });
      }
    } else {
      results.push({ step: 'remove_backups', success: true, msg: '备份已保留' });
    }

    // 4. 从数据库删除（可选保留记录）
    if (!keepData) {
      await ProjectDB.delete(id);
      results.push({ step: 'remove_db', success: true, msg: '数据库记录已删除' });
    } else {
      await ProjectDB.update(id, { status: 'uninstalled' });
      results.push({ step: 'remove_db', success: true, msg: '项目标记为已卸载（保留记录）' });
    }

    logger.info(`Project ${project.name} uninstalled successfully`);
    
    const response = {
      success: true,
      message: `项目 "${project.name}" 已卸载`,
      data: { results }
    };
    
    res.json(response);

  } catch (error) {
    logger.error('Uninstall error:', error);
    res.status(500).json({ error: error.message });
    
  } finally {
    // 记录审计日志
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    if (project) {
      auditLogEnhanced(AUDIT_ACTION_TYPES.PROJECT_DELETE, {
        project_id: project.id,
        project_name: project.name,
        project_path: project.local_path,
        keep_backups: keepBackups,
        keep_data: keepData,
        success,
        duration_ms: duration,
        status_code: res.statusCode,
        client_ip: req.ip,
        user_agent: req.get('User-Agent')
      }).catch(err => {
        logger.warn('Failed to record audit log for project uninstall:', err.message);
      });
    }
  }
});

/**
 * 删除项目（仅删数据库记录，兼容旧接口）
 * DELETE /api/project/:id
 */
router.delete('/:id', async (req, res) => {
  const startTime = Date.now();
  let project = null;
  
  try {
    const { id } = req.params;
    project = await ProjectDB.getById(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await ProjectDB.delete(id);
    res.json({ success: true, message: 'Project deleted' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
    
  } finally {
    // 记录审计日志
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    if (project) {
      auditLogEnhanced(AUDIT_ACTION_TYPES.PROJECT_DELETE, {
        project_id: project.id,
        project_name: project.name,
        project_path: project.local_path,
        delete_type: 'database_only',
        success,
        duration_ms: duration,
        status_code: res.statusCode,
        client_ip: req.ip,
        user_agent: req.get('User-Agent')
      }).catch(err => {
        logger.warn('Failed to record audit log for project delete:', err.message);
      });
    }
  }
});

/**
 * 构建卸载预览信息
 */
async function buildUninstallPreview(project) {
  const items = [];
  let totalSize = 0;

  // 检查进程
  const proc = getProcessStatus(String(project.id));
  if (proc.status === 'running') {
    items.push({ type: 'process', desc: `运行中的进程 (PID: ${proc.pid}, 端口: ${proc.port})` });
  }

  // 检查目录大小
  if (project.local_path && await fs.pathExists(project.local_path)) {
    try {
      const size = await getDirSize(project.local_path);
      totalSize += size;
      items.push({ type: 'directory', desc: `项目目录: ${project.local_path}`, size: formatSize(size) });

      // 检查 node_modules
      const nmPath = path.join(project.local_path, 'node_modules');
      if (await fs.pathExists(nmPath)) {
        const nmSize = await getDirSize(nmPath);
        items.push({ type: 'deps', desc: 'node_modules 依赖目录', size: formatSize(nmSize) });
      }

      // 检查 venv
      const venvPath = path.join(project.local_path, 'venv');
      if (await fs.pathExists(venvPath)) {
        const venvSize = await getDirSize(venvPath);
        items.push({ type: 'deps', desc: 'Python venv 虚拟环境', size: formatSize(venvSize) });
      }
    } catch (_) {}
  }

  // 检查备份
  const backupDir = path.join(WORK_DIR, '.backups');
  if (await fs.pathExists(backupDir)) {
    const files = await fs.readdir(backupDir);
    const backups = files.filter(f => f.startsWith(project.name + '-'));
    if (backups.length > 0) {
      items.push({ type: 'backups', desc: `${backups.length} 个备份文件`, count: backups.length });
    }
  }

  return { items, totalSize: formatSize(totalSize), projectName: project.name };
}

async function getDirSize(dirPath) {
  // 用 du -sb 快速估算，避免递归大量小文件（node_modules 等）
  const { safeExec } = require('../utils/security');
  try {
    const result = await safeExec(`du -sb "${dirPath}" 2>/dev/null || du -sk "${dirPath}" 2>/dev/null`);
    if (!result.success || !result.stdout) return 0;
    
    const parts = result.stdout.trim().split(/\s+/);
    const val = parseInt(parts[0], 10);
    // du -sk 返回 KB，du -sb 返回 bytes；简单判断：若值很小可能是KB
    return isNaN(val) ? 0 : val;
  } catch (error) {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

module.exports = router;


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

/**
 * 扫描 workspace 孤儿目录（有目录但数据库无记录）
 * GET /api/project/orphans
 */
router.get('/orphans', async (req, res) => {
  try {
    const { WORK_DIR } = require('../config');
    const { safeExec } = require('../utils/security');
    const allDirs = await fs.readdir(WORK_DIR).catch(() => []);
    const projects = await ProjectDB.getAll();
    const knownPaths = new Set(projects.map(p => path.basename(p.local_path || '')));
    const orphans = [];
    for (const dir of allDirs) {
      if (dir.startsWith('.')) continue;
      const full = path.join(WORK_DIR, dir);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat?.isDirectory()) continue;
      if (!knownPaths.has(dir)) {
        let size = '?';
        try { 
          const result = await safeExec(`du -sh "${full}" 2>/dev/null`);
          if (result.success && result.stdout) {
            size = result.stdout.split('\t')[0]; 
          }
        } catch (_) {}
        orphans.push({ name: dir, path: full, size: size.trim() });
      }
    }
    res.json({ success: true, data: orphans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 删除孤儿目录
 * DELETE /api/project/orphans/:name
 */
router.delete('/orphans/:name', async (req, res) => {
  try {
    const { WORK_DIR } = require('../config');
    const name = path.basename(req.params.name);
    const full = path.join(WORK_DIR, name);
    if (!full.startsWith(path.resolve(WORK_DIR))) return res.status(403).json({ error: '非法路径' });
    await fs.remove(full);
    res.json({ success: true, message: `已删除孤儿目录: ${name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 启动项目
 * POST /api/project/start/:id
 */
router.post('/start/:id', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    const result = await require('../services/process-manager').startProject(project);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 停止项目
 * POST /api/project/stop/:id
 */
router.post('/stop/:id', async (req, res) => {
  try {
    const result = await require('../services/process-manager').stopProject(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 更新环境变量 (.env)
 * POST /api/project/env/:id
 */
router.post('/env/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await ProjectDB.getById(id);
    if (!project || !project.local_path) return res.status(404).json({ error: '项目不存在或路径无效' });

    await require('../services/config-io').updateEnvConfig(project.local_path, req.body);
    res.json({ success: true, message: '环境变量已更新' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

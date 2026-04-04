/**
 * 部署相关路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { autoDeploy, generateManualGuide } = require('../services/deploy');
const { startDeployStream } = require('../services/deploy-stream');
const { diagnoseAndSuggestFix, applyAutoFix } = require('../services/error-fixer');
const { evaluateCompatibility } = require('../services/compatibility-checker');
const { runDeviceScan } = require('../services/device-scan');
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
    
    // 新增：兼容性检测逻辑
    const deviceStats = await runDeviceScan();
    // 模拟项目需求（实际可从 AI 分析结果中提取，这里先用默认值）
    const projectRequirements = {
      cpu: project.types.includes('docker') ? 2 : 1,
      memory_gb: project.types.includes('docker') ? 4 : 2,
      disk_gb: project.types.includes('docker') ? 5 : 1
    };
    const compatibility = await evaluateCompatibility(projectRequirements, deviceStats);

    res.json({ 
      success: true, 
      data: { 
        guide, 
        mode: 'manual', 
        compatibility 
      } 
    });
  } catch (error) {
    logger.error('Generate guide error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 诊断部署错误并给出 AI 修复建议
 * POST /api/deploy/diagnose/:projectId
 */
router.post('/diagnose/:projectId', async (req, res) => {
  try {
    const { logContent } = req.body;
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const diagnosis = await diagnoseAndSuggestFix(logContent, {
      types: project.project_type,
      local_path: project.local_path
    });
    res.json({ success: true, data: diagnosis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 执行 AI 推荐的修复指令
 * POST /api/deploy/fix/:projectId
 */
router.post('/fix/:projectId', async (req, res) => {
  try {
    const { fixCommand } = req.body;
    const result = await applyAutoFix(req.params.projectId, fixCommand);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 自动部署（带 WebSocket 实时日志流）
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

    // 使用增强的部署流服务
    const result = await startDeployStream(projectId, project, {
      onProgress: (progress, stage) => {
        // 进度回调，如果需要可处理
      }
    });

    await ProjectDB.update(projectId, { status: result.success ? 'deployed' : 'failed' });

    res.json({ 
      success: result.success, 
      data: { 
        deployStreamId: result.streamId,
        projectId,
        errors: result.errors
      } 
    });
  } catch (error) {
    logger.error('Auto deploy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导入跨平台压缩工具
const { createBackup, restoreBackup, listBackups } = require('../utils/archive');

/**
 * 部署前备份项目目录（跨平台）
 */
async function backupProject(project) {
  try {
    if (!project.local_path || !await fs.pathExists(project.local_path)) return;
    
    const result = await createBackup(project.local_path, project.name);
    logger.info(`Backup created: ${path.basename(result.path)} (${result.method}, ${Math.round(result.size/1024/1024*100)/100} MB)`);
    return result.path;
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
    const backups = await listBackups(path.join(WORK_DIR, '.backups'), req.params.projectName);
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

    // 删除当前目录，使用跨平台方法解压备份
    await fs.remove(project.local_path);
    await restoreBackup(backupPath, path.dirname(project.local_path));

    await ProjectDB.update(projectId, { status: 'rolled_back' });
    if (global.broadcastLog) global.broadcastLog(projectId, `✅ 已回滚到备份: ${backupName} (跨平台解压)`);
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
 * 检测项目是否有新版本
 * GET /api/deploy/check-update/:projectId
 */
router.get('/check-update/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.local_path || !(await fs.pathExists(project.local_path))) {
      return res.status(400).json({ error: '项目目录不存在' });
    }
    const simpleGit = require('simple-git');
    const git = simpleGit(project.local_path);
    // fetch 远端但不 merge
    await git.fetch(['--dry-run']).catch(() => git.fetch());
    const log = await git.log(['HEAD..FETCH_HEAD']);
    const behind = log.total || 0;
    // 获取最新 commit 信息
    const remoteLog = await git.log(['FETCH_HEAD', '-5']).catch(() => ({ all: [] }));
    const localLog = await git.log(['-1']).catch(() => ({ latest: null }));
    const remoteHead = remoteLog.latest;
    const localHead = localLog.latest;
    const hasUpdate = behind > 0;
    res.json({
      success: true,
      data: {
        has_update: hasUpdate,
        commits_behind: behind,
        local_commit: localHead ? { hash: localHead.hash.slice(0,7), message: localHead.message, date: localHead.date } : null,
        remote_commit: remoteHead ? { hash: remoteHead.hash.slice(0,7), message: remoteHead.message, date: remoteHead.date } : null,
        recent_changes: remoteLog.all.slice(0, 5).map(c => ({ hash: c.hash.slice(0,7), message: c.message, date: c.date, author: c.author_name })),
      }
    });
  } catch (err) {
    logger.error('Check update error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 更新项目（git pull + 重新安装依赖）
 * POST /api/deploy/update/:projectId
 */
router.post('/update/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { reinstall = false } = req.body;
  try {
    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.local_path || !(await fs.pathExists(project.local_path))) {
      return res.status(400).json({ error: '项目目录不存在，请重新克隆' });
    }
    const simpleGit = require('simple-git');
    const git = simpleGit(project.local_path);
    const broadcast = (msg) => {
      logger.info(`[Update:${projectId}] ${msg}`);
      if (global.broadcastLog) global.broadcastLog(String(projectId), msg);
    };

    broadcast('🔄 开始检测更新...');

    // 1. 暂存本地改动（如果有）
    const status = await git.status();
    const hasLocalChanges = status.files.length > 0;

    // 备份 .env 文件（更新前保存，防止被覆盖）
    const envFile = path.join(project.local_path, '.env');
    let envBackup = null;
    if (await fs.pathExists(envFile)) {
      envBackup = await fs.readFile(envFile, 'utf8');
      broadcast('🔒 已备份 .env 文件');
    }

    if (hasLocalChanges) {
      broadcast('📦 检测到本地改动，暂存中...');
      await git.stash();
    }

    // 2. 拉取最新代码
    broadcast('⬇️ 拉取最新代码...');
    const pullResult = await git.pull();
    const filesChanged = pullResult.files?.length || 0;
    const summary = `已更新 ${filesChanged} 个文件，+${pullResult.insertions||0} 行，-${pullResult.deletions||0} 行`;
    broadcast(`✅ ${summary}`);

    // 3. 恢复本地暂存
    if (hasLocalChanges) {
      try { await git.stash(['pop']); broadcast('📦 本地改动已恢复'); }
      catch (_) { broadcast('⚠️ 本地改动恢复失败（可能有冲突），请手动处理'); }
    }

    // 恢复 .env 文件（如果被 git pull 覆盖）
    if (envBackup !== null) {
      const envNow = await fs.pathExists(envFile) ? await fs.readFile(envFile, 'utf8') : null;
      if (envNow !== envBackup) {
        await fs.writeFile(envFile, envBackup, 'utf8');
        broadcast('🔒 .env 文件已恢复（防止被 git pull 覆盖）');
      }
    }

    // 4. 判断是否需要重新安装依赖
    const types = (project.project_type || '').split(',');
    let depsUpdated = false;
    const changedFiles = pullResult.files || [];
    const needsNpmInstall = reinstall || changedFiles.some(f => f === 'package.json' || f === 'package-lock.json');
    const needsPipInstall = reinstall || changedFiles.some(f => f === 'requirements.txt' || f === 'pyproject.toml');

    if (types.includes('nodejs') && needsNpmInstall) {
      broadcast('📦 package.json 有变化，重新安装依赖...');
      const { executeCommand } = require('../services/deploy');
      await executeCommand('npm install --ignore-scripts', project.local_path);
      depsUpdated = true;
      broadcast('✅ 依赖安装完成');
    }
    if (types.includes('python') && needsPipInstall) {
      broadcast('🐍 requirements.txt 有变化，重新安装依赖...');
      const venvPip = path.join(project.local_path, 'venv/bin/pip');
      const pipCmd = (await fs.pathExists(venvPip)) ? `${venvPip} install -r requirements.txt` : 'pip3 install -r requirements.txt';
      const { executeCommand } = require('../services/deploy');
      await executeCommand(pipCmd, project.local_path);
      depsUpdated = true;
      broadcast('✅ 依赖安装完成');
    }

    await ProjectDB.update(projectId, { updated_at: new Date().toISOString() });
    broadcast('🎉 更新完成！');

    // ── 智能回滚：若项目更新前在运行，重启后健康检查失败则自动回滚 ──
    const wasRunning = require('../services/process-manager').getProcessStatus(projectId).status === 'running';
    if (wasRunning && project.health_url || (wasRunning && project.port)) {
      broadcast('🔍 正在验证新版本健康状态（等待15秒）...');
      await new Promise(r => setTimeout(r, 15000));
      const { checkProject } = require('../services/health-checker');
      const port = require('../services/process-manager').getProcessStatus(projectId).port || project.port;
      const healthy = await checkProject(projectId, port, project.health_url);
      if (!healthy) {
        broadcast('❌ 新版本健康检查失败！正在自动回滚...');
        // 找最新备份
        const backupDir = path.join(WORK_DIR, '.backups');
        const backups = (await fs.readdir(backupDir).catch(() => []))
          .filter(f => f.startsWith(project.name + '-') && f.endsWith('.tar.gz'))
          .sort().reverse();
        if (backups.length > 0) {
          const latestBackup = backups[0];
          const backupPath = path.join(backupDir, latestBackup);
          try {
            await fs.remove(project.local_path);
            const { spawn: sp } = require('child_process');
            await new Promise((resolve, reject) => {
              const tar = sp('tar', ['-xzf', backupPath, '-C', path.dirname(project.local_path)]);
              tar.on('close', c => c === 0 ? resolve() : reject(new Error('tar exit ' + c)));
              tar.on('error', reject);
            });
            await ProjectDB.update(projectId, { status: 'rolled_back' });
            broadcast(`⏪ 已自动回滚到备份: ${latestBackup}`);
            if (global.broadcast) global.broadcast('auto_rollback', { projectId: String(projectId), backup: latestBackup });
          } catch (rbErr) {
            broadcast(`⚠️ 自动回滚失败: ${rbErr.message}，请手动回滚`);
          }
        } else {
          broadcast('⚠️ 未找到可用备份，无法自动回滚，请手动处理');
        }
        return res.json({ success: false, auto_rolled_back: true, message: '更新后健康检查失败，已自动回滚' });
      } else {
        broadcast('✅ 新版本健康检查通过！');
      }
    }

    res.json({
      success: true,
      message: summary,
      data: {
        files_changed: filesChanged,
        deps_updated: depsUpdated,
        had_local_changes: hasLocalChanges,
        pull_result: pullResult,
      }
    });
  } catch (err) {
    logger.error('Update error:', err);
    if (global.broadcastLog) global.broadcastLog(String(projectId), `❌ 更新失败: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

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

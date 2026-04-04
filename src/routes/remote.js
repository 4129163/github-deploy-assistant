/**
 * 远程主机部署路由
 * 功能26：多环境支持 - 树莓派、云服务器等远程主机
 *
 * POST   /api/remote/hosts            — 添加远程主机
 * GET    /api/remote/hosts            — 列出所有远程主机
 * DELETE /api/remote/hosts/:hostId    — 删除远程主机
 * POST   /api/remote/hosts/:hostId/test — 测试连接
 * POST   /api/remote/deploy/:projectId  — 远程部署项目
 * POST   /api/remote/exec/:hostId       — 在远程主机执行命令
 */

const express = require('express');
const router = express.Router();
const { addHost, listHosts, removeHost, testConnection, remoteDeployProject, remoteExec } = require('../services/remote-deploy');
const { ProjectDB, DeployLogDB } = require('../services/database');
const { logger } = require('../utils/logger');

// 导入审计日志功能
const { auditLogEnhanced, AUDIT_ACTION_TYPES } = require('../services/audit-log-enhanced');

/**
 * 添加远程主机
 */
router.post('/hosts', async (req, res) => {
  try {
    const { name, host, port, username, password, privateKey, workDir, type } = req.body;
    if (!name || !host || !username) {
      return res.status(400).json({ error: '缺少必填字段：name, host, username' });
    }
    if (!password && !privateKey) {
      return res.status(400).json({ error: '必须提供密码或 SSH 私钥' });
    }
    const result = await addHost({ name, host, port, username, password, privateKey, workDir, type });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Add host error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 列出所有远程主机
 */
router.get('/hosts', (req, res) => {
  try {
    res.json({ success: true, data: listHosts() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 删除远程主机
 */
router.delete('/hosts/:hostId', async (req, res) => {
  try {
    await removeHost(req.params.hostId);
    res.json({ success: true, message: '主机已删除' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * 测试远程主机连接
 */
router.post('/hosts/:hostId/test', async (req, res) => {
  try {
    const result = await testConnection(req.params.hostId);
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 远程部署项目
 * POST /api/remote/deploy/:projectId
 * body: { hostId }
 */
router.post('/deploy/:projectId', async (req, res) => {
  const startTime = Date.now();
  let project = null;
  let result = null;
  let logs = [];
  
  try {
    const { projectId } = req.params;
    const { hostId } = req.body;
    if (!hostId) return res.status(400).json({ error: '缺少 hostId' });

    project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    logs = [];
    const onLog = (msg) => {
      logs.push(msg);
      if (global.broadcastLog) global.broadcastLog(String(projectId), msg);
    };

    result = await remoteDeployProject(project, hostId, onLog);

    // 记录部署日志
    await DeployLogDB.create({
      project_id: projectId,
      mode: 'remote',
      status: result.success ? 'success' : 'failed',
      output: JSON.stringify(logs),
      error: result.success ? null : '远程部署失败',
    });

    await ProjectDB.update(projectId, { status: result.success ? 'deployed' : 'failed' });

    if (global.broadcast) global.broadcast('deploy_done', { projectId, success: result.success, mode: 'remote' });

    res.json({ success: result.success, data: { logs, ...result } });
  } catch (err) {
    logger.error('Remote deploy error:', err);
    res.status(500).json({ error: err.message });
    
  } finally {
    // 记录审计日志
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400 && result?.success !== false;
    
    if (project) {
      auditLogEnhanced(AUDIT_ACTION_TYPES.REMOTE_DEPLOY, {
        project_id: project.id,
        project_name: project.name,
        host_id: req.body?.hostId,
        deployment_type: 'remote',
        success,
        duration_ms: duration,
        status_code: res.statusCode,
        client_ip: req.ip,
        user_agent: req.get('User-Agent'),
        log_count: logs?.length || 0
      }).catch(err => {
        logger.warn('Failed to record audit log for remote deploy:', err.message);
      });
    }
  }
});

/**
 * 在远程主机执行命令（仅调试用，需要启用 ALLOW_AUTO_EXEC）
 */
router.post('/exec/:hostId', async (req, res) => {
  try {
    if (process.env.ALLOW_AUTO_EXEC === 'false') {
      return res.status(403).json({ error: '远程命令执行已禁用' });
    }
    const { command, cwd } = req.body;
    if (!command) return res.status(400).json({ error: '缺少 command' });
    const result = await remoteExec(req.params.hostId, command, cwd);
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * 进程管理服务
 * 记录每个项目的运行进程，支持启动/停止/重启/状态查询
 *
 * 修复：
 * 1. 服务重启后，数据库中 status=running 的项目会变成「僵尸状态」
 *    → 启动时自动修复：将数据库中残留的 running 状态重置为 stopped
 * 2. 重启后端口变了前端不知道
 *    → broadcast 新端口给所有 WebSocket 客户端
 * 3. 部署超时固定 5 分钟
 *    → 支持 timeoutMs 参数，默认 10 分钟，可按需调整
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { findAvailablePort } = require('../utils/port');
const { spawnWithLimits, parseLimitsFromProject } = require('../utils/resource-limiter');

// 内存中的进程表：projectId -> { pid, process, port, status, startedAt, resourceLimits }
const runningProcesses = {};

/**
 * 服务启动时调用：将数据库中残留的 running 状态重置为 stopped
 * 避免「显示运行中但实际没有进程」的问题
 */
async function recoverProcessState() {
  try {
    const { ProjectDB } = require('./database');
    const projects = await ProjectDB.getAll();
    const stale = projects.filter(p => p.status === 'running');
    for (const p of stale) {
      await ProjectDB.update(p.id, { status: 'stopped' });
      logger.info(`[ProcessManager] Reset stale running status for project: ${p.name}`);
    }
    if (stale.length > 0) {
      logger.info(`[ProcessManager] Reset ${stale.length} stale process(es) to stopped`);
    }
  } catch (err) {
    logger.warn(`[ProcessManager] recoverProcessState failed: ${err.message}`);
  }
}

/**
 * 启动项目进程
 */
async function startProject(project, onLog) {
  const { id, name, local_path, project_type } = project;
  const types = project_type ? project_type.split(',') : [];

  if (runningProcesses[String(id)]?.status === 'running') {
    throw new Error(`项目 "${name}" 已在运行中 (PID: ${runningProcesses[String(id)].pid})`);
  }

  // 分配端口
  const port = await findAvailablePort(3100);
  const log = (msg) => {
    logger.info(`[${name}] ${msg}`);
    if (onLog) onLog(msg);
    // 实时推送日志到前端
    if (global.broadcastLog) global.broadcastLog(String(id), msg);
  };

  log(`分配端口: ${port}`);

  // 解析项目的资源限制配置
  const resourceLimits = parseLimitsFromProject(project);
  
  let child;
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production' };

  if (types.includes('nodejs')) {
    let startCmd = 'node';
    let startArgs = ['index.js'];
    try {
      const pkg = await fs.readJson(path.join(local_path, 'package.json'));
      if (pkg.scripts?.start) {
        startCmd = 'npm';
        startArgs = ['start'];
      } else if (pkg.main) {
        startArgs = [pkg.main];
      }
    } catch (_) {}
    log(`启动命令: ${startCmd} ${startArgs.join(' ')}`);
    if (resourceLimits.hasLimits()) {
      log(`资源限制: ${resourceLimits.toString()}`);
    }
    child = spawnWithLimits(startCmd, startArgs, { cwd: local_path, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }, resourceLimits);
    child.unref(); // 允许父进程退出而不等子进程

  } else if (types.includes('python')) {
    // Windows 上 venv 路径不同
    const isWin = process.platform === 'win32';
    const venvPython = path.join(local_path, 'venv', isWin ? 'Scripts/python.exe' : 'bin/python');
    const pythonCmd = await fs.pathExists(venvPython) ? venvPython : (isWin ? 'python' : 'python3');
    const entryFiles = ['main.py', 'app.py', 'run.py', 'server.py', 'manage.py'];
    let entry = 'main.py';
    for (const f of entryFiles) {
      if (await fs.pathExists(path.join(local_path, f))) { entry = f; break; }
    }
    log(`启动命令: ${pythonCmd} ${entry}`);
    if (resourceLimits.hasLimits()) {
      log(`资源限制: ${resourceLimits.toString()}`);
    }
    child = spawnWithLimits(pythonCmd, [entry], { cwd: local_path, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }, resourceLimits);
    child.unref();

  } else if (types.includes('docker')) {
    log('检测到 Docker 项目，尝试 docker compose up...');
    const hasCompose = await fs.pathExists(path.join(local_path, 'docker-compose.yml'))
      || await fs.pathExists(path.join(local_path, 'docker-compose.yaml'));
    if (!hasCompose) throw new Error('未找到 docker-compose.yml');
    if (resourceLimits.hasLimits()) {
      log(`注意：Docker项目需在docker-compose.yml中配置资源限制，系统限制可能不生效`);
    }
    child = spawn('docker', ['compose', 'up'], { cwd: local_path, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.unref();

  } else {
    throw new Error(`不支持自动启动此项目类型: ${types.join(',') || '未知'}。请手动进入项目目录启动。`);
  }

  runningProcesses[String(id)] = {
    pid: child.pid,
    process: child,
    port,
    status: 'running',
    startedAt: new Date().toISOString(),
    resourceLimits: resourceLimits
  };

  child.stdout?.on('data', (d) => log(d.toString().trim()));
  child.stderr?.on('data', (d) => log(`[stderr] ${d.toString().trim()}`));
  child.on('close', (code) => {
    log(`进程退出，exit code: ${code}`);
    if (runningProcesses[String(id)]) runningProcesses[String(id)].status = 'stopped';
    // 通知前端进程已停止
    if (global.broadcast) global.broadcast('process_stopped', { projectId: String(id), code });
  });
  child.on('error', (err) => {
    log(`进程错误: ${err.message}`);
    if (runningProcesses[String(id)]) runningProcesses[String(id)].status = 'error';
    if (global.broadcast) global.broadcast('process_error', { projectId: String(id), error: err.message });
  });

  log(`项目已启动，PID: ${child.pid}，端口: ${port}`);

  // 广播新端口给前端
  if (global.broadcast) {
    global.broadcast('process_started', { projectId: String(id), pid: child.pid, port });
  }

  return { pid: child.pid, port };
}

/**
 * 停止项目进程
 */
async function stopProject(projectId) {
  const proc = runningProcesses[String(projectId)];
  if (!proc || proc.status !== 'running') {
    throw new Error('项目未在运行');
  }

  // 标记为停止（防止 close 事件重复处理）
  proc.status = 'stopped';

  // 尝试杀进程树（整个进程组），避免孤儿进程
  const tryKillGroup = (signal) => {
    try {
      // 负 pid = 杀整个进程组（Linux/macOS）
      if (proc.process.pid) process.kill(-proc.process.pid, signal);
    } catch (_) {
      // 进程组不存在时，退化到只杀父进程
      try { proc.process.kill(signal); } catch (__) {}
    }
  };

  tryKillGroup('SIGTERM');

  // 3 秒后强杀（进程组 + 父进程）
  setTimeout(() => {
    try {
      if (runningProcesses[String(projectId)]?.status !== 'running') return;
      tryKillGroup('SIGKILL');
    } catch (_) {}
  }, 3000);

  logger.info(`Project ${projectId} stopped (PID: ${proc.pid})`);
  return true;
}

/**
 * 重启项目（广播新端口）
 */
async function restartProject(project, onLog, options = {}) {
  const { PROCESS_RESTART_DELAY, PROCESS_RESTART_MAX_WAIT } = require('../config');
  const { forceRestart = false, delayMs = PROCESS_RESTART_DELAY, maxWaitForStop = PROCESS_RESTART_MAX_WAIT } = options;
  const log = (msg) => {
    logger.info(`[${project.name}] ${msg}`);
    if (onLog) onLog(msg);
    if (global.broadcastLog) global.broadcastLog(String(project.id), msg);
  };

  log(`🔄 开始重启进程...`);
  
  // 获取当前进程状态
  const proc = runningProcesses[String(project.id)];
  const wasRunning = proc?.status === 'running';
  
  if (!wasRunning && !forceRestart) {
    log(`⚠️  进程未运行，直接启动新进程`);
    return await startProject(project, onLog);
  }
  
  // 停止当前进程
  if (wasRunning) {
    log(`⏹️  停止当前进程 (PID: ${proc.pid})`);
    try {
      await stopProject(project.id);
      log(`✅ 进程已停止`);
    } catch (err) {
      log(`⚠️  停止进程时出错: ${err.message}`);
      if (!forceRestart) throw err;
    }
  }
  
  // 等待进程完全停止（检查端口释放）
  let portReleased = false;
  const startTime = Date.now();
  
  if (wasRunning && proc.port) {
    log(`⏳ 等待端口 ${proc.port} 释放...`);
    const net = require('net');
    while (Date.now() - startTime < maxWaitForStop) {
      const socket = new net.Socket();
      const portCheck = new Promise((resolve) => {
        socket.setTimeout(100);
        socket.on('connect', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(true);
        });
      });
      
      portReleased = await portCheck;
      if (portReleased) {
        log(`✅ 端口 ${proc.port} 已释放`);
        break;
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    if (!portReleased) {
      log(`⚠️  端口 ${proc.port} 未在 ${maxWaitForStop}ms 内释放，强制继续重启`);
    }
  }
  
  // 等待配置的延迟时间
  if (delayMs > 0) {
    log(`⏳ 等待 ${delayMs}ms 后启动新进程...`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  
  // 启动新进程
  log(`🚀 启动新进程...`);
  const result = await startProject(project, onLog);
  log(`✅ 重启完成，新进程 PID: ${result.pid}, 端口: ${result.port}`);
  
  return result;
}

/**
 * 获取进程状态
 */
function getProcessStatus(projectId) {
  const proc = runningProcesses[String(projectId)];
  if (!proc) return { status: 'stopped', pid: null, port: null, startedAt: null };
  return {
    status: proc.status,
    pid: proc.pid,
    port: proc.port,
    startedAt: proc.startedAt,
    resourceLimits: proc.resourceLimits ? {
      cpuLimit: proc.resourceLimits.cpuLimit,
      memoryLimitMB: proc.resourceLimits.memoryLimitMB,
      hasLimits: proc.resourceLimits.hasLimits()
    } : null
  };
}

/**
 * 获取所有运行中的进程
 */
function getAllProcesses() {
  return Object.entries(runningProcesses).map(([projectId, proc]) => ({
    projectId,
    pid: proc.pid,
    port: proc.port,
    status: proc.status,
    startedAt: proc.startedAt,
    resourceLimits: proc.resourceLimits ? {
      cpuLimit: proc.resourceLimits.cpuLimit,
      memoryLimitMB: proc.resourceLimits.memoryLimitMB,
      hasLimits: proc.resourceLimits.hasLimits()
    } : null
  }));
}

module.exports = { startProject, stopProject, restartProject, getProcessStatus, getAllProcesses, recoverProcessState };

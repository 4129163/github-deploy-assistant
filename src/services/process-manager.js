/**
 * 进程管理服务
 * 记录每个项目的运行进程，支持启动/停止/重启/状态查询
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { findAvailablePort } = require('../utils/port');

// 内存中的进程表：projectId -> { pid, process, port, status, startedAt }
const runningProcesses = {};

/**
 * 启动项目进程
 */
async function startProject(project, onLog) {
  const { id, name, local_path, project_type } = project;
  const types = project_type ? project_type.split(',') : [];

  if (runningProcesses[id]?.status === 'running') {
    throw new Error(`项目 "${name}" 已在运行中 (PID: ${runningProcesses[id].pid})`);
  }

  // 分配端口
  const port = await findAvailablePort(3100);
  const log = (msg) => { logger.info(`[${name}] ${msg}`); if (onLog) onLog(msg); };

  log(`分配端口: ${port}`);

  let child;
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production' };

  if (types.includes('nodejs')) {
    // 读取 package.json 获取 start 命令
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
    child = spawn(startCmd, startArgs, { cwd: local_path, env, detached: false });

  } else if (types.includes('python')) {
    const venvPython = path.join(local_path, 'venv', 'bin', 'python');
    const pythonCmd = await fs.pathExists(venvPython) ? venvPython : 'python3';
    const entryFiles = ['main.py', 'app.py', 'run.py', 'server.py'];
    let entry = 'main.py';
    for (const f of entryFiles) {
      if (await fs.pathExists(path.join(local_path, f))) { entry = f; break; }
    }
    log(`启动命令: ${pythonCmd} ${entry}`);
    child = spawn(pythonCmd, [entry], { cwd: local_path, env, detached: false });

  } else {
    throw new Error(`不支持自动启动此项目类型: ${types.join(',')}`);
  }

  runningProcesses[id] = {
    pid: child.pid,
    process: child,
    port,
    status: 'running',
    startedAt: new Date().toISOString()
  };

  child.stdout?.on('data', (d) => log(d.toString().trim()));
  child.stderr?.on('data', (d) => log(`[stderr] ${d.toString().trim()}`));
  child.on('close', (code) => {
    log(`进程退出，exit code: ${code}`);
    if (runningProcesses[id]) runningProcesses[id].status = 'stopped';
  });
  child.on('error', (err) => {
    log(`进程错误: ${err.message}`);
    if (runningProcesses[id]) runningProcesses[id].status = 'error';
  });

  log(`项目已启动，PID: ${child.pid}，端口: ${port}`);
  return { pid: child.pid, port };
}

/**
 * 停止项目进程
 */
async function stopProject(projectId) {
  const proc = runningProcesses[projectId];
  if (!proc || proc.status !== 'running') {
    throw new Error('项目未在运行');
  }
  proc.process.kill('SIGTERM');
  proc.status = 'stopped';
  logger.info(`Project ${projectId} stopped (PID: ${proc.pid})`);
  return true;
}

/**
 * 重启项目
 */
async function restartProject(project, onLog) {
  try { await stopProject(project.id); } catch (_) {}
  await new Promise(r => setTimeout(r, 500));
  return await startProject(project, onLog);
}

/**
 * 获取进程状态
 */
function getProcessStatus(projectId) {
  const proc = runningProcesses[projectId];
  if (!proc) return { status: 'stopped', pid: null, port: null, startedAt: null };
  return {
    status: proc.status,
    pid: proc.pid,
    port: proc.port,
    startedAt: proc.startedAt
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
    startedAt: proc.startedAt
  }));
}

module.exports = { startProject, stopProject, restartProject, getProcessStatus, getAllProcesses };

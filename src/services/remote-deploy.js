/**
 * 远程主机部署服务
 * 功能26：多环境支持 - 远程主机部署（树莓派、云服务器等）
 * 通过 SSH 连接远程主机执行部署操作
 */

const { NodeSSH } = require('node-ssh');
const path = require('path');
const { logger } = require('../utils/logger');
const { ConfigDB } = require('./database');

// 远程主机配置存储
const hostMap = {}; // hostId -> hostConfig

async function loadHosts() {
  try {
    const raw = await ConfigDB.get('remote_hosts');
    if (raw) {
      const data = JSON.parse(raw);
      Object.assign(hostMap, data);
      logger.info(`Loaded ${Object.keys(hostMap).length} remote hosts`);
    }
  } catch (_) {}
}

async function saveHosts() {
  try {
    await ConfigDB.set('remote_hosts', JSON.stringify(hostMap));
  } catch (_) {}
}

loadHosts();

/**
 * 添加远程主机
 * @param {object} config
 * @param {string} config.name        - 主机别名（如 "树莓派" "腾讯云"）
 * @param {string} config.host        - 主机地址/IP
 * @param {number} config.port        - SSH 端口（默认22）
 * @param {string} config.username    - SSH 用户名
 * @param {string} [config.password]  - SSH 密码（与 privateKey 二选一）
 * @param {string} [config.privateKey]- SSH 私钥内容（PEM格式）
 * @param {string} [config.workDir]   - 远程工作目录（默认 ~/gada-workspace）
 * @param {string} [config.type]      - 主机类型标签（raspberry-pi/cloud/vps/自定义）
 */
async function addHost(config) {
  const id = `host_${Date.now()}`;
  const host = {
    id,
    name: config.name,
    host: config.host,
    port: config.port || 22,
    username: config.username,
    password: config.password || null,
    privateKey: config.privateKey || null,
    workDir: config.workDir || '~/gada-workspace',
    type: config.type || 'generic',
    createdAt: new Date().toISOString(),
  };
  hostMap[id] = host;
  await saveHosts();
  logger.info(`Remote host added: ${host.name} (${host.host})`);
  return { ...host, password: host.password ? '***' : null, privateKey: host.privateKey ? '***' : null };
}

/**
 * 获取所有远程主机（脱敏）
 */
function listHosts() {
  return Object.values(hostMap).map(h => ({
    id: h.id,
    name: h.name,
    host: h.host,
    port: h.port,
    username: h.username,
    workDir: h.workDir,
    type: h.type,
    createdAt: h.createdAt,
    authType: h.privateKey ? 'key' : 'password',
  }));
}

/**
 * 删除远程主机
 */
async function removeHost(hostId) {
  if (!hostMap[hostId]) throw new Error('主机不存在');
  delete hostMap[hostId];
  await saveHosts();
}

/**
 * 创建 SSH 连接
 */
async function createSSHConnection(hostId) {
  const config = hostMap[hostId];
  if (!config) throw new Error(`远程主机 ${hostId} 不存在`);

  const ssh = new NodeSSH();
  const connectOpts = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: 20000,
  };

  if (config.privateKey) {
    connectOpts.privateKey = config.privateKey;
  } else if (config.password) {
    connectOpts.password = config.password;
  } else {
    throw new Error('未配置认证方式（密码或私钥）');
  }

  await ssh.connect(connectOpts);
  return ssh;
}

/**
 * 测试远程主机连接
 */
async function testConnection(hostId) {
  let ssh;
  try {
    ssh = await createSSHConnection(hostId);
    const result = await ssh.execCommand('uname -a && echo "GADA_OK"');
    const ok = result.stdout.includes('GADA_OK');
    return {
      success: ok,
      info: result.stdout.replace('GADA_OK', '').trim(),
      error: result.stderr || null,
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (ssh) ssh.dispose();
  }
}

/**
 * 在远程主机上执行部署
 * @param {object} project  - 项目信息
 * @param {string} hostId   - 远程主机ID
 * @param {function} onLog  - 日志回调 (message) => void
 */
async function remoteDeployProject(project, hostId, onLog = () => {}) {
  const config = hostMap[hostId];
  if (!config) throw new Error(`远程主机 ${hostId} 不存在`);

  const log = (msg) => {
    logger.info(`[RemoteDeploy:${hostId}] ${msg}`);
    onLog(msg);
  };

  let ssh;
  try {
    log(`🔌 正在连接远程主机 ${config.name} (${config.host}:${config.port})...`);
    ssh = await createSSHConnection(hostId);
    log(`✅ SSH 连接成功`);

    // 确保工作目录存在
    const workDir = config.workDir.replace('~', `$HOME`);
    await ssh.execCommand(`mkdir -p ${workDir}`);

    const projectDir = `${workDir}/${project.name}`;
    const types = project.project_type ? project.project_type.split(',') : [];

    // 检查是否已有项目目录
    const checkResult = await ssh.execCommand(`test -d ${projectDir} && echo EXISTS || echo NOTEXIST`);
    const exists = checkResult.stdout.trim() === 'EXISTS';

    if (exists) {
      log(`📁 项目目录已存在，执行 git pull 更新...`);
      const pullResult = await ssh.execCommand(`cd ${projectDir} && git pull`, { stream: 'both' });
      log(`📥 ${pullResult.stdout || pullResult.stderr}`);
    } else {
      log(`📦 克隆仓库到远程主机...`);
      const cloneUrl = buildCloneUrl(project);
      const cloneResult = await ssh.execCommand(`cd ${workDir} && git clone ${cloneUrl} ${project.name}`, { stream: 'both' });
      if (cloneResult.code !== 0) {
        throw new Error(`克隆失败: ${cloneResult.stderr}`);
      }
      log(`✅ 仓库克隆完成`);
    }

    // 根据项目类型执行安装和启动
    const commands = buildRemoteCommands(project, projectDir, types);
    for (const cmd of commands) {
      log(`⚙️  执行: ${cmd.description}`);
      const result = await ssh.execCommand(cmd.command, { cwd: projectDir, stream: 'both' });
      if (result.stdout) log(result.stdout);
      if (result.stderr && !cmd.ignoreStderr) log(`⚠️  ${result.stderr}`);
      if (result.code !== 0 && !cmd.optional) {
        throw new Error(`命令失败 [${cmd.description}]: ${result.stderr || result.stdout}`);
      }
      log(`✅ ${cmd.description} 完成`);
    }

    log(`🎉 远程部署完成！`);
    if (project.port) {
      log(`🌐 服务地址: http://${config.host}:${project.port}`);
    }

    return { success: true, host: config.host, port: project.port };
  } catch (err) {
    log(`❌ 远程部署失败: ${err.message}`);
    throw err;
  } finally {
    if (ssh) ssh.dispose();
  }
}

/**
 * 构建克隆 URL（支持私有仓库 token 注入）
 */
function buildCloneUrl(project) {
  let url = project.repo_url;
  // 私有仓库：如果配置了 access_token，注入到 URL
  if (project.access_token) {
    url = url.replace('https://', `https://${project.access_token}@`);
  }
  return url;
}

/**
 * 构建远程执行命令序列
 */
function buildRemoteCommands(project, projectDir, types) {
  const cmds = [];

  if (types.includes('nodejs')) {
    cmds.push({ description: '安装 Node.js 依赖', command: `cd ${projectDir} && npm install --production`, ignoreStderr: true });
    // 检查是否有 pm2，优先用 pm2 守护进程
    cmds.push({
      description: '启动 Node.js 服务（pm2）',
      command: `cd ${projectDir} && (command -v pm2 && pm2 start npm --name ${project.name} -- start || npm start &)`,
      optional: true,
    });
  } else if (types.includes('python')) {
    cmds.push({ description: '创建虚拟环境', command: `cd ${projectDir} && python3 -m venv venv`, optional: true });
    cmds.push({ description: '安装 Python 依赖', command: `cd ${projectDir} && ./venv/bin/pip install -r requirements.txt`, ignoreStderr: true });
    cmds.push({ description: '启动 Python 服务', command: `cd ${projectDir} && nohup ./venv/bin/python main.py &`, optional: true });
  } else if (types.includes('docker')) {
    cmds.push({ description: '构建 Docker 镜像', command: `cd ${projectDir} && docker build -t ${project.name} .` });
    cmds.push({
      description: '运行 Docker 容器',
      command: `docker run -d --name ${project.name} --restart unless-stopped -p ${project.port || 3000}:${project.port || 3000} ${project.name}`,
      optional: true,
    });
  } else if (types.includes('go')) {
    cmds.push({ description: '编译 Go 项目', command: `cd ${projectDir} && go build -o app .` });
    cmds.push({ description: '启动 Go 服务', command: `cd ${projectDir} && nohup ./app &`, optional: true });
  }

  return cmds;
}

/**
 * 在远程主机上执行任意命令（调试用，带安全检查）
 */
async function remoteExec(hostId, command, cwd = null) {
  // 导入安全验证模块
  const { validateRemoteCommand } = require('../utils/security');
  
  // 验证命令是否安全
  const validation = validateRemoteCommand(command);
  if (!validation.safe) {
    throw new Error(`远程命令安全检查失败: ${validation.reason}`);
  }
  
  let ssh;
  try {
    ssh = await createSSHConnection(hostId);
    const opts = {};
    if (cwd) opts.cwd = cwd;
    const result = await ssh.execCommand(command, opts);
    return { success: result.code === 0, stdout: result.stdout, stderr: result.stderr, code: result.code };
  } finally {
    if (ssh) ssh.dispose();
  }
}

module.exports = {
  addHost,
  listHosts,
  removeHost,
  testConnection,
  remoteDeployProject,
  remoteExec,
  buildCloneUrl,
};

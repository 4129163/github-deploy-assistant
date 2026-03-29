/**
 * 部署执行服务
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { DeployLogDB } = require('./database');
const { ALLOW_AUTO_EXEC } = require('../config');

// 允许的命令白名单（正则）
const ALLOWED_COMMANDS = [
  /^node\b/,
  /^npm\s+(install|start|run\s+\w+|ci)\b/,
  /^yarn\s+(install|start|run\s+\w+)\b/,
  /^pnpm\s+(install|start|run\s+\w+)\b/,
  /^pip3?\s+install\b/,
  /^python3?\s+/,
  /^docker\s+(build|run|compose)\b/,
  /^go\s+(build|run|mod)\b/,
  /^cargo\s+(build|run)\b/,
  /^mvn\s+/,
  /^gradle\s+/,
];

/**
 * 验证命令是否在白名单内
 */
function validateCommand(command) {
  const trimmed = command.trim();
  for (const pattern of ALLOWED_COMMANDS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

/**
 * 执行命令（带输出捕获）
 * 只允许白名单内的命令，防止命令注入
 */
function executeCommand(command, cwd, env = {}) {
  return new Promise((resolve) => {
    // 安全检查：验证命令是否在白名单内
    if (!validateCommand(command)) {
      logger.warn(`Blocked disallowed command: ${command}`);
      resolve({
        success: false,
        exitCode: -1,
        error: `Command not allowed: ${command}`,
        outputs: [{ type: 'error', data: `Security: command not in allowlist: ${command}`, time: Date.now() }]
      });
      return;
    }

    // 确保 cwd 在 workspace 内，防止路径穿越
    const resolvedCwd = path.resolve(cwd);
    const workspaceRoot = path.resolve(require('../config').WORK_DIR);
    if (!resolvedCwd.startsWith(workspaceRoot)) {
      logger.warn(`Blocked path traversal attempt: ${cwd}`);
      resolve({
        success: false,
        exitCode: -1,
        error: 'Working directory must be inside workspace',
        outputs: [{ type: 'error', data: 'Security: path traversal blocked', time: Date.now() }]
      });
      return;
    }

    const outputs = [];
    logger.info(`Executing: ${command} in ${resolvedCwd}`);

    const child = exec(command, {
      cwd: resolvedCwd,
      env: { ...process.env, ...env },
      timeout: 300000, // 5分钟超时
      maxBuffer: 10 * 1024 * 1024 // 10MB 缓冲区
    });

    child.stdout.on('data', (data) => {
      const line = data.toString();
      outputs.push({ type: 'stdout', data: line, time: Date.now() });
      logger.debug(`[stdout] ${line.trim()}`);
    });

    child.stderr.on('data', (data) => {
      const line = data.toString();
      outputs.push({ type: 'stderr', data: line, time: Date.now() });
      logger.debug(`[stderr] ${line.trim()}`);
    });

    child.on('close', (code) => {
      logger.info(`Command exited with code: ${code}`);
      resolve({
        success: code === 0,
        exitCode: code,
        outputs
      });
    });

    child.on('error', (error) => {
      logger.error(`Command error: ${error.message}`);
      outputs.push({ type: 'error', data: error.message, time: Date.now() });
      resolve({
        success: false,
        exitCode: -1,
        error: error.message,
        outputs
      });
    });
  });
}

/**
 * 检测 Node.js 版本
 */
async function checkNodeVersion() {
  const result = await executeCommand('node --version', require('../config').WORK_DIR);
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version };
  }
  return { installed: false, version: null };
}

/**
 * 检测 Python 版本
 */
async function checkPythonVersion() {
  let result = await executeCommand('python3 --version', require('../config').WORK_DIR);
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version, command: 'python3' };
  }
  result = await executeCommand('python --version', require('../config').WORK_DIR);
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version, command: 'python' };
  }
  return { installed: false, version: null, command: null };
}

/**
 * 检测 Docker
 */
async function checkDockerVersion() {
  const result = await executeCommand('docker --version', require('../config').WORK_DIR);
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version };
  }
  return { installed: false, version: null };
}

/**
 * 环境检测
 */
async function checkEnvironment(types) {
  const env = {};
  if (types.includes('nodejs')) env.node = await checkNodeVersion();
  if (types.includes('python')) env.python = await checkPythonVersion();
  if (types.includes('docker')) env.docker = await checkDockerVersion();
  return env;
}

/**
 * 自动部署
 */
async function autoDeploy(project, onProgress) {
  const { local_path, project_type, name } = project;
  const types = project_type ? project_type.split(',') : [];

  const progress = (msg, data = {}) => {
    logger.info(`[Deploy] ${msg}`);
    if (onProgress) onProgress({ message: msg, ...data });
  };

  const results = [];

  try {
    progress('开始部署...', { step: 'start' });

    if (types.includes('nodejs')) {
      progress('安装 Node.js 依赖...', { step: 'install' });
      const hasYarn = await fs.pathExists(path.join(local_path, 'yarn.lock'));
      const hasPnpm = await fs.pathExists(path.join(local_path, 'pnpm-lock.yaml'));
      const installCmd = hasPnpm ? 'pnpm install' : hasYarn ? 'yarn install' : 'npm install';
      const installResult = await executeCommand(installCmd, local_path);
      results.push({ step: 'install', ...installResult });

      if (!installResult.success) {
        progress('依赖安装失败', { step: 'error' });
        return { success: false, results };
      }
      progress('依赖安装完成', { step: 'installed' });
    }

    if (types.includes('python')) {
      const pyInfo = await checkPythonVersion();
      if (!pyInfo.installed) {
        return { success: false, results, error: 'Python 未安装' };
      }
      const reqFile = await fs.pathExists(path.join(local_path, 'requirements.txt'));
      if (reqFile) {
        progress('安装 Python 依赖...', { step: 'install' });
        const installResult = await executeCommand(`pip3 install -r requirements.txt`, local_path);
        results.push({ step: 'pip_install', ...installResult });
      }
    }

    progress('部署完成', { step: 'done' });
    return { success: true, results };

  } catch (err) {
    logger.error('autoDeploy error:', err);
    return { success: false, results, error: err.message };
  }
}

/**
 * 生成手动部署指南
 */
function generateManualGuide(project) {
  const types = project.project_type ? project.project_type.split(',') : [];
  let guide = `# ${project.name} 部署指南\n\n`;

  guide += `## 前置要求\n\n`;
  if (types.includes('nodejs')) guide += `- Node.js >= 18\n- npm / yarn / pnpm\n`;
  if (types.includes('python')) guide += `- Python 3.8+\n- pip\n`;
  if (types.includes('docker')) guide += `- Docker\n`;
  guide += `\n`;

  guide += `## 部署步骤\n\n`;
  guide += `### 1. 克隆仓库\n\n\`\`\`bash\ngit clone ${project.repo_url}\ncd ${project.name}\n\`\`\`\n\n`;

  if (types.includes('nodejs')) {
    guide += `### 2. 安装依赖\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n`;
    guide += `### 3. 启动项目\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n`;
  } else if (types.includes('python')) {
    guide += `### 2. 创建虚拟环境\n\n\`\`\`bash\npython3 -m venv venv\nsource venv/bin/activate  # Linux/Mac\n# 或: venv\\Scripts\\activate  # Windows\n\`\`\`\n\n`;
    guide += `### 3. 安装依赖\n\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n`;
    guide += `### 4. 启动项目\n\n\`\`\`bash\npython main.py\n\`\`\`\n\n`;
  } else if (types.includes('docker')) {
    guide += `### 2. 构建 Docker 镜像\n\n\`\`\`bash\ndocker build -t ${project.name} .\n\`\`\`\n\n`;
    guide += `### 3. 运行容器\n\n\`\`\`bash\ndocker run -d --name ${project.name} -p 3000:3000 ${project.name}\n\`\`\`\n\n`;
  }

  if (project.envExample) {
    guide += `## 环境变量配置\n\n请复制 \`.env.example\` 为 \`.env\` 并填写相应值：\n\n\`\`\`bash\ncp .env.example .env\n# 编辑 .env 文件\n\`\`\`\n\n`;
  }

  guide += `## 常见问题\n\n`;
  if (types.includes('nodejs')) {
    guide += `### npm install 失败\n- 尝试清除缓存: \`npm cache clean --force\`\n- 使用淘宝镜像: \`npm config set registry https://registry.npmmirror.com\`\n\n`;
  }
  guide += `### 端口被占用\n- 修改配置文件中的端口号\n- 或杀死占用端口的进程\n\n`;

  return guide;
}

module.exports = {
  checkEnvironment,
  autoDeploy,
  generateManualGuide,
  executeCommand,
  validateCommand,
};

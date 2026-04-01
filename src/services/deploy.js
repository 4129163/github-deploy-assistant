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
      timeout: parseInt(process.env.DEPLOY_TIMEOUT_MS, 10) || 600000, // 默认10分钟，可通过 DEPLOY_TIMEOUT_MS 环境变量调整
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

    // 部署前环境检测
    const { detectForProject } = require('./env-detector');
    progress('检测运行环境...', { step: 'env_check' });
    const envCheck = await detectForProject(types);
    if (!envCheck.all_ok) {
      const missing = envCheck.missing.map(m => m.name).join('、');
      const hint = envCheck.missing.map(m => m.install_cmd ? `${m.name}: ${m.install_cmd}` : m.name).join('\n');
      progress(`⚠️ 缺少运行环境: ${missing}\n\n安装建议:\n${hint}`, {
        step: 'env_missing',
        missing: envCheck.missing,
        auto_installable: envCheck.missing.some(m => m.install_cmd)
      });
      // 非致命：给出警告但继续（用户可在部署页面点击安装）
    } else {
      progress(`✅ 运行环境检测通过`, { step: 'env_ok' });
    }

    if (types.includes('nodejs')) {
      progress('安装 Node.js 依赖...', { step: 'install' });
      const hasYarn = await fs.pathExists(path.join(local_path, 'yarn.lock'));
      const hasPnpm = await fs.pathExists(path.join(local_path, 'pnpm-lock.yaml'));
      const installCmd = hasPnpm ? 'pnpm install --ignore-scripts' : hasYarn ? 'yarn install --ignore-scripts' : 'npm install --ignore-scripts';

      // 验证 Node.js 版本是否满足 package.json engines 字段
      try {
        const pkg = await fs.readJson(path.join(local_path, 'package.json'));
        const requiredRange = pkg.engines?.node;
        if (requiredRange) {
          const currentVer = process.version; // e.g. v22.22.1
          progress(`检测 Node.js 版本兼容性: 当前 ${currentVer}，要求 ${requiredRange}`, { step: 'version_check' });
          // 简单检测：major 版本号对比（不引入 semver 依赖）
          const currentMajor = parseInt(currentVer.replace('v', '').split('.')[0], 10);
          const reqMatch = requiredRange.match(/(\d+)/);
          const reqMajor = reqMatch ? parseInt(reqMatch[1], 10) : 0;
          if (reqMajor > currentMajor) {
            progress(`⚠️ 警告：当前 Node.js ${currentVer} 可能低于项目要求 ${requiredRange}，继续尝试安装...`, { step: 'version_warn' });
          }
        }
      } catch (_) {}

      const installResult = await executeCommand(installCmd, local_path);
      results.push({ step: 'install', ...installResult });

      if (!installResult.success) {
        // 安装失败时提供重试建议
        const retryMsg = `依赖安装失败。建议：1) 检查网络；2) 清除缓存: npm cache clean --force；3) 切换镜像: npm config set registry https://registry.npmmirror.com`;
        progress(retryMsg, { step: 'error', retry_hint: retryMsg });
        return { success: false, results, retry_hint: retryMsg };
      }
      progress('依赖安装完成', { step: 'installed' });
    }

    if (types.includes('python')) {
      const pyInfo = await checkPythonVersion();
      if (!pyInfo.installed) {
        return { success: false, results, error: 'Python 未安装，请先安装 Python 3.8+' };
      }
      progress(`检测到 Python: ${pyInfo.version}`, { step: 'version_check' });

      // 检测 Python 版本是否满足 .python-version 或 pyproject.toml 的要求
      try {
        const pyVer = pyInfo.version.match(/Python (\d+)\.(\d+)/);
        const major = pyVer ? parseInt(pyVer[1], 10) : 0;
        const minor = pyVer ? parseInt(pyVer[2], 10) : 0;
        const pyVerFile = path.join(local_path, '.python-version');
        if (await fs.pathExists(pyVerFile)) {
          const reqVer = (await fs.readFile(pyVerFile, 'utf8')).trim();
          progress(`项目要求 Python ${reqVer}，当前 ${pyInfo.version}`, { step: 'version_check' });
        }
        if (major < 3 || (major === 3 && minor < 8)) {
          progress(`⚠️ 警告：当前 Python ${pyInfo.version} 建议升级至 3.8+ 以获得最佳兼容性`, { step: 'version_warn' });
        }
      } catch (_) {}

      const reqFile = await fs.pathExists(path.join(local_path, 'requirements.txt'));
      if (reqFile) {
        progress('安装 Python 依赖...', { step: 'install' });
        const installResult = await executeCommand(`pip3 install -r requirements.txt`, local_path);
        results.push({ step: 'pip_install', ...installResult });
        if (!installResult.success) {
          const retryMsg = `pip 安装失败。建议：1) pip3 install --upgrade pip；2) 使用镜像: pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`;
          progress(retryMsg, { step: 'error', retry_hint: retryMsg });
          return { success: false, results, retry_hint: retryMsg };
        }
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
  } else if (types.includes('go')) {
    guide += `### 2. 下载依赖\n\n\`\`\`bash\ngo mod download\n\`\`\`\n\n`;
    guide += `### 3. 构建并运行\n\n\`\`\`bash\ngo build -o main .\n./main\n\`\`\`\n\n`;
  } else if (types.includes('rust')) {
    guide += `### 2. 编译并运行\n\n\`\`\`bash\ncargo run --release\n\`\`\`\n\n`;
  } else if (types.includes('java')) {
    if (project.files && project.files.includes('pom.xml')) {
      guide += `### 2. 使用 Maven 构建\n\n\`\`\`bash\nmvn package\njava -jar target/*.jar\n\`\`\`\n\n`;
    } else if (project.files && project.files.includes('build.gradle')) {
      guide += `### 2. 使用 Gradle 构建\n\n\`\`\`bash\n./gradlew build\njava -jar build/libs/*.jar\n\`\`\`\n\n`;
    }
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

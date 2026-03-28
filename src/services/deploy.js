/**
 * 部署执行服务
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { DeployLogDB } = require('./database');

const ALLOW_AUTO_EXEC = process.env.ALLOW_AUTO_EXEC !== 'false';

/**
 * 执行命令（带输出捕获）
 */
function executeCommand(command, cwd, env = {}) {
  return new Promise((resolve) => {
    const outputs = [];
    
    logger.info(`Executing: ${command} in ${cwd}`);
    
    const child = exec(command, {
      cwd,
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
  const result = await executeCommand('node --version', process.cwd());
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
  // 先检测 python3
  let result = await executeCommand('python3 --version', process.cwd());
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version, command: 'python3' };
  }
  
  // 再检测 python
  result = await executeCommand('python --version', process.cwd());
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version, command: 'python' };
  }
  
  return { installed: false, version: null, command: null };
}

/**
 * 检测 Docker
 */
async function checkDocker() {
  const result = await executeCommand('docker --version', process.cwd());
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version };
  }
  return { installed: false, version: null };
}

/**
 * 检测 Git
 */
async function checkGit() {
  const result = await executeCommand('git --version', process.cwd());
  if (result.success) {
    const version = result.outputs[0]?.data?.trim();
    return { installed: true, version };
  }
  return { installed: false, version: null };
}

/**
 * 检查系统环境
 */
async function checkEnvironment() {
  logger.info('Checking system environment...');
  
  const [node, python, docker, git] = await Promise.all([
    checkNodeVersion(),
    checkPythonVersion(),
    checkDocker(),
    checkGit()
  ]);
  
  return {
    node,
    python,
    docker,
    git,
    platform: process.platform,
    arch: process.arch
  };
}

/**
 * 生成 Node.js 项目的部署脚本
 */
function generateNodeDeployScript(projectPath, packageJson) {
  const hasPackageLock = fs.existsSync(path.join(projectPath, 'package-lock.json'));
  const hasYarnLock = fs.existsSync(path.join(projectPath, 'yarn.lock'));
  const hasPnpmLock = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
  
  let installCmd = 'npm install';
  if (hasYarnLock) installCmd = 'yarn install';
  else if (hasPnpmLock) installCmd = 'pnpm install';
  
  const scripts = packageJson.scripts || {};
  const startScript = scripts.start ? 'npm start' : 
                      scripts.dev ? 'npm run dev' : 
                      'node index.js';
  
  return `#!/bin/bash
set -e

echo "🚀 开始部署 Node.js 项目..."

# 安装依赖
echo "📦 安装依赖..."
${installCmd}

# 构建（如果有 build 脚本）
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo "🔨 构建项目..."
  npm run build
fi

# 启动项目
echo "✅ 启动项目..."
${startScript}
`;
}

/**
 * 生成 Python 项目的部署脚本
 */
function generatePythonDeployScript(projectPath) {
  return `#!/bin/bash
set -e

echo "🚀 开始部署 Python 项目..."

# 检测 Python 命令
if command -v python3 &> /dev/null; then
    PYTHON=python3
    PIP=pip3
elif command -v python &> /dev/null; then
    PYTHON=python
    PIP=pip
else
    echo "❌ 未找到 Python"
    exit 1
fi

echo "📦 使用 Python: $PYTHON"

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
  echo "📦 创建虚拟环境..."
  $PYTHON -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
if [ -f "requirements.txt" ]; then
  echo "📦 安装依赖..."
  $PIP install -r requirements.txt
fi

# 启动项目
echo "✅ 启动项目..."
# 请根据实际情况修改启动命令
$PYTHON main.py
`;
}

/**
 * 生成 Docker 部署脚本
 */
function generateDockerDeployScript(projectPath) {
  return `#!/bin/bash
set -e

echo "🚀 开始 Docker 部署..."

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker build -t myapp .

# 运行容器
echo "✅ 启动容器..."
docker run -d --name myapp -p 3000:3000 myapp

echo "✨ 部署完成！访问 http://localhost:3000"
`;
}

/**
 * 执行部署（自动模式）
 */
async function autoDeploy(project, onProgress) {
  if (!ALLOW_AUTO_EXEC) {
    throw new Error('Auto deploy is disabled. Set ALLOW_AUTO_EXEC=true to enable.');
  }
  
  const projectPath = project.local_path;
  
  if (!projectPath || !(await fs.pathExists(projectPath))) {
    throw new Error('Project not found locally');
  }
  
  logger.info(`Auto deploying project: ${project.name}`);
  
  const outputs = [];
  
  const addOutput = (type, data) => {
    outputs.push({ type, data, time: Date.now() });
    if (onProgress) onProgress({ type, data });
  };
  
  try {
    // 1. 检查环境
    addOutput('info', '🔍 检查系统环境...');
    const env = await checkEnvironment();
    addOutput('info', `Node.js: ${env.node.installed ? env.node.version : '未安装'}`);
    addOutput('info', `Python: ${env.python.installed ? env.python.version : '未安装'}`);
    addOutput('info', `Docker: ${env.docker.installed ? env.docker.version : '未安装'}`);
    
    // 2. 根据项目类型部署
    const types = project.types || [];
    
    if (types.includes('nodejs')) {
      addOutput('info', '📦 检测到 Node.js 项目');
      
      // 检查 package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        addOutput('info', '📦 安装依赖...');
        const installResult = await executeCommand('npm install', projectPath);
        installResult.outputs.forEach(o => addOutput(o.type, o.data));
        
        if (!installResult.success) {
          throw new Error('依赖安装失败');
        }
        
        // 检查是否需要构建
        const pkg = await fs.readJson(packageJsonPath);
        if (pkg.scripts && pkg.scripts.build) {
          addOutput('info', '🔨 构建项目...');
          const buildResult = await executeCommand('npm run build', projectPath);
          buildResult.outputs.forEach(o => addOutput(o.type, o.data));
        }
        
        // 启动（如果需要）
        if (pkg.scripts && pkg.scripts.start) {
          addOutput('info', '✅ 项目已准备就绪，启动命令: npm start');
        }
      }
    } else if (types.includes('python')) {
      addOutput('info', '📦 检测到 Python 项目');
      
      if (await fs.pathExists(path.join(projectPath, 'requirements.txt'))) {
        addOutput('info', '📦 安装 Python 依赖...');
        const python = env.python.command || 'python3';
        const pip = python === 'python3' ? 'pip3' : 'pip';
        
        const installResult = await executeCommand(
          `${pip} install -r requirements.txt`,
          projectPath
        );
        installResult.outputs.forEach(o => addOutput(o.type, o.data));
      }
    } else if (types.includes('docker')) {
      addOutput('info', '🐳 检测到 Docker 项目');
      
      if (await fs.pathExists(path.join(projectPath, 'Dockerfile'))) {
        addOutput('info', '🔨 构建 Docker 镜像...');
        const buildResult = await executeCommand('docker build -t myapp .', projectPath);
        buildResult.outputs.forEach(o => addOutput(o.type, o.data));
      }
    }
    
    addOutput('info', '✅ 部署完成！');
    
    // 保存日志
    await DeployLogDB.create({
      project_id: project.id,
      mode: 'auto',
      status: 'success',
      output: JSON.stringify(outputs),
      error: null
    });
    
    return { success: true, outputs };
    
  } catch (error) {
    addOutput('error', `❌ 部署失败: ${error.message}`);
    
    await DeployLogDB.create({
      project_id: project.id,
      mode: 'auto',
      status: 'failed',
      output: JSON.stringify(outputs),
      error: error.message
    });
    
    throw error;
  }
}

/**
 * 生成手动部署指南
 */
async function generateManualGuide(project) {
  const types = project.types || [];
  const env = await checkEnvironment();
  
  let guide = `# ${project.name} 部署指南\n\n`;
  
  // 系统要求
  guide += `## 系统要求\n\n`;
  if (types.includes('nodejs')) {
    guide += `- Node.js ${project.packageJson?.nodeVersion || '>= 18.0.0'}\n`;
    guide += `- npm 或 yarn\n`;
  }
  if (types.includes('python')) {
    guide += `- Python 3.8+\n`;
    guide += `- pip\n`;
  }
  if (types.includes('docker')) {
    guide += `- Docker\n`;
    guide += `- Docker Compose (可选)\n`;
  }
  guide += `- Git\n\n`;
  
  // 当前环境状态
  guide += `## 当前环境检测\n\n`;
  guide += `- Node.js: ${env.node.installed ? `✅ ${env.node.version}` : '❌ 未安装'}\n`;
  guide += `- Python: ${env.python.installed ? `✅ ${env.python.version}` : '❌ 未安装'}\n`;
  guide += `- Docker: ${env.docker.installed ? `✅ ${env.docker.version}` : '❌ 未安装'}\n`;
  guide += `- Git: ${env.git.installed ? `✅ ${env.git.version}` : '❌ 未安装'}\n\n`;
  
  // 部署步骤
  guide += `## 部署步骤\n\n`;
  guide += `### 1. 克隆仓库\n\n`;
  guide += `\`\`\`bash\n`;
  guide += `git clone ${project.repo_url}\n`;
  guide += `cd ${project.name}\n`;
  guide += `\`\`\`\n\n`;
  
  if (types.includes('nodejs')) {
    guide += `### 2. 安装依赖\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `npm install\n`;
    guide += `# 或使用 yarn: yarn install\n`;
    guide += `\`\`\`\n\n`;
    
    if (project.packageJson?.scripts?.build) {
      guide += `### 3. 构建项目\n\n`;
      guide += `\`\`\`bash\n`;
      guide += `npm run build\n`;
      guide += `\`\`\`\n\n`;
    }
    
    guide += `### 4. 启动项目\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `npm start\n`;
    guide += `# 或: npm run dev\n`;
    guide += `\`\`\`\n\n`;
  } else if (types.includes('python')) {
    guide += `### 2. 创建虚拟环境（推荐）\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `python3 -m venv venv\n`;
    guide += `source venv/bin/activate  # Linux/Mac\n`;
    guide += `# 或: venv\\Scripts\\activate  # Windows\n`;
    guide += `\`\`\`\n\n`;
    
    guide += `### 3. 安装依赖\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `pip install -r requirements.txt\n`;
    guide += `\`\`\`\n\n`;
    
    guide += `### 4. 启动项目\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `python main.py\n`;
    guide += `\`\`\`\n\n`;
  } else if (types.includes('docker')) {
    guide += `### 2. 构建 Docker 镜像\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `docker build -t ${project.name} .\n`;
    guide += `\`\`\`\n\n`;
    
    guide += `### 3. 运行容器\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `docker run -d --name ${project.name} -p 3000:3000 ${project.name}\n`;
    guide += `\`\`\`\n\n`;
  }
  
  // 环境变量配置
  if (project.envExample) {
    guide += `## 环境变量配置\n\n`;
    guide += `请复制 \`.env.example\` 为 \`.env\` 并填写相应值：\n\n`;
    guide += `\`\`\`bash\n`;
    guide += `cp .env.example .env\n`;
    guide += `# 编辑 .env 文件\n`;
    guide += `\`\`\`\n\n`;
  }
  
  // 常见问题
  guide += `## 常见问题\n\n`;
  
  if (types.includes('nodejs')) {
    guide += `### npm install 失败\n`;
    guide += `- 尝试清除缓存: \`npm cache clean --force\`\n`;
    guide += `- 使用淘宝镜像: \`npm config set registry https://registry.npmmirror.com\`\n\n`;
  }
  
  guide += `### 端口被占用\n`;
  guide += `- 修改配置文件中的端口号\n`;
  guide += `- 或杀死占用端口的进程\n\n`;
  
  return guide;
}

module.exports = {
  checkEnvironment,
  autoDeploy,
  generateManualGuide,
  executeCommand,
  generateNodeDeployScript,
  generatePythonDeployScript,
  generateDockerDeployScript
};

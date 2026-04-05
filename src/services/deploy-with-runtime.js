/**
 * 支持容器运行时的部署服务
 * 提供完全资源隔离的部署选项
 */

const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { executeCommand } = require('./deploy');
const { ContainerRuntimeFactory } = require('./container-runtime');

/**
 * 部署项目，支持容器运行时
 * @param {Object} project - 项目对象
 * @param {Function} onProgress - 进度回调
 * @param {Object} options - 部署选项
 * @param {string} options.runtime - 运行时类型：'docker' 或默认（直接运行）
 * @param {number} options.port - 项目端口
 * @param {Object} options.env - 环境变量
 * @returns {Object} 部署结果
 */
async function deployWithRuntime(project, onProgress, options = {}) {
  const { local_path, project_type, name } = project;
  const types = project_type ? project_type.split(',') : [];
  const runtime = options.runtime || 'default';
  const port = options.port || 3000;
  const env = options.env || {};

  const progress = (msg, data = {}) => {
    logger.info(`[Deploy-Runtime] ${msg}`);
    if (onProgress) onProgress({ message: msg, ...data });
  };

  const results = [];

  try {
    progress(`开始部署 (运行时: ${runtime})...`, { step: 'start', runtime });

    if (runtime === 'docker') {
      // 使用 Docker 容器运行时
      return await deployWithDockerRuntime(project, progress, results, { port, env });
    } else {
      // 使用默认运行时（直接运行）
      return await deployWithDefaultRuntime(project, progress, results, { port, env });
    }
  } catch (err) {
    logger.error('deployWithRuntime error:', err);
    progress(`部署失败: ${err.message}`, { step: 'error', error: err.message });
    return { success: false, results, error: err.message };
  }
}

/**
 * 使用 Docker 容器运行时部署
 */
async function deployWithDockerRuntime(project, progress, results, options) {
  const { local_path, name } = project;
  const { port, env } = options;

  progress('初始化 Docker 容器运行时...', { step: 'runtime_init' });

  try {
    // 创建容器运行时
    const runtime = ContainerRuntimeFactory.createRuntime({
      runtime: 'docker',
      projectName: name,
      projectPath: local_path
    });

    // 检查 Docker 可用性
    const availability = await runtime.checkAvailability();
    if (!availability.available) {
      progress(`Docker 不可用: ${availability.error}`, { 
        step: 'runtime_unavailable', 
        error: availability.error 
      });
      return { 
        success: false, 
        results, 
        error: `Docker 运行时不可用: ${availability.error}` 
      };
    }

    progress(`Docker 可用: ${availability.version}`, { step: 'runtime_ready' });

    // 根据项目类型构建和运行
    const projectType = await detectProjectType(local_path);
    
    let runCommand = null;
    let dockerfileContent = null;

    // 根据项目类型设置运行命令和 Dockerfile
    switch (projectType) {
      case 'nodejs':
        dockerfileContent = generateNodejsDockerfile(local_path);
        runCommand = 'npm start';
        break;
      case 'python':
        dockerfileContent = generatePythonDockerfile(local_path);
        runCommand = 'python app.py';
        break;
      default:
        // 通用 Dockerfile
        dockerfileContent = generateGenericDockerfile();
        runCommand = null; // 使用默认 CMD
    }

    // 构建 Docker 镜像
    progress('构建 Docker 镜像...', { step: 'docker_build' });
    const buildResult = await runtime.buildImage(dockerfileContent);
    
    if (!buildResult.success) {
      progress(`镜像构建失败: ${buildResult.error}`, { 
        step: 'docker_build_failed', 
        error: buildResult.error 
      });
      return { success: false, results, error: `Docker 镜像构建失败: ${buildResult.error}` };
    }

    progress('镜像构建成功', { step: 'docker_build_success' });

    // 运行容器
    progress('启动 Docker 容器...', { step: 'docker_run' });
    const runResult = await runtime.runProject(runCommand, env, port);
    
    if (!runResult.success) {
      progress(`容器启动失败: ${runResult.error}`, { 
        step: 'docker_run_failed', 
        error: runResult.error 
      });
      return { success: false, results, error: `Docker 容器启动失败: ${runResult.error}` };
    }

    progress(`容器已启动: ${runResult.containerName} (端口: ${port})`, { 
      step: 'docker_run_success',
      containerName: runResult.containerName,
      port,
      imageTag: runResult.imageTag,
      networkName: runResult.networkName
    });

    // 等待一段时间确保容器完全启动
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 检查容器状态
    const status = await runtime.getStatus();
    if (status.running) {
      progress(`✅ 项目已在 Docker 容器中成功运行`, { 
        step: 'deploy_success',
        status: status.status,
        ports: status.ports
      });
    } else {
      progress(`⚠️ 容器状态异常: ${status.status}`, { 
        step: 'deploy_warning',
        status: status.status
      });
    }

    return { 
      success: true, 
      results,
      runtime: 'docker',
      containerInfo: {
        name: runResult.containerName,
        image: runResult.imageTag,
        port,
        network: runResult.networkName,
        status
      }
    };

  } catch (error) {
    logger.error('Docker runtime deployment error:', error);
    progress(`Docker 运行时部署失败: ${error.message}`, { 
      step: 'runtime_error', 
      error: error.message 
    });
    return { success: false, results, error: error.message };
  }
}

/**
 * 使用默认运行时部署（直接运行）
 */
async function deployWithDefaultRuntime(project, progress, results, options) {
  const { local_path, project_type, name } = project;
  const types = project_type ? project_type.split(',') : [];
  const { env } = options;

  // 使用原有的 autoDeploy 逻辑
  progress('使用默认运行时部署...', { step: 'default_runtime' });

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
  } else {
    progress(`✅ 运行环境检测通过`, { step: 'env_ok' });
  }

  if (types.includes('nodejs')) {
    progress('安装 Node.js 依赖...', { step: 'install' });
    const hasYarn = await fs.pathExists(path.join(local_path, 'yarn.lock'));
    const hasPnpm = await fs.pathExists(path.join(local_path, 'pnpm-lock.yaml'));
    const installCmd = hasPnpm ? 'pnpm install --ignore-scripts' : hasYarn ? 'yarn install --ignore-scripts' : 'npm install --ignore-scripts';

    const installResult = await executeCommand(installCmd, local_path, env);
    results.push({ step: 'install', ...installResult });

    if (!installResult.success) {
      const retryMsg = `依赖安装失败。建议：1) 检查网络；2) 清除缓存: npm cache clean --force；3) 切换镜像: npm config set registry https://registry.npmmirror.com`;
      progress(retryMsg, { step: 'error', retry_hint: retryMsg });
      return { success: false, results, retry_hint: retryMsg };
    }
    progress('依赖安装完成', { step: 'installed' });
  }

  if (types.includes('python')) {
    const { checkPythonVersion } = require('./deploy');
    const pyInfo = await checkPythonVersion();
    if (!pyInfo.installed) {
      return { success: false, results, error: 'Python 未安装，请先安装 Python 3.8+' };
    }

    const reqFile = await fs.pathExists(path.join(local_path, 'requirements.txt'));
    if (reqFile) {
      progress('安装 Python 依赖...', { step: 'install' });
      const installResult = await executeCommand(`pip3 install -r requirements.txt`, local_path, env);
      results.push({ step: 'pip_install', ...installResult });
      if (!installResult.success) {
        const retryMsg = `pip 安装失败。建议：1) pip3 install --upgrade pip；2) 使用镜像: pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`;
        progress(retryMsg, { step: 'error', retry_hint: retryMsg });
        return { success: false, results, retry_hint: retryMsg };
      }
    }
  }

  progress('部署完成', { step: 'done' });
  return { success: true, results, runtime: 'default' };
}

/**
 * 检测项目类型
 */
async function detectProjectType(projectPath) {
  const hasPackageJson = await fs.pathExists(path.join(projectPath, 'package.json'));
  const hasRequirementsTxt = await fs.pathExists(path.join(projectPath, 'requirements.txt'));
  const hasPomXml = await fs.pathExists(path.join(projectPath, 'pom.xml'));
  const hasGoMod = await fs.pathExists(path.join(projectPath, 'go.mod'));
  const hasCargoToml = await fs.pathExists(path.join(projectPath, 'Cargo.toml'));

  if (hasPackageJson) return 'nodejs';
  if (hasRequirementsTxt) return 'python';
  if (hasPomXml) return 'java';
  if (hasGoMod) return 'go';
  if (hasCargoToml) return 'rust';
  
  return 'generic';
}

/**
 * 生成 Node.js Dockerfile
 */
async function generateNodejsDockerfile(projectPath) {
  try {
    const pkg = await fs.readJson(path.join(projectPath, 'package.json'));
    const mainFile = pkg.main || 'index.js';
    const startCommand = pkg.scripts?.start || 'node ' + mainFile;

    return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["sh", "-c", "${startCommand}"]`;
  } catch (error) {
    // 默认 Node.js Dockerfile
    return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]`;
  }
}

/**
 * 生成 Python Dockerfile
 */
async function generatePythonDockerfile(projectPath) {
  return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`;
}

/**
 * 生成通用 Dockerfile
 */
function generateGenericDockerfile() {
  return `FROM alpine:latest
WORKDIR /app
COPY . .
CMD ["sh", "-c", "echo '项目部署成功' && tail -f /dev/null"]`;
}

/**
 * 获取可用的运行时选项
 */
async function getRuntimeOptions() {
  const runtimes = await ContainerRuntimeFactory.getAvailableRuntimes();
  
  const options = [
    {
      value: 'default',
      label: '默认运行时（直接运行）',
      description: '在当前环境中直接运行项目'
    }
  ];

  if (runtimes.some(r => r.type === 'docker' && r.available)) {
    options.push({
      value: 'docker',
      label: 'Docker 容器运行时',
      description: '在独立 Docker 容器中运行，完全资源隔离'
    });
  }

  return options;
}

module.exports = {
  deployWithRuntime,
  getRuntimeOptions,
  ContainerRuntimeFactory
};
/**
 * 编排部署执行器
 * 负责按顺序部署应用，管理网络配置，监控健康检查
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');

// 简单的命令执行函数
async function executeCommand(command, cwd = process.cwd(), env = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          exitCode: error.code || -1,
          error: error.message,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      } else {
        resolve({
          success: true,
          exitCode: 0,
          stdout: stdout || '',
          stderr: stderr || ''
        });
      }
    });
  });
}

// 简单的部署状态管理器
class SimpleDeployStateManager {
  constructor() {
    this.statesDir = path.join(process.cwd(), 'deploy-states');
  }
  
  async ensureDirectories() {
    await fs.mkdir(this.statesDir, { recursive: true });
  }
}

class OrchestrationDeployer {
  constructor(config) {
    this.config = config;
    this.deploymentId = uuidv4();
    this.stateManager = new SimpleDeployStateManager();
    this.deploymentState = {
      id: this.deploymentId,
      name: config.name,
      status: 'pending',
      startTime: null,
      endTime: null,
      applications: {},
      networks: {},
      errors: []
    };
  }

  /**
   * 执行编排部署
   * @returns {Object} 部署结果
   */
  async deploy() {
    try {
      logger.info(`开始编排部署: ${this.config.name} (ID: ${this.deploymentId})`);
      
      this.deploymentState.startTime = new Date().toISOString();
      this.deploymentState.status = 'running';

      // 1. 创建网络
      await this.createNetworks();

      // 2. 启动依赖服务
      await this.startDependencies();

      // 3. 按顺序部署应用
      const startupOrder = this.config.startup_order || [];
      for (const appName of startupOrder) {
        await this.deployApplication(appName);
      }

      // 4. 等待所有服务健康
      await this.waitForHealthChecks();

      this.deploymentState.status = 'completed';
      this.deploymentState.endTime = new Date().toISOString();

      logger.info(`编排部署完成: ${this.config.name}`);
      
      return {
        success: true,
        deploymentId: this.deploymentId,
        state: this.deploymentState
      };

    } catch (error) {
      logger.error(`编排部署失败: ${error.message}`);
      
      this.deploymentState.status = 'failed';
      this.deploymentState.endTime = new Date().toISOString();
      this.deploymentState.errors.push(error.message);

      // 尝试停止已启动的服务
      await this.cleanup();

      return {
        success: false,
        deploymentId: this.deploymentId,
        error: error.message,
        state: this.deploymentState
      };
    }
  }

  /**
   * 创建网络
   */
  async createNetworks() {
    if (!this.config.networks || this.config.networks.length === 0) {
      logger.info('未配置网络，使用默认网络');
      return;
    }

    logger.info(`创建 ${this.config.networks.length} 个网络`);
    
    for (const network of this.config.networks) {
      try {
        const networkName = `orchestration-${this.deploymentId}-${network.name}`;
        
        // 检查网络是否已存在
        const checkCmd = `docker network ls --filter name=${networkName} --format "{{.Name}}"`;
        const existingNetworks = await this.executeCommand(checkCmd);
        
        if (existingNetworks.stdout.trim() === networkName) {
          logger.info(`网络已存在: ${networkName}`);
          this.deploymentState.networks[network.name] = {
            name: networkName,
            status: 'existing'
          };
          continue;
        }

        // 创建网络
        const createCmd = `docker network create ${networkName}`;
        if (network.driver) {
          createCmd += ` --driver ${network.driver}`;
        }
        if (network.subnet) {
          createCmd += ` --subnet ${network.subnet}`;
        }

        const result = await this.executeCommand(createCmd);
        
        if (result.success) {
          logger.info(`网络创建成功: ${networkName}`);
          this.deploymentState.networks[network.name] = {
            name: networkName,
            status: 'created',
            driver: network.driver,
            subnet: network.subnet
          };
        } else {
          throw new Error(`创建网络失败: ${result.error}`);
        }

      } catch (error) {
        logger.error(`创建网络 ${network.name} 失败: ${error.message}`);
        this.deploymentState.networks[network.name] = {
          status: 'failed',
          error: error.message
        };
        throw error;
      }
    }
  }

  /**
   * 启动依赖服务
   */
  async startDependencies() {
    if (!this.config.dependencies || this.config.dependencies.length === 0) {
      logger.info('无外部依赖服务');
      return;
    }

    logger.info(`启动 ${this.config.dependencies.length} 个依赖服务`);
    
    for (const dependency of this.config.dependencies) {
      try {
        await this.startDependency(dependency);
      } catch (error) {
        logger.error(`启动依赖服务 ${dependency.name} 失败: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * 启动单个依赖服务
   * @param {Object} dependency - 依赖服务配置
   */
  async startDependency(dependency) {
    logger.info(`启动依赖服务: ${dependency.name}`);
    
    const containerName = `orchestration-${this.deploymentId}-${dependency.name}`;
    
    // 检查容器是否已运行
    const checkCmd = `docker ps --filter name=${containerName} --format "{{.Names}}"`;
    const existingContainers = await this.executeCommand(checkCmd);
    
    if (existingContainers.stdout.trim() === containerName) {
      logger.info(`依赖服务已运行: ${containerName}`);
      this.deploymentState.applications[dependency.name] = {
        name: dependency.name,
        type: 'dependency',
        status: 'running',
        containerName: containerName
      };
      return;
    }

    // 停止同名容器（如果存在）
    const stopCmd = `docker stop ${containerName} 2>/dev/null || true`;
    await this.executeCommand(stopCmd);
    
    // 删除旧容器
    const rmCmd = `docker rm ${containerName} 2>/dev/null || true`;
    await this.executeCommand(rmCmd);

    // 构建Docker运行命令
    let runCmd = `docker run -d --name ${containerName}`;
    
    // 添加网络配置
    if (dependency.networks && Array.isArray(dependency.networks)) {
      dependency.networks.forEach(network => {
        const networkName = this.deploymentState.networks[network]?.name || network;
        runCmd += ` --network ${networkName}`;
      });
    } else {
      // 默认加入第一个网络
      const defaultNetwork = Object.values(this.deploymentState.networks)[0];
      if (defaultNetwork) {
        runCmd += ` --network ${defaultNetwork.name}`;
      }
    }

    // 添加环境变量
    if (dependency.environment && Array.isArray(dependency.environment)) {
      dependency.environment.forEach(env => {
        runCmd += ` -e "${env}"`;
      });
    }

    // 添加端口映射
    if (dependency.ports && Array.isArray(dependency.ports)) {
      dependency.ports.forEach(port => {
        runCmd += ` -p ${port}`;
      });
    }

    // 添加卷映射
    if (dependency.volumes && Array.isArray(dependency.volumes)) {
      dependency.volumes.forEach(volume => {
        runCmd += ` -v ${volume}`;
      });
    }

    // 添加镜像
    runCmd += ` ${dependency.image}`;

    // 执行命令
    const result = await this.executeCommand(runCmd);
    
    if (result.success) {
      logger.info(`依赖服务启动成功: ${dependency.name}`);
      this.deploymentState.applications[dependency.name] = {
        name: dependency.name,
        type: 'dependency',
        status: 'running',
        containerName: containerName,
        containerId: result.stdout.trim()
      };
    } else {
      throw new Error(`启动依赖服务失败: ${result.error}`);
    }
  }

  /**
   * 部署应用
   * @param {string} appName - 应用名称
   */
  async deployApplication(appName) {
    const app = this.config.applications.find(a => a.name === appName);
    if (!app) {
      throw new Error(`应用未找到: ${appName}`);
    }

    logger.info(`部署应用: ${app.name} (类型: ${app.type})`);
    
    try {
      this.deploymentState.applications[app.name] = {
        name: app.name,
        type: app.type,
        status: 'deploying',
        startTime: new Date().toISOString()
      };

      // 根据应用类型执行不同的部署逻辑
      switch (app.type) {
        case 'docker':
          await this.deployDockerApp(app);
          break;
        case 'docker-compose':
          await this.deployDockerComposeApp(app);
          break;
        case 'node':
        case 'python':
        case 'go':
        case 'java':
          await this.deploySourceApp(app);
          break;
        case 'custom':
          await this.deployCustomApp(app);
          break;
        default:
          throw new Error(`不支持的应用类型: ${app.type}`);
      }

      this.deploymentState.applications[app.name].status = 'deployed';
      this.deploymentState.applications[app.name].endTime = new Date().toISOString();
      
      logger.info(`应用部署成功: ${app.name}`);

    } catch (error) {
      logger.error(`应用部署失败: ${app.name} - ${error.message}`);
      
      this.deploymentState.applications[app.name].status = 'failed';
      this.deploymentState.applications[app.name].endTime = new Date().toISOString();
      this.deploymentState.applications[app.name].error = error.message;
      
      throw error;
    }
  }

  /**
   * 部署Docker应用
   * @param {Object} app - 应用配置
   */
  async deployDockerApp(app) {
    const containerName = `orchestration-${this.deploymentId}-${app.name}`;
    
    // 检查容器是否已运行
    const checkCmd = `docker ps --filter name=${containerName} --format "{{.Names}}"`;
    const existingContainers = await this.executeCommand(checkCmd);
    
    if (existingContainers.stdout.trim() === containerName) {
      logger.info(`Docker应用已运行: ${containerName}`);
      this.deploymentState.applications[app.name].containerName = containerName;
      this.deploymentState.applications[app.name].status = 'running';
      return;
    }

    // 停止同名容器
    const stopCmd = `docker stop ${containerName} 2>/dev/null || true`;
    await this.executeCommand(stopCmd);
    
    // 删除旧容器
    const rmCmd = `docker rm ${containerName} 2>/dev/null || true`;
    await this.executeCommand(rmCmd);

    // 构建Docker运行命令
    let runCmd = `docker run -d --name ${containerName}`;
    
    // 添加网络配置
    if (app.networks && Array.isArray(app.networks)) {
      app.networks.forEach(network => {
        const networkName = this.deploymentState.networks[network]?.name || network;
        runCmd += ` --network ${networkName}`;
      });
    } else {
      // 默认加入第一个网络
      const defaultNetwork = Object.values(this.deploymentState.networks)[0];
      if (defaultNetwork) {
        runCmd += ` --network ${defaultNetwork.name}`;
      }
    }

    // 添加环境变量
    if (app.environment && Array.isArray(app.environment)) {
      app.environment.forEach(env => {
        runCmd += ` -e "${env}"`;
      });
    }

    // 添加端口映射
    if (app.ports && Array.isArray(app.ports)) {
      app.ports.forEach(port => {
        runCmd += ` -p ${port}`;
      });
    }

    // 添加卷映射
    if (app.volumes && Array.isArray(app.volumes)) {
      app.volumes.forEach(volume => {
        runCmd += ` -v ${volume}`;
      });
    }

    // 添加镜像
    runCmd += ` ${app.source}`;

    // 添加自定义命令
    if (app.command) {
      runCmd += ` ${app.command}`;
    }

    // 执行命令
    const result = await this.executeCommand(runCmd);
    
    if (result.success) {
      this.deploymentState.applications[app.name].containerName = containerName;
      this.deploymentState.applications[app.name].containerId = result.stdout.trim();
    } else {
      throw new Error(`Docker应用启动失败: ${result.error}`);
    }
  }

  /**
   * 部署Docker Compose应用
   * @param {Object} app - 应用配置
   */
  async deployDockerComposeApp(app) {
    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', this.deploymentId, app.name);
    await fs.ensureDir(tempDir);

    try {
      // 克隆仓库
      const cloneCmd = `git clone ${app.source} ${tempDir}`;
      if (app.version && app.version !== 'latest') {
        cloneCmd += ` --branch ${app.version}`;
      }
      
      const cloneResult = await this.executeCommand(cloneCmd);
      if (!cloneResult.success) {
        throw new Error(`克隆仓库失败: ${cloneResult.error}`);
      }

      // 创建自定义docker-compose文件
      const composeContent = this.generateDockerCompose(app, tempDir);
      const composePath = path.join(tempDir, 'docker-compose.orchestration.yml');
      await fs.writeFile(composePath, composeContent);

      // 启动docker-compose
      const upCmd = `docker-compose -f ${composePath} up -d`;
      const upResult = await this.executeCommand(upCmd, tempDir);
      
      if (!upResult.success) {
        throw new Error(`Docker Compose启动失败: ${upResult.error}`);
      }

      this.deploymentState.applications[app.name].workspace = tempDir;
      this.deploymentState.applications[app.name].composeFile = composePath;

    } catch (error) {
      // 清理临时目录
      await fs.remove(tempDir).catch(() => {});
      throw error;
    }
  }

  /**
   * 生成Docker Compose配置
   * @param {Object} app - 应用配置
   * @param {string} workspace - 工作目录
   * @returns {string} docker-compose内容
   */
  generateDockerCompose(app, workspace) {
    const services = {};
    const networks = {};
    
    // 添加网络配置
    if (app.networks && Array.isArray(app.networks)) {
      app.networks.forEach(network => {
        const networkName = this.deploymentState.networks[network]?.name || network;
        networks[network] = {
          external: true,
          name: networkName
        };
      });
    }

    // 主服务配置
    services[app.name] = {
      build: workspace,
      environment: app.environment || [],
      ports: app.ports || [],
      volumes: app.volumes || [],
      networks: app.networks || [],
      ...(app.command ? { command: app.command } : {})
    };

    return `version: '3.8'
services:
  ${JSON.stringify(services, null, 2).slice(2, -2)}

networks:
  ${JSON.stringify(networks, null, 2).slice(2, -2)}`;
  }

  /**
   * 部署源码应用
   * @param {Object} app - 应用配置
   */
  async deploySourceApp(app) {
    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', this.deploymentId, app.name);
    await fs.ensureDir(tempDir);

    try {
      // 克隆仓库
      const cloneCmd = `git clone ${app.source} ${tempDir}`;
      if (app.version && app.version !== 'latest') {
        cloneCmd += ` --branch ${app.version}`;
      }
      
      const cloneResult = await this.executeCommand(cloneCmd);
      if (!cloneResult.success) {
        throw new Error(`克隆仓库失败: ${cloneResult.error}`);
      }

      // 根据应用类型执行安装
      switch (app.type) {
        case 'node':
          await this.installNodeApp(tempDir, app);
          break;
        case 'python':
          await this.installPythonApp(tempDir, app);
          break;
        case 'go':
          await this.installGoApp(tempDir, app);
          break;
        case 'java':
          await this.installJavaApp(tempDir, app);
          break;
      }

      this.deploymentState.applications[app.name].workspace = tempDir;

    } catch (error) {
      // 清理临时目录
      await fs.remove(tempDir).catch(() => {});
      throw error;
    }
  }

  /**
   * 安装Node.js应用
   * @param {string} workspace - 工作目录
   * @param {Object} app - 应用配置
   */
  async installNodeApp(workspace, app) {
    // 安装依赖
    const installCmd = 'npm install';
    const installResult = await this.executeCommand(installCmd, workspace);
    
    if (!installResult.success) {
      throw new Error(`安装Node.js依赖失败: ${installResult.error}`);
    }

    // 构建应用
    const buildCmd = 'npm run build';
    const buildResult = await this.executeCommand(buildCmd, workspace);
    
    if (!buildResult.success) {
      logger.warn(`构建失败，尝试直接启动: ${buildResult.error}`);
    }

    // 启动应用
    const startCmd = app.command || 'npm start';
    const envVars = app.environment || [];
    
    const env = {};
    envVars.forEach(envVar => {
      const [key, value] = envVar.split('=');
      env[key] = value;
    });

    // 在后台启动应用
    const spawnResult = await this.spawnCommand(startCmd, workspace, env);
    
    this.deploymentState.applications[app.name].process = spawnResult;
  }

  /**
   * 安装Python应用
   * @param {string} workspace - 工作目录
   * @param {Object} app - 应用配置
   */
  async installPythonApp(workspace, app) {
    // 创建虚拟环境
    const venvCmd = 'python -m venv venv';
    const venvResult = await this.executeCommand(venvCmd, workspace);
    
    if (!venvResult.success) {
      throw new Error(`创建Python虚拟环境失败: ${venvResult.error}`);
    }

    // 安装依赖
    const pipCmd = process.platform === 'win32' 
      ? 'venv\\Scripts\\pip install -r requirements.txt'
      : 'venv/bin/pip install -r requirements.txt';
    
    const pipResult = await this.executeCommand(pipCmd, workspace);
    
    if (!pipResult.success) {
      throw new Error(`安装Python依赖失败: ${pipResult.error}`);
    }

    // 启动应用
    const startCmd = app.command || 'python app.py';
    const envVars = app.environment || [];
    
    const env = { ...process.env };
    envVars.forEach(envVar => {
      const [key, value] = envVar.split('=');
      env[key] = value;
    });

    // 在后台启动应用
    const spawnResult = await this.spawnCommand(startCmd, workspace, env);
    
    this.deploymentState.applications[app.name].process = spawnResult;
  }

  /**
   * 部署自定义应用
   * @param {Object} app - 应用配置
   */
  async deployCustomApp(app) {
    if (!app.command) {
      throw new Error('自定义应用必须提供command字段');
    }

    const envVars = app.environment || [];
    const env = {};
    envVars.forEach(envVar => {
      const [key, value] = envVar.split('=');
      env[key] = value;
    });

    const workspace = app.workspace || process.cwd();
    const spawnResult = await this.spawnCommand(app.command, workspace, env);
    
    this.deploymentState.applications[app.name].process = spawnResult;
  }

  /**
   * 等待健康检查
   */
  async waitForHealthChecks() {
    logger.info('等待服务健康检查...');
    
    const appsWithHealthCheck = this.config.applications.filter(app => app.health_check);
    
    for (const app of appsWithHealthCheck) {
      await this.waitForAppHealth(app);
    }
    
    logger.info('所有服务健康检查通过');
  }

  /**
   * 等待应用健康
   * @param {Object} app - 应用配置
   */
  async waitForAppHealth(app) {
    const healthCheck = app.health_check;
    const maxRetries = healthCheck.retries || 3;
    const interval = healthCheck.interval || 30;
    const timeout = healthCheck.timeout || 10;

    logger.info(`等待应用健康: ${app.name} (重试: ${maxRetries}, 间隔: ${interval}s)`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isHealthy = await this.checkAppHealth(app);
        
        if (isHealthy) {
          logger.info(`应用健康检查通过: ${app.name}`);
          return;
        }
        
        logger.info(`应用健康检查未通过: ${app.name} (尝试 ${attempt}/${maxRetries})`);
        
        if (attempt < maxRetries) {
          await this.sleep(interval * 1000);
        }
        
      } catch (error) {
        logger.warn(`健康检查出错: ${app.name} - ${error.message}`);
        
        if (attempt < maxRetries) {
          await this.sleep(interval * 1000);
        }
      }
    }

    throw new Error(`应用健康检查失败: ${app.name} (重试 ${maxRetries} 次后未通过)`);
  }

  /**
   * 检查应用健康状态
   * @param {Object} app - 应用配置
   * @returns {boolean} 是否健康
   */
  async checkAppHealth(app) {
    const healthCheck = app.health_check;
    
    if (healthCheck.endpoint) {
      // HTTP健康检查
      const containerInfo = this.deploymentState.applications[app.name];
      const port = app.ports && app.ports[0] ? app.ports[0].split(':')[0] : null;
      
      if (!port) {
        logger.warn(`应用 ${app.name} 未配置端口，跳过HTTP健康检查`);
        return true;
      }

      const healthUrl = `http://localhost:${port}${healthCheck.endpoint}`;
      const curlCmd = `curl -s -o /dev/null -w "%{http_code}" --connect-timeout ${healthCheck.timeout || 10} ${healthUrl}`;
      
      const result = await this.executeCommand(curlCmd);
      
      if (result.success && result.stdout.trim() === '200') {
        return true;
      }
      
      return false;
    } else {
      // 进程健康检查
      const containerInfo = this.deploymentState.applications[app.name];
      
      if (containerInfo.containerName) {
        // Docker容器检查
        const checkCmd = `docker ps --filter name=${containerInfo.containerName} --filter status=running --format "{{.Names}}"`;
        const result = await this.executeCommand(checkCmd);
        
        return result.success && result.stdout.trim() === containerInfo.containerName;
      } else if (containerInfo.process) {
        // 进程检查
        return containerInfo.process.exitCode === null; // 进程仍在运行
      }
    }

    return true; // 无健康检查配置，默认健康
  }

  /**
   * 清理部署
   */
  async cleanup() {
    logger.info(`清理部署: ${this.deploymentId}`);
    
    try {
      // 停止所有容器
      const stopCmd = `docker ps --filter name=orchestration-${this.deploymentId} -q | xargs -r docker stop`;
      await this.executeCommand(stopCmd).catch(() => {});
      
      // 删除所有容器
      const rmCmd = `docker ps -a --filter name=orchestration-${this.deploymentId} -q | xargs -r docker rm -f`;
      await this.executeCommand(rmCmd).catch(() => {});
      
      // 删除临时目录
      const tempDir = path.join(process.cwd(), 'temp', this.deploymentId);
      await fs.remove(tempDir).catch(() => {});
      
      logger.info(`部署清理完成: ${this.deploymentId}`);
      
    } catch (error) {
      logger.error(`清理部署失败: ${error.message}`);
    }
  }

  /**
   * 执行命令
   * @param {string} command - 命令
   * @param {string} cwd - 工作目录
   * @param {Object} env - 环境变量
   * @returns {Object} 执行结果
   */
  async executeCommand(command, cwd = process.cwd(), env = {}) {
    return executeCommand(command, cwd, env);
  }

  /**
   * 生成命令
   * @param {string} command - 命令
   * @param {string} cwd - 工作目录
   * @param {Object} env - 环境变量
   * @returns {Object} 生成结果
   */
  async spawnCommand(command, cwd = process.cwd(), env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd,
        env: { ...process.env, ...env },
        stdio: 'pipe'
      });

      const result = {
        pid: child.pid,
        exitCode: null,
        stdout: '',
        stderr: ''
      };

      child.stdout.on('data', (data) => {
        result.stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        result.stderr += data.toString();
      });

      child.on('close', (code) => {
        result.exitCode = code;
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 睡眠
   * @param {number} ms - 毫秒数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取部署状态
   * @returns {Object} 部署状态
   */
  getState() {
    return { ...this.deploymentState };
  }

  /**
   * 获取应用日志
   * @param {string} appName - 应用名称
   * @returns {string} 应用日志
   */
  async getAppLogs(appName) {
    const appState = this.deploymentState.applications[appName];
    
    if (!appState) {
      throw new Error(`应用未找到: ${appName}`);
    }

    if (appState.containerName) {
      // Docker容器日志
      const logsCmd = `docker logs ${appState.containerName} --tail 100`;
      const result = await this.executeCommand(logsCmd);
      
      if (result.success) {
        return result.stdout;
      } else {
        return result.error;
      }
    } else if (appState.process) {
      // 进程日志
      return appState.process.stdout || '无日志';
    }

    return '无可用日志';
  }
}

module.exports = { OrchestrationDeployer };
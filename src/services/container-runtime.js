/**
 * 容器运行时适配层 - 支持完全资源隔离
 * 提供基于 Docker 的运行时，每个项目运行在独立容器中
 */

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

/**
 * 容器运行时基类
 */
class ContainerRuntime {
  constructor(options = {}) {
    this.options = options;
    this.runtimeType = options.runtime || 'docker';
    this.projectName = options.projectName || '';
    this.projectPath = options.projectPath || '';
  }

  /**
   * 检查运行时是否可用
   */
  async checkAvailability() {
    throw new Error('Method not implemented');
  }

  /**
   * 运行项目
   */
  async runProject(command, env = {}, port = null) {
    throw new Error('Method not implemented');
  }

  /**
   * 停止项目
   */
  async stopProject() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取项目状态
   */
  async getStatus() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取日志
   */
  async getLogs(lines = 100) {
    throw new Error('Method not implemented');
  }

  /**
   * 清理资源
   */
  async cleanup() {
    throw new Error('Method not implemented');
  }
}

/**
 * Docker 容器运行时
 */
class DockerContainerRuntime extends ContainerRuntime {
  constructor(options = {}) {
    super(options);
    this.containerName = `gada-${this.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    this.imageTag = `${this.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;
    this.networkName = `gada-network-${Date.now().toString(36)}`;
  }

  /**
   * 检查 Docker 是否可用
   */
  async checkAvailability() {
    try {
      const result = await this._executeDockerCommand(['--version']);
      return {
        available: true,
        version: result.stdout.trim(),
        runtime: 'docker'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        runtime: 'docker'
      };
    }
  }

  /**
   * 执行 Docker 命令
   */
  _executeDockerCommand(args, cwd = null, env = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', args, {
        cwd: cwd || this.projectPath,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          reject(new Error(`Docker command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to execute docker command: ${err.message}`));
      });
    });
  }

  /**
   * 构建 Docker 镜像
   */
  async buildImage(dockerfileContent = null) {
    try {
      // 如果提供了 Dockerfile 内容，先写入
      if (dockerfileContent) {
        const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
        await fs.writeFile(dockerfilePath, dockerfileContent, 'utf8');
      }

      // 检查是否有 Dockerfile
      const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
      if (!await fs.pathExists(dockerfilePath)) {
        // 如果没有 Dockerfile，创建一个基础的
        await this._createDefaultDockerfile();
      }

      // 构建镜像
      logger.info(`Building Docker image: ${this.imageTag}`);
      await this._executeDockerCommand(['build', '-t', this.imageTag, '.'], this.projectPath);
      
      return { success: true, imageTag: this.imageTag };
    } catch (error) {
      logger.error(`Failed to build Docker image: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建默认 Dockerfile
   */
  async _createDefaultDockerfile() {
    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
    
    // 检查项目类型
    const hasPackageJson = await fs.pathExists(path.join(this.projectPath, 'package.json'));
    const hasRequirementsTxt = await fs.pathExists(path.join(this.projectPath, 'requirements.txt'));
    
    let dockerfileContent = '';
    
    if (hasPackageJson) {
      // Node.js 项目
      dockerfileContent = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]`;
    } else if (hasRequirementsTxt) {
      // Python 项目
      dockerfileContent = `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`;
    } else {
      // 通用项目
      dockerfileContent = `FROM alpine:latest
WORKDIR /app
COPY . .
CMD ["sh", "-c", "echo 'No specific startup command configured' && tail -f /dev/null"]`;
    }
    
    await fs.writeFile(dockerfilePath, dockerfileContent, 'utf8');
  }

  /**
   * 创建 Docker 网络
   */
  async _createNetwork() {
    try {
      await this._executeDockerCommand(['network', 'create', this.networkName]);
      return { success: true, networkName: this.networkName };
    } catch (error) {
      // 网络可能已存在，忽略此错误
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行项目在容器中
   */
  async runProject(command = null, env = {}, port = 3000) {
    try {
      // 1. 检查或构建镜像
      const buildResult = await this.buildImage();
      if (!buildResult.success) {
        return buildResult;
      }

      // 2. 创建网络
      await this._createNetwork();

      // 3. 停止并删除可能存在的旧容器
      await this._cleanupExistingContainer();

      // 4. 准备环境变量
      const envVars = Object.entries(env).map(([key, value]) => `-e ${key}=${value}`);

      // 5. 准备命令
      const dockerArgs = [
        'run', '-d',
        '--name', this.containerName,
        '--restart', 'unless-stopped',
        '-p', `${port}:${port}`,
        '--network', this.networkName,
        ...envVars,
        '-v', `${this.projectPath}:/app`,
        '-w', '/app',
        this.imageTag
      ];

      // 如果提供了自定义命令，覆盖默认的 CMD
      if (command) {
        dockerArgs.push('sh', '-c', command);
      }

      // 6. 运行容器
      logger.info(`Starting container: ${this.containerName} on port ${port}`);
      await this._executeDockerCommand(dockerArgs, this.projectPath);

      // 7. 等待容器启动
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        success: true,
        containerName: this.containerName,
        imageTag: this.imageTag,
        port,
        networkName: this.networkName
      };
    } catch (error) {
      logger.error(`Failed to run project in container: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理已存在的容器
   */
  async _cleanupExistingContainer() {
    try {
      // 停止容器
      await this._executeDockerCommand(['stop', this.containerName], null);
    } catch (error) {
      // 容器可能不存在，忽略
    }

    try {
      // 删除容器
      await this._executeDockerCommand(['rm', this.containerName], null);
    } catch (error) {
      // 容器可能不存在，忽略
    }
  }

  /**
   * 停止项目
   */
  async stopProject() {
    try {
      await this._cleanupExistingContainer();
      return { success: true };
    } catch (error) {
      logger.error(`Failed to stop container: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取项目状态
   */
  async getStatus() {
    try {
      const result = await this._executeDockerCommand([
        'ps',
        '--filter', `name=${this.containerName}`,
        '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
      ]);

      const lines = result.stdout.trim().split('\n').filter(line => line.includes(this.containerName));
      
      if (lines.length === 0) {
        return { running: false, status: 'not running' };
      }

      const [name, status, ports, image] = lines[0].split('\t');
      return {
        running: true,
        containerName: name,
        status,
        ports,
        image,
        networkName: this.networkName
      };
    } catch (error) {
      return { running: false, status: 'error', error: error.message };
    }
  }

  /**
   * 获取日志
   */
  async getLogs(lines = 100) {
    try {
      const result = await this._executeDockerCommand(['logs', '--tail', String(lines), this.containerName]);
      return { success: true, logs: result.stdout };
    } catch (error) {
      return { success: false, error: error.message, logs: '' };
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      // 停止并删除容器
      await this.stopProject();

      // 删除网络
      try {
        await this._executeDockerCommand(['network', 'rm', this.networkName]);
      } catch (error) {
        // 网络可能不存在或被使用，忽略
      }

      // 删除镜像
      try {
        await this._executeDockerCommand(['rmi', this.imageTag]);
      } catch (error) {
        // 镜像可能被其他容器使用，忽略
      }

      return { success: true };
    } catch (error) {
      logger.error(`Failed to cleanup resources: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Firecracker 容器运行时（占位符，未来实现）
 */
class FirecrackerContainerRuntime extends ContainerRuntime {
  constructor(options = {}) {
    super(options);
    this.runtimeType = 'firecracker';
  }

  async checkAvailability() {
    return {
      available: false,
      error: 'Firecracker runtime not yet implemented',
      runtime: 'firecracker'
    };
  }

  async runProject() {
    throw new Error('Firecracker runtime not yet implemented');
  }
}

/**
 * 容器运行时工厂
 */
class ContainerRuntimeFactory {
  static createRuntime(options = {}) {
    const runtimeType = options.runtime || 'docker';
    
    switch (runtimeType.toLowerCase()) {
      case 'docker':
        return new DockerContainerRuntime(options);
      case 'firecracker':
        return new FirecrackerContainerRuntime(options);
      default:
        throw new Error(`Unsupported runtime type: ${runtimeType}`);
    }
  }

  /**
   * 检查可用的运行时
   */
  static async getAvailableRuntimes() {
    const runtimes = [];
    
    // 检查 Docker
    const dockerRuntime = new DockerContainerRuntime({});
    const dockerStatus = await dockerRuntime.checkAvailability();
    if (dockerStatus.available) {
      runtimes.push({
        type: 'docker',
        available: true,
        version: dockerStatus.version
      });
    }
    
    return runtimes;
  }
}

module.exports = {
  ContainerRuntime,
  DockerContainerRuntime,
  FirecrackerContainerRuntime,
  ContainerRuntimeFactory
};
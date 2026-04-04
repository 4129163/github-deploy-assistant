/**
 * Docker项目类型检测器
 * 检测Docker容器化项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class DockerDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'DockerDetector';
    this.version = '1.0.0';
    this.description = '检测Docker容器化项目';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['docker', 'container', 'compose'];
    this.priority = 95; // Docker项目优先级较高，因为容器化是明确的特征
  }

  /**
   * 检测Docker项目
   * @param {Object} projectInfo - 项目信息
   * @returns {Promise<DetectionResult>} 检测结果
   */
  async detect(projectInfo) {
    try {
      const { files } = projectInfo;
      
      // 收集检测指标
      const indicators = this.collectIndicators(files);
      const confidence = this.calculateConfidence(indicators);
      
      if (confidence < 0.3) {
        return this.createDetectionResult({
          success: false,
          projectType: 'unknown',
          confidence: 0,
          error: '未检测到足够的Docker项目特征'
        });
      }

      // 分析技术栈详情
      const stack = await this.analyzeStack(projectInfo, indicators);
      const keyFiles = this.identifyKeyFiles(files);
      const deployment = this.generateDeploymentRecommendation(projectInfo, stack);

      return this.createDetectionResult({
        success: true,
        projectType: this.determineExactType(indicators),
        confidence,
        stack,
        keyFiles,
        deployment
      });

    } catch (error) {
      return this.createDetectionResult({
        success: false,
        projectType: 'unknown',
        confidence: 0,
        error: `检测过程中发生错误: ${error.message}`,
        warnings: [{
          code: 'E001',
          message: 'Docker检测器执行失败',
          severity: 'high'
        }]
      });
    }
  }

  /**
   * 收集检测指标
   * @param {Array} files - 文件列表
   * @returns {Object} 指标集合
   */
  collectIndicators(files) {
    const indicators = {
      dockerfile: false,
      dockerCompose: false,
      dockerComposeDev: false,
      dockerComposeProd: false,
      dockerComposeTest: false,
      dockerignore: false,
      dockerDir: false,
      dockerConfigs: [],
      containerFiles: [],
      dockerBuildFiles: [],
      dockerVersion: null,
      baseImage: null,
      multiStage: false,
      healthcheck: false
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';
      const fileContent = file.content || '';

      // 检查Dockerfile
      if (fileName === 'Dockerfile' || fileName === 'dockerfile') {
        indicators.dockerfile = true;
        if (fileContent) {
          const content = typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent);
          indicators.dockerfileContent = content;
          
          // 分析Dockerfile内容
          this.analyzeDockerfileContent(content, indicators);
        }
      }

      // 检查Docker Compose文件
      if (fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
        indicators.dockerCompose = true;
        indicators.dockerConfigs.push({
          name: 'docker-compose',
          path: filePath
        });
      }
      
      if (fileName === 'docker-compose.dev.yml' || fileName === 'docker-compose.dev.yaml') {
        indicators.dockerComposeDev = true;
        indicators.dockerConfigs.push({
          name: 'docker-compose.dev',
          path: filePath
        });
      }
      
      if (fileName === 'docker-compose.prod.yml' || fileName === 'docker-compose.prod.yaml') {
        indicators.dockerComposeProd = true;
        indicators.dockerConfigs.push({
          name: 'docker-compose.prod',
          path: filePath
        });
      }
      
      if (fileName === 'docker-compose.test.yml' || fileName === 'docker-compose.test.yaml') {
        indicators.dockerComposeTest = true;
        indicators.dockerConfigs.push({
          name: 'docker-compose.test',
          path: filePath
        });
      }

      // 检查.dockerignore
      if (fileName === '.dockerignore') {
        indicators.dockerignore = true;
      }

      // 检查Docker相关目录
      if (filePath.includes('/.docker/') || filePath.includes('/docker/')) {
        indicators.dockerDir = true;
      }

      // 检查其他容器配置文件
      if (this.isContainerConfigFile(fileName)) {
        indicators.containerFiles.push({
          name: fileName,
          path: filePath
        });
      }

      // 检查Docker构建脚本
      if (fileName.includes('docker-build') || fileName.includes('build-docker')) {
        indicators.dockerBuildFiles.push(fileName);
      }
    }

    return indicators;
  }

  /**
   * 分析Dockerfile内容
   * @param {string} content - Dockerfile内容
   * @param {Object} indicators - 指标对象
   */
  analyzeDockerfileContent(content, indicators) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检查FROM指令
      if (trimmed.startsWith('FROM ')) {
        const fromLine = trimmed.substring(5).trim();
        indicators.baseImage = fromLine.split(' ')[0]; // 获取基础镜像
        
        // 检查多阶段构建
        if (fromLine.includes(' AS ') || indicators.baseImage.includes(':')) {
          indicators.multiStage = true;
        }
      }
      
      // 检查HEALTHCHECK指令
      if (trimmed.startsWith('HEALTHCHECK ')) {
        indicators.healthcheck = true;
      }
      
      // 检查Docker版本要求
      if (trimmed.startsWith('# syntax=')) {
        const syntaxMatch = trimmed.match(/syntax=([^\s]+)/);
        if (syntaxMatch) {
          indicators.dockerVersion = syntaxMatch[1];
        }
      }
    }
  }

  /**
   * 计算置信度
   * @param {Object} indicators - 检测指标
   * @returns {number} 置信度（0-1）
   */
  calculateConfidence(indicators) {
    let score = 0;
    const maxScore = 8; // 降低最大分数，因为Docker特征相对较少但明确

    // Dockerfile是最重要的指标
    if (indicators.dockerfile) score += 3;

    // Docker Compose文件
    if (indicators.dockerCompose) score += 2;
    if (indicators.dockerComposeDev || indicators.dockerComposeProd || indicators.dockerComposeTest) {
      score += 1;
    }

    // 其他Docker配置文件
    if (indicators.dockerignore) score += 1;
    if (indicators.dockerDir) score += 0.5;
    if (indicators.containerFiles.length > 0) score += 1;
    if (indicators.dockerBuildFiles.length > 0) score += 0.5;

    // Dockerfile特性
    if (indicators.multiStage) score += 0.5;
    if (indicators.healthcheck) score += 0.5;

    // 计算最终置信度
    const confidence = Math.min(score / maxScore, 1);
    return confidence;
  }

  /**
   * 确定具体的项目类型
   * @param {Object} indicators - 检测指标
   * @returns {string} 项目类型
   */
  determineExactType(indicators) {
    if (indicators.dockerCompose || indicators.dockerConfigs.length > 0) {
      return 'compose';
    }
    return 'docker';
  }

  /**
   * 分析技术栈详情
   * @param {Object} projectInfo - 项目信息
   * @param {Object} indicators - 检测指标
   * @returns {Promise<Object>} 技术栈信息
   */
  async analyzeStack(projectInfo, indicators) {
    const stack = {
      runtime: {
        name: 'docker',
        version: indicators.dockerVersion || null,
        required: true
      },
      packageManager: {
        name: 'docker',
        version: null,
        configFile: this.getConfigFile(indicators)
      },
      frameworks: [],
      buildTool: {
        name: 'docker build',
        required: true
      },
      databases: [],
      otherTools: [],
      containerInfo: this.extractContainerInfo(indicators)
    };

    // 分析基础镜像
    this.analyzeBaseImage(indicators, stack);

    // 检测可能的服务类型
    this.detectServiceType(indicators, stack);

    return stack;
  }

  /**
   * 获取配置文件
   * @param {Object} indicators - 检测指标
   * @returns {string|null} 配置文件路径
   */
  getConfigFile(indicators) {
    if (indicators.dockerfile) return 'Dockerfile';
    if (indicators.dockerCompose) return 'docker-compose.yml';
    if (indicators.dockerConfigs.length > 0) {
      return indicators.dockerConfigs[0].path;
    }
    return null;
  }

  /**
   * 提取容器信息
   * @param {Object} indicators - 检测指标
   * @returns {Object} 容器信息
   */
  extractContainerInfo(indicators) {
    const info = {
      hasDockerfile: indicators.dockerfile,
      hasDockerCompose: indicators.dockerCompose,
      configFiles: indicators.dockerConfigs,
      baseImage: indicators.baseImage,
      features: {
        multiStage: indicators.multiStage,
        healthcheck: indicators.healthcheck,
        ignoreFile: indicators.dockerignore
      }
    };

    return info;
  }

  /**
   * 分析基础镜像
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  analyzeBaseImage(indicators, stack) {
    if (!indicators.baseImage) return;

    const baseImage = indicators.baseImage.toLowerCase();
    
    // 检测基础镜像类型
    if (baseImage.includes('node') || baseImage.includes('alpine-node')) {
      stack.frameworks.push({
        name: 'Node.js',
        type: 'runtime',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('python') || baseImage.includes('alpine-python')) {
      stack.frameworks.push({
        name: 'Python',
        type: 'runtime',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('openjdk') || baseImage.includes('java')) {
      stack.frameworks.push({
        name: 'Java',
        type: 'runtime',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('golang') || baseImage.includes('go')) {
      stack.frameworks.push({
        name: 'Go',
        type: 'runtime',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('rust') || baseImage.includes('cargo')) {
      stack.frameworks.push({
        name: 'Rust',
        type: 'runtime',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('nginx') || baseImage.includes('httpd')) {
      stack.frameworks.push({
        name: 'Web Server',
        type: 'server',
        baseImage: indicators.baseImage
      });
    } else if (baseImage.includes('postgres') || baseImage.includes('mysql')) {
      stack.databases.push({
        name: this.getDatabaseName(baseImage),
        baseImage: indicators.baseImage,
        type: 'database'
      });
    }

    // 检查Alpine基础镜像
    if (baseImage.includes('alpine')) {
      stack.otherTools.push({
        name: 'Alpine Linux',
        description: '轻量级Linux发行版'
      });
    }
  }

  /**
   * 获取数据库名称
   * @param {string} baseImage - 基础镜像名
   * @returns {string} 数据库名称
   */
  getDatabaseName(baseImage) {
    if (baseImage.includes('postgres')) return 'PostgreSQL';
    if (baseImage.includes('mysql')) return 'MySQL';
    if (baseImage.includes('mongo')) return 'MongoDB';
    if (baseImage.includes('redis')) return 'Redis';
    if (baseImage.includes('sqlite')) return 'SQLite';
    return 'Database';
  }

  /**
   * 检测服务类型
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  detectServiceType(indicators, stack) {
    // 基于配置文件和基础镜像推断服务类型
    if (indicators.dockerCompose && indicators.dockerConfigs.length > 1) {
      stack.serviceType = 'multi-service';
    } else if (indicators.baseImage && indicators.baseImage.includes('nginx')) {
      stack.serviceType = 'web-server';
    } else if (stack.databases.length > 0) {
      stack.serviceType = 'database';
    } else {
      stack.serviceType = 'application';
    }
  }

  /**
   * 识别关键文件
   * @param {Array} files - 文件列表
   * @returns {Array} 关键文件列表
   */
  identifyKeyFiles(files) {
    const keyFiles = [];
    const importantFiles = [
      'Dockerfile',
      'dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'docker-compose.dev.yml',
      'docker-compose.prod.yml',
      'docker-compose.test.yml',
      '.dockerignore',
      'docker-compose.override.yml',
      'README.md',
      '.env',
      '.env.example'
    ];

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      if (importantFiles.includes(fileName.toLowerCase())) {
        keyFiles.push({
          path: file.path,
          exists: true,
          importance: this.getFileImportance(fileName),
          indicators: this.getFileIndicators(fileName)
        });
      }
    }

    return keyFiles;
  }

  /**
   * 获取文件重要性
   * @param {string} fileName - 文件名
   * @returns {string} 重要性级别
   */
  getFileImportance(fileName) {
    const fileNameLower = fileName.toLowerCase();
    const criticalFiles = ['dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
    const highFiles = ['.dockerignore', 'docker-compose.override.yml'];
    
    if (criticalFiles.includes(fileNameLower)) return 'critical';
    if (highFiles.includes(fileNameLower)) return 'high';
    return 'medium';
  }

  /**
   * 获取文件指标
   * @param {string} fileName - 文件名
   * @returns {Array} 指标列表
   */
  getFileIndicators(fileName) {
    const indicators = [];
    const fileNameLower = fileName.toLowerCase();
    
    if (fileNameLower === 'dockerfile') indicators.push('docker', 'container-definition');
    if (fileNameLower.includes('docker-compose')) indicators.push('docker-compose', 'orchestration');
    if (fileNameLower === '.dockerignore') indicators.push('docker-ignore', 'exclusion');
    
    return indicators;
  }

  /**
   * 生成部署建议
   * @param {Object} projectInfo - 项目信息
   * @param {Object} stack - 技术栈信息
   * @returns {Object} 部署建议
   */
  generateDeploymentRecommendation(projectInfo, stack) {
    const deployment = {
      strategy: 'docker',
      startCommand: this.determineStartCommand(stack),
      buildCommand: this.determineBuildCommand(stack),
      envVars: this.getRequiredEnvVars(projectInfo, stack),
      ports: this.determinePorts(stack),
      healthCheck: this.determineHealthCheck(stack),
      dependencies: ['docker', 'docker-compose']
    };

    // 根据容器类型调整策略
    if (stack.serviceType === 'multi-service') {
      deployment.strategy = 'docker-compose';
    } else if (stack.serviceType === 'database') {
      deployment.strategy = 'docker-database';
    }

    return deployment;
  }

  /**
   * 确定启动命令
   * @param {Object} stack - 技术栈信息
   * @returns {string} 启动命令
   */
  determineStartCommand(stack) {
    if (stack.containerInfo.hasDockerCompose) {
      return 'docker-compose up -d';
    } else if (stack.containerInfo.hasDockerfile) {
      return 'docker run -d --name app -p 8080:8080 app-image';
    }
    
    return 'docker-compose up -d';
  }

  /**
   * 确定构建命令
   * @param {Object} stack - 技术栈信息
   * @returns {string} 构建命令
   */
  determineBuildCommand(stack) {
    if (stack.containerInfo.hasDockerfile) {
      return 'docker build -t app-image .';
    }
    
    return 'docker-compose build';
  }

  /**
   * 确定端口
   * @param {Object} stack - 技术栈信息
   * @returns {Array} 端口列表
   */
  determinePorts(stack) {
    // 基于服务类型返回常见端口
    switch (stack.serviceType) {
      case 'web-server':
        return [80, 443, 8080];
      case 'database':
        if (stack.databases.some(db => db.name === 'PostgreSQL')) return [5432];
        if (stack.databases.some(db => db.name === 'MySQL')) return [3306];
        if (stack.databases.some(db => db.name === 'MongoDB')) return [27017];
        if (stack.databases.some(db => db.name === 'Redis')) return [6379];
        return [3306, 5432, 27017];
      default:
        return [8080, 3000, 5000, 80];
    }
  }

  /**
   * 确定健康检查端点
   * @param {Object} stack - 技术栈信息
   * @returns {string|null} 健康检查端点
   */
  determineHealthCheck(stack) {
    if (stack.containerInfo.features.healthcheck) {
      return null; // Docker已经配置了HEALTHCHECK
    }
    
    // 根据服务类型建议健康检查端点
    switch (stack.serviceType) {
      case 'web-server':
        return '/';
      case 'application':
        return '/health';
      default:
        return null;
    }
  }

  /**
   * 获取必需的环境变量
   * @param {Object} projectInfo - 项目信息
   * @param {Object} stack - 技术栈信息
   * @returns {Array} 环境变量列表
   */
  getRequiredEnvVars(projectInfo, stack) {
    const envVars = [
      {
        key: 'DOCKER_HOST',
        defaultValue: 'unix:///var/run/docker.sock',
        required: false,
        description: 'Docker守护进程地址'
      }
    ];

    // 数据库环境变量
    if (stack.databases.length > 0) {
      envVars.push({
        key: 'DB_HOST',
        defaultValue: 'localhost',
        required: true,
        description: '数据库主机地址'
      });
      envVars.push({
        key: 'DB_PORT',
        defaultValue: this.getDefaultDbPort(stack),
        required: true,
        description: '数据库端口'
      });
    }

    // 应用特定环境变量
    envVars.push({
      key: 'APP_PORT',
      defaultValue: '8080',
      required: false,
      description: '应用服务端口'
    });

    return envVars;
  }

  /**
   * 获取默认数据库端口
   * @param {Object} stack - 技术栈信息
   * @returns {string} 默认数据库端口
   */
  getDefaultDbPort(stack) {
    if (stack.databases.some(db => db.name === 'PostgreSQL')) return '5432';
    if (stack.databases.some(db => db.name === 'MySQL')) return '3306';
    if (stack.databases.some(db => db.name === 'MongoDB')) return '27017';
    if (stack.databases.some(db => db.name === 'Redis')) return '6379';
    return '3306';
  }

  /**
   * 检查是否是容器配置文件
   * @param {string} fileName - 文件名
   * @returns {boolean} 是否是容器配置文件
   */
  isContainerConfigFile(fileName) {
    const configFiles = [
      'docker-compose.override.yml',
      'docker-compose.override.yaml',
      'docker-compose.local.yml',
      'docker-compose.local.yaml',
      'docker-compose.ci.yml',
      'docker-compose.ci.yaml',
      'docker-compose.staging.yml',
      'docker-compose.staging.yaml',
      'docker-entrypoint.sh',
      'docker-start.sh',
      'docker-healthcheck.sh'
    ];

    return configFiles.includes(fileName);
  }
}

module.exports = DockerDetector;
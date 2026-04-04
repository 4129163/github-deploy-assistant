/**
 * Node.js项目类型检测器
 * 检测Node.js/JavaScript项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class NodejsDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'NodejsDetector';
    this.version = '1.0.0';
    this.description = '检测Node.js/JavaScript项目类型';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['nodejs', 'javascript', 'typescript'];
    this.priority = 90; // Node.js项目很常见，设置较高优先级
  }

  /**
   * 检测Node.js项目
   * @param {Object} projectInfo - 项目信息
   * @returns {Promise<DetectionResult>} 检测结果
   */
  async detect(projectInfo) {
    try {
      const { path, files, stats } = projectInfo;
      
      // 收集检测指标
      const indicators = this.collectIndicators(files);
      const confidence = this.calculateConfidence(indicators);
      
      if (confidence < 0.3) {
        // 置信度过低，返回未知类型
        return this.createDetectionResult({
          success: false,
          projectType: 'unknown',
          confidence: 0,
          error: '未检测到足够的Node.js项目特征'
        });
      }

      // 分析技术栈详情
      const stack = await this.analyzeStack(projectInfo);
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
          message: 'Node.js检测器执行失败',
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
      packageJson: false,
      packageLockJson: false,
      yarnLock: false,
      nodeModules: false,
      jsFiles: 0,
      tsFiles: 0,
      commonJsFiles: ['server.js', 'app.js', 'index.js', 'main.js'],
      frameworkFiles: [],
      buildFiles: []
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';

      // 检查package.json
      if (fileName === 'package.json') {
        indicators.packageJson = true;
        if (file.content) {
          try {
            const pkg = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
            indicators.packageJsonContent = pkg;
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }

      // 检查包管理器锁文件
      if (fileName === 'package-lock.json') indicators.packageLockJson = true;
      if (fileName === 'yarn.lock') indicators.yarnLock = true;
      if (fileName === 'pnpm-lock.yaml') indicators.pnpmLock = true;

      // 检查node_modules目录
      if (filePath.includes('node_modules/')) indicators.nodeModules = true;

      // 统计JS/TS文件
      if (fileName.endsWith('.js')) indicators.jsFiles++;
      if (fileName.endsWith('.ts')) indicators.tsFiles++;
      if (fileName.endsWith('.jsx')) indicators.jsFiles++;
      if (fileName.endsWith('.tsx')) indicators.tsFiles++;

      // 检查常见入口文件
      if (indicators.commonJsFiles.includes(fileName)) {
        indicators.hasCommonEntry = true;
      }

      // 检查框架相关文件
      if (this.isFrameworkFile(fileName, filePath)) {
        indicators.frameworkFiles.push({ fileName, filePath });
      }

      // 检查构建配置文件
      if (this.isBuildFile(fileName)) {
        indicators.buildFiles.push(fileName);
      }
    }

    return indicators;
  }

  /**
   * 计算置信度
   * @param {Object} indicators - 检测指标
   * @returns {number} 置信度（0-1）
   */
  calculateConfidence(indicators) {
    let score = 0;
    const maxScore = 10;

    // package.json是最重要的指标
    if (indicators.packageJson) score += 4;

    // 包管理器锁文件
    if (indicators.packageLockJson || indicators.yarnLock || indicators.pnpmLock) score += 2;

    // node_modules目录
    if (indicators.nodeModules) score += 1;

    // JS/TS文件数量
    const totalJsFiles = indicators.jsFiles + indicators.tsFiles;
    if (totalJsFiles > 0) {
      if (totalJsFiles >= 10) score += 2;
      else if (totalJsFiles >= 3) score += 1;
      else score += 0.5;
    }

    // 常见入口文件
    if (indicators.hasCommonEntry) score += 1;

    // 框架文件
    if (indicators.frameworkFiles.length > 0) score += 1;

    // 构建配置文件
    if (indicators.buildFiles.length > 0) score += 0.5;

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
    // 检查TypeScript特征
    if (indicators.tsFiles > 0) {
      // 如果有tsconfig.json，基本确定是TypeScript项目
      const hasTsConfig = indicators.buildFiles.includes('tsconfig.json');
      if (hasTsConfig || indicators.tsFiles > indicators.jsFiles) {
        return 'typescript';
      }
    }

    // 默认返回nodejs
    return 'nodejs';
  }

  /**
   * 分析技术栈详情
   * @param {Object} projectInfo - 项目信息
   * @returns {Promise<Object>} 技术栈信息
   */
  async analyzeStack(projectInfo) {
    const stack = {
      runtime: {
        name: 'node',
        version: null,
        required: true
      },
      packageManager: {
        name: null,
        version: null,
        lockFile: null
      },
      frameworks: [],
      buildTool: null,
      databases: [],
      otherTools: []
    };

    const { files } = projectInfo;

    // 分析package.json内容
    if (projectInfo.packageJsonContent) {
      const pkg = projectInfo.packageJsonContent;
      
      // 检测框架
      if (pkg.dependencies) {
        this.detectFrameworks(pkg.dependencies, stack.frameworks);
        this.detectDatabases(pkg.dependencies, stack.databases);
      }
      if (pkg.devDependencies) {
        this.detectFrameworks(pkg.devDependencies, stack.frameworks);
        this.detectBuildTools(pkg.devDependencies, stack);
      }

      // 检测引擎要求
      if (pkg.engines && pkg.engines.node) {
        stack.runtime.version = pkg.engines.node;
      }
    }

    // 检测包管理器
    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      if (fileName === 'package-lock.json') {
        stack.packageManager.name = 'npm';
        stack.packageManager.lockFile = 'package-lock.json';
      } else if (fileName === 'yarn.lock') {
        stack.packageManager.name = 'yarn';
        stack.packageManager.lockFile = 'yarn.lock';
      } else if (fileName === 'pnpm-lock.yaml') {
        stack.packageManager.name = 'pnpm';
        stack.packageManager.lockFile = 'pnpm-lock.yaml';
      }
    }

    // 如果没有检测到包管理器，默认使用npm
    if (!stack.packageManager.name) {
      stack.packageManager.name = 'npm';
    }

    // 检测构建工具
    this.detectBuildConfigs(files, stack);

    return stack;
  }

  /**
   * 检测框架
   * @param {Object} dependencies - 依赖对象
   * @param {Array} frameworks - 框架数组
   */
  detectFrameworks(dependencies, frameworks) {
    const frameworkMapping = {
      'express': 'Express',
      'koa': 'Koa',
      'hapi': 'Hapi',
      'fastify': 'Fastify',
      'nestjs': 'NestJS',
      'sails': 'Sails.js',
      'meteor': 'Meteor',
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'next': 'Next.js',
      'nuxt': 'Nuxt.js',
      'gatsby': 'Gatsby',
      'electron': 'Electron'
    };

    for (const [pkg, frameworkName] of Object.entries(frameworkMapping)) {
      if (dependencies[pkg]) {
        frameworks.push({
          name: frameworkName,
          package: pkg,
          version: dependencies[pkg],
          required: true
        });
      }
    }
  }

  /**
   * 检测数据库
   * @param {Object} dependencies - 依赖对象
   * @param {Array} databases - 数据库数组
   */
  detectDatabases(dependencies, databases) {
    const dbMapping = {
      'mongoose': 'MongoDB (Mongoose)',
      'mongodb': 'MongoDB',
      'mysql': 'MySQL',
      'mysql2': 'MySQL',
      'pg': 'PostgreSQL',
      'sqlite3': 'SQLite',
      'redis': 'Redis',
      'ioredis': 'Redis',
      'typeorm': 'TypeORM',
      'sequelize': 'Sequelize',
      'prisma': 'Prisma'
    };

    for (const [pkg, dbName] of Object.entries(dbMapping)) {
      if (dependencies[pkg]) {
        databases.push({
          name: dbName,
          package: pkg,
          version: dependencies[pkg],
          required: true
        });
      }
    }
  }

  /**
   * 检测构建工具
   * @param {Object} dependencies - 开发依赖对象
   * @param {Object} stack - 技术栈对象
   */
  detectBuildTools(dependencies, stack) {
    const buildTools = {
      'webpack': 'Webpack',
      'vite': 'Vite',
      'rollup': 'Rollup',
      'parcel': 'Parcel',
      'esbuild': 'esbuild',
      'tsc': 'TypeScript Compiler',
      'babel': 'Babel'
    };

    for (const [pkg, toolName] of Object.entries(buildTools)) {
      if (dependencies[pkg]) {
        stack.buildTool = {
          name: toolName,
          package: pkg,
          version: dependencies[pkg],
          required: true
        };
        break;
      }
    }
  }

  /**
   * 检测构建配置文件
   * @param {Array} files - 文件列表
   * @param {Object} stack - 技术栈对象
   */
  detectBuildConfigs(files, stack) {
    const buildConfigs = {
      'webpack.config.js': 'Webpack',
      'vite.config.js': 'Vite',
      'rollup.config.js': 'Rollup',
      'parcel.config.js': 'Parcel',
      'esbuild.config.js': 'esbuild',
      'tsconfig.json': 'TypeScript',
      'babel.config.js': 'Babel',
      '.babelrc': 'Babel'
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      if (buildConfigs[fileName] && !stack.buildTool) {
        stack.buildTool = {
          name: buildConfigs[fileName],
          configFile: fileName,
          required: true
        };
      }
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
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'server.js',
      'app.js',
      'index.js',
      'main.js',
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.js',
      '.env',
      '.env.example',
      'README.md',
      'Dockerfile',
      'docker-compose.yml'
    ];

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      if (importantFiles.includes(fileName)) {
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
    const criticalFiles = ['package.json', 'server.js', 'app.js', 'index.js', 'main.js'];
    const highFiles = ['package-lock.json', 'yarn.lock', 'tsconfig.json', 'Dockerfile'];
    
    if (criticalFiles.includes(fileName)) return 'critical';
    if (highFiles.includes(fileName)) return 'high';
    return 'medium';
  }

  /**
   * 获取文件指标
   * @param {string} fileName - 文件名
   * @returns {Array} 指标列表
   */
  getFileIndicators(fileName) {
    const indicators = [];
    
    if (fileName === 'package.json') indicators.push('project-config', 'dependencies');
    if (fileName.endsWith('.js')) indicators.push('javascript', 'source-code');
    if (fileName.endsWith('.ts')) indicators.push('typescript', 'source-code');
    if (fileName.includes('config')) indicators.push('configuration');
    if (fileName.includes('lock')) indicators.push('package-manager');
    
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
      strategy: 'pm2', // 默认使用pm2
      startCommand: this.determineStartCommand(projectInfo),
      buildCommand: this.determineBuildCommand(projectInfo),
      envVars: this.getRequiredEnvVars(projectInfo),
      ports: [3000, 8080, 5000], // 常见的Node.js端口
      healthCheck: '/api/health',
      dependencies: ['node', 'npm']
    };

    // 根据技术栈调整策略
    if (stack.frameworks.some(f => f.name.includes('React') || f.name.includes('Vue'))) {
      deployment.strategy = 'static'; // 前端项目
    } else if (stack.frameworks.some(f => f.name.includes('Next.js') || f.name.includes('Nuxt.js'))) {
      deployment.strategy = 'nextjs'; // SSR项目
    }

    return deployment;
  }

  /**
   * 确定启动命令
   * @param {Object} projectInfo - 项目信息
   * @returns {string} 启动命令
   */
  determineStartCommand(projectInfo) {
    if (projectInfo.packageJsonContent && projectInfo.packageJsonContent.scripts) {
      const scripts = projectInfo.packageJsonContent.scripts;
      
      // 优先使用常见的启动脚本
      if (scripts.start) return 'npm start';
      if (scripts.dev) return 'npm run dev';
      if (scripts.serve) return 'npm run serve';
    }
    
    // 默认启动命令
    return 'node server.js';
  }

  /**
   * 确定构建命令
   * @param {Object} projectInfo - 项目信息
   * @returns {string|null} 构建命令
   */
  determineBuildCommand(projectInfo) {
    if (projectInfo.packageJsonContent && projectInfo.packageJsonContent.scripts) {
      const scripts = projectInfo.packageJsonContent.scripts;
      
      if (scripts.build) return 'npm run build';
      if (scripts.compile) return 'npm run compile';
    }
    
    return null;
  }

  /**
   * 获取必需的环境变量
   * @param {Object} projectInfo - 项目信息
   * @returns {Array} 环境变量列表
   */
  getRequiredEnvVars(projectInfo) {
    const envVars = [
      {
        key: 'NODE_ENV',
        defaultValue: 'production',
        required: false,
        description: 'Node.js运行环境'
      },
      {
        key: 'PORT',
        defaultValue: '3000',
        required: false,
        description: '服务监听端口'
      }
    ];

    // 检查.env.example或README中的环境变量提示
    // 这里可以添加更智能的检测逻辑

    return envVars;
  }

  /**
   * 检查是否是框架文件
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否是框架文件
   */
  isFrameworkFile(fileName, filePath) {
    const frameworkPatterns = [
      /next\.config\./,
      /nuxt\.config\./,
      /gatsby-config\./,
      /angular\.json/,
      /vue\.config\./,
      /react-app-env\.d\.ts/
    ];

    return frameworkPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath));
  }

  /**
   * 检查是否是构建文件
   * @param {string} fileName - 文件名
   * @returns {boolean} 是否是构建文件
   */
  isBuildFile(fileName) {
    const buildFiles = [
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.js',
      'rollup.config.js',
      'parcel.config.js',
      'esbuild.config.js',
      'babel.config.js',
      '.babelrc',
      '.babelrc.js'
    ];

    return buildFiles.includes(fileName);
  }
}

module.exports = NodejsDetector;
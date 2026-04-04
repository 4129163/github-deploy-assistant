/**
 * Rust项目类型检测器
 * 检测Rust项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class RustDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'RustDetector';
    this.version = '1.0.0';
    this.description = '检测Rust项目类型';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['rust', 'cargo'];
    this.priority = 80;
  }

  /**
   * 检测Rust项目
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
          error: '未检测到足够的Rust项目特征'
        });
      }

      // 分析技术栈详情
      const stack = await this.analyzeStack(projectInfo, indicators);
      const keyFiles = this.identifyKeyFiles(files);
      const deployment = this.generateDeploymentRecommendation(projectInfo, stack);

      return this.createDetectionResult({
        success: true,
        projectType: 'rust',
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
          message: 'Rust检测器执行失败',
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
      cargoToml: false,
      cargoLock: false,
      rustFiles: 0,
      rsFiles: [],
      buildRs: false,
      mainRs: false,
      libRs: false,
      cargoDir: false,
      targetDir: false,
      rustToolchain: false,
      rustfmt: false,
      clippy: false
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';

      // 检查Cargo.toml
      if (fileName === 'Cargo.toml') {
        indicators.cargoToml = true;
        if (file.content) {
          try {
            // 简单的TOML解析（实际实现可能需要完整解析）
            const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content);
            indicators.cargoTomlContent = content;
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }

      // 检查Cargo.lock
      if (fileName === 'Cargo.lock') {
        indicators.cargoLock = true;
      }

      // 统计Rust文件
      if (fileName.endsWith('.rs')) {
        indicators.rustFiles++;
        indicators.rsFiles.push({
          name: fileName,
          path: filePath
        });

        // 检查特定文件
        if (fileName === 'main.rs') indicators.mainRs = true;
        if (fileName === 'lib.rs') indicators.libRs = true;
        if (fileName === 'build.rs') indicators.buildRs = true;
      }

      // 检查Cargo目录
      if (filePath.includes('/.cargo/')) {
        indicators.cargoDir = true;
      }

      // 检查target目录（构建输出）
      if (filePath.includes('/target/')) {
        indicators.targetDir = true;
      }

      // 检查Rust工具链配置文件
      if (fileName === 'rust-toolchain.toml' || fileName === 'rust-toolchain') {
        indicators.rustToolchain = true;
      }

      // 检查代码格式和lint配置
      if (fileName === '.rustfmt.toml') indicators.rustfmt = true;
      if (fileName === '.clippy.toml') indicators.clippy = true;
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

    // Cargo.toml是最重要的指标
    if (indicators.cargoToml) score += 4;

    // Cargo.lock
    if (indicators.cargoLock) score += 2;

    // Rust文件数量
    if (indicators.rustFiles > 0) {
      if (indicators.rustFiles >= 10) score += 3;
      else if (indicators.rustFiles >= 3) score += 2;
      else score += 1;
    }

    // 特定Rust文件
    if (indicators.mainRs) score += 1;
    if (indicators.libRs) score += 1;
    if (indicators.buildRs) score += 0.5;

    // 构建目录和配置
    if (indicators.targetDir) score += 1;
    if (indicators.cargoDir) score += 0.5;
    if (indicators.rustToolchain) score += 0.5;
    if (indicators.rustfmt || indicators.clippy) score += 0.5;

    // 计算最终置信度
    const confidence = Math.min(score / maxScore, 1);
    return confidence;
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
        name: 'rust',
        version: null,
        required: true
      },
      packageManager: {
        name: 'cargo',
        version: null,
        lockFile: indicators.cargoLock ? 'Cargo.lock' : null
      },
      frameworks: [],
      buildTool: {
        name: 'cargo',
        required: true
      },
      databases: [],
      otherTools: []
    };

    // 分析Cargo.toml内容
    await this.analyzeCargoToml(indicators, stack);

    // 检测项目类型（bin/lib）
    this.detectProjectType(indicators, stack);

    return stack;
  }

  /**
   * 分析Cargo.toml文件
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  async analyzeCargoToml(indicators, stack) {
    if (!indicators.cargoTomlContent) return;

    const content = indicators.cargoTomlContent;
    
    // 简单的TOML解析（实际项目中应该使用toml解析库）
    const lines = content.split('\n');
    let inDependencies = false;
    let inDevDependencies = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检测章节
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inDependencies = trimmed === '[dependencies]';
        inDevDependencies = trimmed === '[dev-dependencies]';
        continue;
      }

      // 解析依赖
      if (inDependencies || inDevDependencies) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*["']?([^"'\s]+)["']?/);
        if (match) {
          const crateName = match[1];
          const versionSpec = match[2];
          
          // 检测常见框架和库
          this.detectRustFramework(crateName, versionSpec, stack.frameworks);
          this.detectRustDatabase(crateName, versionSpec, stack.databases);
        }
      }

      // 解析包信息
      if (trimmed.startsWith('name =')) {
        const match = trimmed.match(/name\s*=\s*["']([^"']+)["']/);
        if (match) {
          stack.packageName = match[1];
        }
      }
      
      if (trimmed.startsWith('version =')) {
        const match = trimmed.match(/version\s*=\s*["']([^"']+)["']/);
        if (match) {
          stack.packageVersion = match[1];
        }
      }
      
      if (trimmed.startsWith('edition =')) {
        const match = trimmed.match(/edition\s*=\s*["']([^"']+)["']/);
        if (match) {
          stack.rustEdition = match[1];
        }
      }
    }
  }

  /**
   * 检测Rust框架
   * @param {string} crateName - crate名称
   * @param {string} versionSpec - 版本规范
   * @param {Array} frameworks - 框架数组
   */
  detectRustFramework(crateName, versionSpec, frameworks) {
    const frameworkMapping = {
      'actix-web': 'Actix Web',
      'rocket': 'Rocket',
      'warp': 'Warp',
      'axum': 'Axum',
      'tokio': 'Tokio',
      'async-std': 'Async-std',
      'serde': 'Serde',
      'reqwest': 'Reqwest',
      'hyper': 'Hyper'
    };

    if (frameworkMapping[crateName]) {
      frameworks.push({
        name: frameworkMapping[crateName],
        crate: crateName,
        version: versionSpec,
        required: true
      });
    }
  }

  /**
   * 检测Rust数据库
   * @param {string} crateName - crate名称
   * @param {string} versionSpec - 版本规范
   * @param {Array} databases - 数据库数组
   */
  detectRustDatabase(crateName, versionSpec, databases) {
    const dbMapping = {
      'diesel': 'Diesel ORM',
      'sqlx': 'SQLx',
      'rusqlite': 'SQLite',
      'postgres': 'PostgreSQL',
      'mysql': 'MySQL',
      'mongodb': 'MongoDB',
      'redis': 'Redis',
      'sea-orm': 'SeaORM'
    };

    if (dbMapping[crateName]) {
      databases.push({
        name: dbMapping[crateName],
        crate: crateName,
        version: versionSpec,
        required: true
      });
    }
  }

  /**
   * 检测项目类型
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  detectProjectType(indicators, stack) {
    if (indicators.mainRs) {
      stack.projectType = 'binary';
    } else if (indicators.libRs) {
      stack.projectType = 'library';
    } else {
      stack.projectType = 'unknown';
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
      'Cargo.toml',
      'Cargo.lock',
      'main.rs',
      'lib.rs',
      'build.rs',
      'rust-toolchain.toml',
      'rust-toolchain',
      '.rustfmt.toml',
      '.clippy.toml',
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
    const criticalFiles = ['Cargo.toml', 'main.rs', 'lib.rs'];
    const highFiles = ['Cargo.lock', 'build.rs', 'Dockerfile'];
    
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
    
    if (fileName.endsWith('.rs')) indicators.push('rust', 'source-code');
    if (fileName === 'Cargo.toml') indicators.push('cargo', 'manifest');
    if (fileName === 'Cargo.lock') indicators.push('dependencies', 'lockfile');
    if (fileName === 'build.rs') indicators.push('build-script');
    
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
      strategy: 'binary', // Rust通常编译为二进制文件
      startCommand: this.determineStartCommand(projectInfo, stack),
      buildCommand: 'cargo build --release',
      envVars: this.getRequiredEnvVars(projectInfo, stack),
      ports: [8080, 3000, 8000], // 常见的Rust Web服务端口
      healthCheck: '/health',
      dependencies: ['rustc', 'cargo']
    };

    // 根据框架调整策略
    if (stack.frameworks.some(f => 
      ['Actix Web', 'Rocket', 'Warp', 'Axum'].includes(f.name)
    )) {
      deployment.strategy = 'web-service';
    }

    return deployment;
  }

  /**
   * 确定启动命令
   * @param {Object} projectInfo - 项目信息
   * @param {Object} stack - 技术栈信息
   * @returns {string} 启动命令
   */
  determineStartCommand(projectInfo, stack) {
    // 从Cargo.toml获取包名，或者使用默认值
    const packageName = stack.packageName || 'target/release/app';
    
    if (stack.projectType === 'binary') {
      return `./target/release/${packageName}`;
    }
    
    // 如果是库项目或未知类型，提供通用命令
    return 'cargo run';
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
        key: 'RUST_LOG',
        defaultValue: 'info',
        required: false,
        description: 'Rust日志级别'
      },
      {
        key: 'RUST_BACKTRACE',
        defaultValue: '1',
        required: false,
        description: 'Rust错误回溯'
      }
    ];

    // Web框架特定环境变量
    if (stack.frameworks.some(f => 
      ['Actix Web', 'Rocket', 'Warp', 'Axum'].includes(f.name)
    )) {
      envVars.push({
        key: 'PORT',
        defaultValue: '8080',
        required: false,
        description: '服务监听端口'
      });
      envVars.push({
        key: 'HOST',
        defaultValue: '0.0.0.0',
        required: false,
        description: '服务绑定地址'
      });
    }

    // 数据库环境变量
    if (stack.databases.length > 0) {
      envVars.push({
        key: 'DATABASE_URL',
        defaultValue: '',
        required: true,
        description: '数据库连接URL'
      });
    }

    return envVars;
  }
}

module.exports = RustDetector;
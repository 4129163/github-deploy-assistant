/**
 * Go项目类型检测器
 * 检测Go项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class GoDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'GoDetector';
    this.version = '1.0.0';
    this.description = '检测Go项目类型';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['go', 'golang'];
    this.priority = 70;
  }

  /**
   * 检测Go项目
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
          error: '未检测到足够的Go项目特征'
        });
      }

      // 分析技术栈详情
      const stack = await this.analyzeStack(projectInfo, indicators);
      const keyFiles = this.identifyKeyFiles(files);
      const deployment = this.generateDeploymentRecommendation(projectInfo, stack);

      return this.createDetectionResult({
        success: true,
        projectType: 'go',
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
          message: 'Go检测器执行失败',
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
      goMod: false,
      goSum: false,
      goFiles: 0,
      goTestFiles: 0,
      mainGo: false,
      vendorDir: false,
      goWork: false,
      goVersion: null,
      moduleName: null,
      ginFiles: [],
      echoFiles: [],
      fiberFiles: [],
      goPath: false
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';

      // 检查go.mod文件
      if (fileName === 'go.mod') {
        indicators.goMod = true;
        if (file.content) {
          try {
            const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content);
            indicators.goModContent = content;
            
            // 解析go.mod内容
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('module ')) {
                indicators.moduleName = trimmed.replace('module ', '').trim();
              }
              if (trimmed.startsWith('go ')) {
                indicators.goVersion = trimmed.replace('go ', '').trim();
              }
            }
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }

      // 检查go.sum文件
      if (fileName === 'go.sum') {
        indicators.goSum = true;
      }

      // 统计Go文件
      if (fileName.endsWith('.go')) {
        indicators.goFiles++;
        
        // 检查测试文件
        if (fileName.endsWith('_test.go')) {
          indicators.goTestFiles++;
        }
        
        // 检查main.go文件
        if (fileName === 'main.go') {
          indicators.mainGo = true;
        }
        
        // 检查框架相关文件
        if (file.content) {
          const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content);
          if (content.includes('github.com/gin-gonic/gin')) {
            indicators.ginFiles.push({ fileName, filePath });
          }
          if (content.includes('github.com/labstack/echo')) {
            indicators.echoFiles.push({ fileName, filePath });
          }
          if (content.includes('github.com/gofiber/fiber')) {
            indicators.fiberFiles.push({ fileName, filePath });
          }
        }
      }

      // 检查vendor目录
      if (filePath.includes('/vendor/')) {
        indicators.vendorDir = true;
      }

      // 检查go.work文件
      if (fileName === 'go.work') {
        indicators.goWork = true;
      }

      // 检查GOPATH特征
      if (filePath.includes('/src/github.com/') || 
          filePath.includes('/src/golang.org/') ||
          filePath.includes('/src/')) {
        indicators.goPath = true;
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

    // go.mod是最重要的指标
    if (indicators.goMod) score += 4;

    // go.sum文件
    if (indicators.goSum) score += 2;

    // Go文件数量
    if (indicators.goFiles > 0) {
      if (indicators.goFiles >= 10) score += 3;
      else if (indicators.goFiles >= 3) score += 2;
      else score += 1;
    }

    // 特定文件
    if (indicators.mainGo) score += 1;
    if (indicators.goTestFiles > 0) score += 0.5;

    // 目录结构
    if (indicators.vendorDir) score += 1;
    if (indicators.goWork) score += 0.5;
    if (indicators.goPath) score += 0.5;

    // 框架特征
    if (indicators.ginFiles.length > 0) score += 1;
    if (indicators.echoFiles.length > 0) score += 1;
    if (indicators.fiberFiles.length > 0) score += 1;

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
        name: 'go',
        version: indicators.goVersion || null,
        required: true
      },
      packageManager: {
        name: 'go modules',
        version: null,
        lockFile: indicators.goSum ? 'go.sum' : null,
        configFile: 'go.mod'
      },
      frameworks: [],
      buildTool: {
        name: 'go build',
        required: true
      },
      databases: [],
      otherTools: []
    };

    // 分析go.mod依赖
    await this.analyzeGoMod(indicators, stack);

    // 检测框架
    this.detectFrameworks(indicators, stack.frameworks);

    // 设置模块信息
    if (indicators.moduleName) {
      stack.module = {
        name: indicators.moduleName,
        path: indicators.moduleName
      };
    }

    return stack;
  }

  /**
   * 分析go.mod文件
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  async analyzeGoMod(indicators, stack) {
    if (!indicators.goModContent) return;

    const content = indicators.goModContent;
    const lines = content.split('\n');
    let inRequire = false;
    let inReplace = false;
    let inExclude = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 检测章节
      if (trimmed.startsWith('require (')) {
        inRequire = true;
        continue;
      } else if (trimmed.startsWith(')')) {
        inRequire = false;
        inReplace = false;
        inExclude = false;
        continue;
      } else if (trimmed.startsWith('replace (')) {
        inReplace = true;
        continue;
      } else if (trimmed.startsWith('exclude (')) {
        inExclude = true;
        continue;
      }

      // 解析依赖
      if (inRequire && trimmed) {
        // 格式: module/path v1.2.3
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const modulePath = parts[0];
          const version = parts[1];
          
          // 检测常见框架
          this.detectGoFramework(modulePath, version, stack.frameworks);
          
          // 检测数据库驱动
          this.detectGoDatabase(modulePath, version, stack.databases);
        }
      }
    }
  }

  /**
   * 检测Go框架
   * @param {string} modulePath - 模块路径
   * @param {string} version - 版本
   * @param {Array} frameworks - 框架数组
   */
  detectGoFramework(modulePath, version, frameworks) {
    const frameworkMapping = {
      'github.com/gin-gonic/gin': 'Gin',
      'github.com/labstack/echo': 'Echo',
      'github.com/gofiber/fiber': 'Fiber',
      'github.com/gorilla/mux': 'Gorilla Mux',
      'github.com/go-chi/chi': 'Chi',
      'github.com/beego/beego': 'Beego',
      'github.com/kataras/iris': 'Iris',
      'github.com/valyala/fasthttp': 'FastHTTP'
    };

    if (frameworkMapping[modulePath]) {
      frameworks.push({
        name: frameworkMapping[modulePath],
        module: modulePath,
        version: version,
        required: true
      });
    }
  }

  /**
   * 检测Go数据库
   * @param {string} modulePath - 模块路径
   * @param {string} version - 版本
   * @param {Array} databases - 数据库数组
   */
  detectGoDatabase(modulePath, version, databases) {
    const dbMapping = {
      'github.com/lib/pq': 'PostgreSQL',
      'github.com/go-sql-driver/mysql': 'MySQL',
      'github.com/mattn/go-sqlite3': 'SQLite',
      'github.com/redis/go-redis': 'Redis',
      'go.mongodb.org/mongo-driver': 'MongoDB',
      'github.com/jackc/pgx': 'PostgreSQL (pgx)',
      'github.com/gocql/gocql': 'Cassandra',
      'github.com/ClickHouse/clickhouse-go': 'ClickHouse'
    };

    if (dbMapping[modulePath]) {
      databases.push({
        name: dbMapping[modulePath],
        module: modulePath,
        version: version,
        required: true
      });
    }
  }

  /**
   * 检测框架
   * @param {Object} indicators - 检测指标
   * @param {Array} frameworks - 框架数组
   */
  detectFrameworks(indicators, frameworks) {
    if (indicators.ginFiles.length > 0) {
      frameworks.push({
        name: 'Gin',
        required: true
      });
    }
    if (indicators.echoFiles.length > 0) {
      frameworks.push({
        name: 'Echo',
        required: true
      });
    }
    if (indicators.fiberFiles.length > 0) {
      frameworks.push({
        name: 'Fiber',
        required: true
      });
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
      'go.mod',
      'go.sum',
      'main.go',
      'go.work',
      'Makefile',
      'Dockerfile',
      'docker-compose.yml',
      'README.md',
      '.env',
      '.env.example'
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
    const criticalFiles = ['go.mod', 'main.go'];
    const highFiles = ['go.sum', 'Makefile', 'Dockerfile'];
    
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
    
    if (fileName.endsWith('.go')) indicators.push('go', 'source-code');
    if (fileName === 'go.mod') indicators.push('module', 'configuration');
    if (fileName === 'go.sum') indicators.push('dependencies', 'lockfile');
    if (fileName === 'main.go') indicators.push('entry-point', 'executable');
    
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
      strategy: 'binary', // Go编译为单个二进制文件
      startCommand: this.determineStartCommand(projectInfo, stack),
      buildCommand: 'go build -o app',
      envVars: this.getRequiredEnvVars(projectInfo, stack),
      ports: [8080, 3000, 5000], // 常见的Go Web服务端口
      healthCheck: '/health',
      dependencies: ['go']
    };

    // 根据框架调整策略
    if (stack.frameworks.length > 0) {
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
    // 如果有Makefile，优先使用make
    const hasMakefile = projectInfo.files.some(file => 
      file.name === 'Makefile' || file.path.endsWith('/Makefile')
    );
    
    if (hasMakefile) {
      return 'make run';
    }
    
    // 默认启动命令
    return './app';
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
        key: 'GO_ENV',
        defaultValue: 'production',
        required: false,
        description: 'Go运行环境'
      },
      {
        key: 'GOPROXY',
        defaultValue: 'https://proxy.golang.org,direct',
        required: false,
        description: 'Go模块代理'
      },
      {
        key: 'GOPRIVATE',
        defaultValue: '',
        required: false,
        description: '私有模块路径'
      }
    ];

    // Web框架特定环境变量
    if (stack.frameworks.length > 0) {
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

module.exports = GoDetector;
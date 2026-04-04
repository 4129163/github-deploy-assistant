/**
 * Python项目类型检测器
 * 检测Python项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class PythonDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'PythonDetector';
    this.version = '1.0.0';
    this.description = '检测Python项目类型';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['python', 'django', 'flask', 'fastapi'];
    this.priority = 85;
  }

  /**
   * 检测Python项目
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
          error: '未检测到足够的Python项目特征'
        });
      }

      // 分析技术栈详情
      const stack = await this.analyzeStack(projectInfo, indicators);
      const keyFiles = this.identifyKeyFiles(files);
      const deployment = this.generateDeploymentRecommendation(projectInfo, stack);

      return this.createDetectionResult({
        success: true,
        projectType: this.determineExactType(indicators, stack),
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
          message: 'Python检测器执行失败',
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
      requirementsFiles: [],
      pyFiles: 0,
      pyProjectToml: false,
      setupPy: false,
      setupCfg: false,
      pipfile: false,
      poetryLock: false,
      djangoFiles: [],
      flaskFiles: [],
      fastapiFiles: [],
      venvDir: false,
      condaEnv: false
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';

      // 检查requirements文件
      if (fileName === 'requirements.txt' || fileName === 'requirements-dev.txt') {
        indicators.requirementsFiles.push(fileName);
      }

      // 检查pyproject.toml
      if (fileName === 'pyproject.toml') {
        indicators.pyProjectToml = true;
      }

      // 检查setup.py和setup.cfg
      if (fileName === 'setup.py') indicators.setupPy = true;
      if (fileName === 'setup.cfg') indicators.setupCfg = true;

      // 检查Pipfile
      if (fileName === 'Pipfile') indicators.pipfile = true;
      if (fileName === 'Pipfile.lock') indicators.pipfileLock = true;

      // 检查Poetry
      if (fileName === 'poetry.lock') indicators.poetryLock = true;

      // 统计Python文件
      if (fileName.endsWith('.py')) {
        indicators.pyFiles++;
        
        // 检查框架特定文件
        if (this.isDjangoFile(fileName, filePath)) {
          indicators.djangoFiles.push({ fileName, filePath });
        }
        if (this.isFlaskFile(fileName, filePath)) {
          indicators.flaskFiles.push({ fileName, filePath });
        }
        if (this.isFastAPIFile(fileName, filePath)) {
          indicators.fastapiFiles.push({ fileName, filePath });
        }
      }

      // 检查虚拟环境目录
      if (filePath.includes('/venv/') || filePath.includes('/.venv/')) {
        indicators.venvDir = true;
      }
      if (fileName === 'environment.yml' || fileName === 'environment.yaml') {
        indicators.condaEnv = true;
      }

      // 检查配置文件
      if (fileName === 'manage.py') indicators.hasManagePy = true;
      if (fileName === 'wsgi.py') indicators.hasWsgiPy = true;
      if (fileName === 'asgi.py') indicators.hasAsgiPy = true;
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

    // Python文件数量
    if (indicators.pyFiles > 0) {
      if (indicators.pyFiles >= 10) score += 3;
      else if (indicators.pyFiles >= 3) score += 2;
      else score += 1;
    }

    // 依赖管理文件
    if (indicators.requirementsFiles.length > 0) score += 2;
    if (indicators.pyProjectToml) score += 2;
    if (indicators.setupPy || indicators.setupCfg) score += 1;
    if (indicators.pipfile) score += 1.5;
    if (indicators.poetryLock) score += 1.5;

    // 框架文件
    if (indicators.djangoFiles.length > 0) score += 2;
    if (indicators.flaskFiles.length > 0) score += 1.5;
    if (indicators.fastapiFiles.length > 0) score += 1.5;

    // 虚拟环境
    if (indicators.venvDir) score += 1;
    if (indicators.condaEnv) score += 1;

    // 特定配置文件
    if (indicators.hasManagePy) score += 1;
    if (indicators.hasWsgiPy || indicators.hasAsgiPy) score += 1;

    // 计算最终置信度
    const confidence = Math.min(score / maxScore, 1);
    return confidence;
  }

  /**
   * 确定具体的项目类型
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈信息
   * @returns {string} 项目类型
   */
  determineExactType(indicators, stack) {
    // 检查框架
    if (indicators.djangoFiles.length > 0 || stack.frameworks.some(f => f.name === 'Django')) {
      return 'django';
    }
    if (indicators.flaskFiles.length > 0 || stack.frameworks.some(f => f.name === 'Flask')) {
      return 'flask';
    }
    if (indicators.fastapiFiles.length > 0 || stack.frameworks.some(f => f.name === 'FastAPI')) {
      return 'fastapi';
    }

    // 默认返回python
    return 'python';
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
        name: 'python',
        version: null,
        required: true
      },
      packageManager: {
        name: this.determinePackageManager(indicators),
        version: null,
        lockFile: null
      },
      frameworks: [],
      buildTool: null,
      databases: [],
      otherTools: []
    };

    // 分析requirements文件
    await this.analyzeRequirements(projectInfo, stack);

    // 分析pyproject.toml
    await this.analyzePyProjectToml(projectInfo, stack);

    // 检测框架
    this.detectFrameworksFromIndicators(indicators, stack.frameworks);

    // 设置包管理器锁文件
    this.setPackageManagerLockFile(indicators, stack.packageManager);

    return stack;
  }

  /**
   * 确定包管理器
   * @param {Object} indicators - 检测指标
   * @returns {string} 包管理器名称
   */
  determinePackageManager(indicators) {
    if (indicators.poetryLock) return 'poetry';
    if (indicators.pipfile) return 'pipenv';
    if (indicators.pyProjectToml) return 'pip'; // 或poetry/pip-tools
    if (indicators.requirementsFiles.length > 0) return 'pip';
    return 'pip'; // 默认
  }

  /**
   * 分析requirements文件
   * @param {Object} projectInfo - 项目信息
   * @param {Object} stack - 技术栈对象
   */
  async analyzeRequirements(projectInfo, stack) {
    const { files } = projectInfo;
    
    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      
      if (fileName === 'requirements.txt' && file.content) {
        const content = typeof file.content === 'string' ? file.content : '';
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          // 解析依赖行，如 "Django==4.2.0"
          const match = trimmed.match(/^([a-zA-Z0-9_-]+)([<>=!~]+.*)?$/);
          if (match) {
            const packageName = match[1].toLowerCase();
            const versionSpec = match[2] || '';
            
            // 检测框架
            if (packageName === 'django') {
              stack.frameworks.push({
                name: 'Django',
                package: 'django',
                version: versionSpec,
                required: true
              });
            } else if (packageName === 'flask') {
              stack.frameworks.push({
                name: 'Flask',
                package: 'flask',
                version: versionSpec,
                required: true
              });
            } else if (packageName === 'fastapi') {
              stack.frameworks.push({
                name: 'FastAPI',
                package: 'fastapi',
                version: versionSpec,
                required: true
              });
            }
            
            // 检测数据库
            const dbPackages = {
              'psycopg2': 'PostgreSQL',
              'psycopg2-binary': 'PostgreSQL',
              'mysqlclient': 'MySQL',
              'pymysql': 'MySQL',
              'sqlite3': 'SQLite',
              'redis': 'Redis',
              'pymongo': 'MongoDB',
              'sqlalchemy': 'SQLAlchemy',
              'django-orm': 'Django ORM'
            };
            
            if (dbPackages[packageName]) {
              stack.databases.push({
                name: dbPackages[packageName],
                package: packageName,
                version: versionSpec,
                required: true
              });
            }
          }
        }
      }
    }
  }

  /**
   * 分析pyproject.toml文件
   * @param {Object} projectInfo - 项目信息
   * @param {Object} stack - 技术栈对象
   */
  async analyzePyProjectToml(projectInfo, stack) {
    // 这里可以添加TOML解析逻辑
    // 目前仅标记存在pyproject.toml
    if (stack.packageManager.name === 'poetry') {
      stack.buildTool = {
        name: 'Poetry',
        required: true
      };
    }
  }

  /**
   * 从指标检测框架
   * @param {Object} indicators - 检测指标
   * @param {Array} frameworks - 框架数组
   */
  detectFrameworksFromIndicators(indicators, frameworks) {
    if (indicators.djangoFiles.length > 0) {
      frameworks.push({
        name: 'Django',
        required: true
      });
    }
    if (indicators.flaskFiles.length > 0) {
      frameworks.push({
        name: 'Flask',
        required: true
      });
    }
    if (indicators.fastapiFiles.length > 0) {
      frameworks.push({
        name: 'FastAPI',
        required: true
      });
    }
  }

  /**
   * 设置包管理器锁文件
   * @param {Object} indicators - 检测指标
   * @param {Object} packageManager - 包管理器对象
   */
  setPackageManagerLockFile(indicators, packageManager) {
    if (packageManager.name === 'pip' && indicators.requirementsFiles.length > 0) {
      packageManager.lockFile = 'requirements.txt';
    } else if (packageManager.name === 'pipenv' && indicators.pipfile) {
      packageManager.lockFile = 'Pipfile.lock';
    } else if (packageManager.name === 'poetry' && indicators.poetryLock) {
      packageManager.lockFile = 'poetry.lock';
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
      'requirements.txt',
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
      'Pipfile',
      'Pipfile.lock',
      'poetry.lock',
      'manage.py',
      'wsgi.py',
      'asgi.py',
      'main.py',
      'app.py',
      '__init__.py',
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
    const criticalFiles = ['requirements.txt', 'manage.py', 'main.py', 'app.py'];
    const highFiles = ['pyproject.toml', 'setup.py', 'Pipfile', 'Dockerfile'];
    
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
    
    if (fileName.endsWith('.py')) indicators.push('python', 'source-code');
    if (fileName.includes('requirements')) indicators.push('dependencies');
    if (fileName.includes('setup')) indicators.push('setup', 'configuration');
    if (fileName === 'Pipfile' || fileName === 'pyproject.toml') indicators.push('package-manager');
    if (fileName === 'manage.py') indicators.push('django', 'management');
    
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
      strategy: 'gunicorn', // 默认使用gunicorn
      startCommand: this.determineStartCommand(projectInfo, stack),
      buildCommand: null, // Python通常不需要构建
      envVars: this.getRequiredEnvVars(projectInfo, stack),
      ports: [8000, 8080, 5000], // 常见的Python端口
      healthCheck: '/health',
      dependencies: ['python3', 'pip']
    };

    // 根据框架调整策略
    if (stack.frameworks.some(f => f.name === 'Django')) {
      deployment.strategy = 'django';
      deployment.startCommand = 'python manage.py runserver';
    } else if (stack.frameworks.some(f => f.name === 'Flask')) {
      deployment.strategy = 'flask';
    } else if (stack.frameworks.some(f => f.name === 'FastAPI')) {
      deployment.strategy = 'uvicorn';
      deployment.startCommand = 'uvicorn main:app --reload';
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
    const { files } = projectInfo;
    
    // 检查常见的入口文件
    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      if (fileName === 'manage.py') {
        return 'python manage.py runserver';
      }
      if (fileName === 'main.py' || fileName === 'app.py') {
        return `python ${fileName}`;
      }
    }
    
    // 根据框架决定
    if (stack.frameworks.some(f => f.name === 'FastAPI')) {
      return 'uvicorn main:app --reload';
    }
    
    // 默认
    return 'python app.py';
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
        key: 'PYTHONPATH',
        defaultValue: '.',
        required: false,
        description: 'Python模块搜索路径'
      },
      {
        key: 'PYTHONUNBUFFERED',
        defaultValue: '1',
        required: false,
        description: '禁用输出缓冲'
      }
    ];

    // Django特定环境变量
    if (stack.frameworks.some(f => f.name === 'Django')) {
      envVars.push({
        key: 'DJANGO_SETTINGS_MODULE',
        defaultValue: 'project.settings',
        required: true,
        description: 'Django设置模块'
      });
      envVars.push({
        key: 'DJANGO_SECRET_KEY',
        defaultValue: '',
        required: true,
        description: 'Django安全密钥'
      });
      envVars.push({
        key: 'DJANGO_DEBUG',
        defaultValue: 'False',
        required: false,
        description: 'Django调试模式'
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

  /**
   * 检查是否是Django文件
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否是Django文件
   */
  isDjangoFile(fileName, filePath) {
    const djangoPatterns = [
      /manage\.py$/,
      /settings\.py$/,
      /urls\.py$/,
      /wsgi\.py$/,
      /asgi\.py$/,
      /models\.py$/,
      /views\.py$/,
      /admin\.py$/
    ];

    return djangoPatterns.some(pattern => 
      pattern.test(fileName) || pattern.test(filePath)
    );
  }

  /**
   * 检查是否是Flask文件
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否是Flask文件
   */
  isFlaskFile(fileName, filePath) {
    const flaskPatterns = [
      /app\.py$/,
      /application\.py$/,
      /flask_app\.py$/,
      /__init__\.py$/
    ];

    if (flaskPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
      // 还可以检查文件内容中是否导入flask
      return true;
    }
    return false;
  }

  /**
   * 检查是否是FastAPI文件
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否是FastAPI文件
   */
  isFastAPIFile(fileName, filePath) {
    const fastapiPatterns = [
      /main\.py$/,
      /fastapi_app\.py$/,
      /api\.py$/
    ];

    if (fastapiPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
      return true;
    }
    return false;
  }
}

module.exports = PythonDetector;
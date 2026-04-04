/**
 * Java项目类型检测器
 * 检测Java项目
 */

const { ProjectTypeDetector } = require('../interfaces');

class JavaDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'JavaDetector';
    this.version = '1.0.0';
    this.description = '检测Java项目类型';
    this.author = 'GitHub Deploy Assistant Team';
    this.supportedTypes = ['java', 'spring', 'maven', 'gradle'];
    this.priority = 75;
  }

  /**
   * 检测Java项目
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
          error: '未检测到足够的Java项目特征'
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
          message: 'Java检测器执行失败',
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
      pomXml: false,
      buildGradle: false,
      buildGradleKts: false,
      gradleWrapper: false,
      javaFiles: 0,
      classFiles: 0,
      springFiles: [],
      mavenDir: false,
      gradleDir: false,
      srcMainJava: false,
      srcTestJava: false,
      applicationProperties: false,
      applicationYml: false
    };

    for (const file of files) {
      const fileName = file.name || file.path.split('/').pop();
      const filePath = file.path || '';

      // 检查Maven配置文件
      if (fileName === 'pom.xml') {
        indicators.pomXml = true;
        if (file.content) {
          try {
            indicators.pomXmlContent = file.content;
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }

      // 检查Gradle配置文件
      if (fileName === 'build.gradle') indicators.buildGradle = true;
      if (fileName === 'build.gradle.kts') indicators.buildGradleKts = true;
      if (fileName === 'gradlew' || fileName === 'gradlew.bat') indicators.gradleWrapper = true;

      // 统计Java文件
      if (fileName.endsWith('.java')) {
        indicators.javaFiles++;
        
        // 检查Spring相关文件
        if (this.isSpringFile(fileName, filePath, file.content)) {
          indicators.springFiles.push({ fileName, filePath });
        }
      }

      // 统计class文件
      if (fileName.endsWith('.class')) indicators.classFiles++;

      // 检查目录结构
      if (filePath.includes('/.mvn/')) indicators.mavenDir = true;
      if (filePath.includes('/.gradle/')) indicators.gradleDir = true;
      if (filePath.includes('/src/main/java/')) indicators.srcMainJava = true;
      if (filePath.includes('/src/test/java/')) indicators.srcTestJava = true;

      // 检查配置文件
      if (fileName === 'application.properties' || fileName === 'application.yml') {
        indicators.applicationProperties = true;
      }
      if (fileName === 'application.yml' || fileName === 'application.yaml') {
        indicators.applicationYml = true;
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

    // 构建配置文件
    if (indicators.pomXml) score += 3;
    if (indicators.buildGradle || indicators.buildGradleKts) score += 3;
    if (indicators.gradleWrapper) score += 1;

    // Java文件数量
    if (indicators.javaFiles > 0) {
      if (indicators.javaFiles >= 10) score += 3;
      else if (indicators.javaFiles >= 3) score += 2;
      else score += 1;
    }

    // 编译输出文件
    if (indicators.classFiles > 0) score += 1;

    // 目录结构
    if (indicators.srcMainJava) score += 1;
    if (indicators.srcTestJava) score += 0.5;
    if (indicators.mavenDir) score += 0.5;
    if (indicators.gradleDir) score += 0.5;

    // Spring特征
    if (indicators.springFiles.length > 0) score += 2;
    if (indicators.applicationProperties || indicators.applicationYml) score += 1;

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
    // 检查构建工具
    if (indicators.pomXml) {
      if (indicators.springFiles.length > 0 || stack.frameworks.some(f => f.name.includes('Spring'))) {
        return 'spring';
      }
      return 'maven';
    }
    
    if (indicators.buildGradle || indicators.buildGradleKts) {
      if (indicators.springFiles.length > 0 || stack.frameworks.some(f => f.name.includes('Spring'))) {
        return 'spring';
      }
      return 'gradle';
    }

    // 默认返回java
    return 'java';
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
        name: 'java',
        version: null,
        required: true
      },
      packageManager: {
        name: this.determinePackageManager(indicators),
        version: null,
        configFile: this.getConfigFile(indicators)
      },
      frameworks: [],
      buildTool: null,
      databases: [],
      otherTools: []
    };

    // 分析pom.xml或build.gradle
    await this.analyzeBuildFile(indicators, stack);

    // 检测Spring版本
    this.detectSpringVersion(indicators, stack);

    return stack;
  }

  /**
   * 确定包管理器
   * @param {Object} indicators - 检测指标
   * @returns {string} 包管理器名称
   */
  determinePackageManager(indicators) {
    if (indicators.pomXml) return 'maven';
    if (indicators.buildGradle || indicators.buildGradleKts) return 'gradle';
    return 'unknown';
  }

  /**
   * 获取配置文件
   * @param {Object} indicators - 检测指标
   * @returns {string|null} 配置文件路径
   */
  getConfigFile(indicators) {
    if (indicators.pomXml) return 'pom.xml';
    if (indicators.buildGradle) return 'build.gradle';
    if (indicators.buildGradleKts) return 'build.gradle.kts';
    return null;
  }

  /**
   * 分析构建文件
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  async analyzeBuildFile(indicators, stack) {
    // Maven pom.xml分析
    if (indicators.pomXmlContent) {
      const content = typeof indicators.pomXmlContent === 'string' 
        ? indicators.pomXmlContent 
        : JSON.stringify(indicators.pomXmlContent);
      
      // 简单的XML解析（实际项目中应该使用XML解析库）
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // 解析groupId和artifactId
        if (trimmed.includes('<groupId>')) {
          const match = trimmed.match(/<groupId>([^<]+)<\/groupId>/);
          if (match) stack.groupId = match[1];
        }
        
        if (trimmed.includes('<artifactId>')) {
          const match = trimmed.match(/<artifactId>([^<]+)<\/artifactId>/);
          if (match) stack.artifactId = match[1];
        }
        
        if (trimmed.includes('<version>')) {
          const match = trimmed.match(/<version>([^<]+)<\/version>/);
          if (match) stack.version = match[1];
        }
        
        // 解析依赖
        if (trimmed.includes('<dependency>')) {
          // 这里可以添加更复杂的依赖解析逻辑
        }
      }
    }

    // 设置构建工具
    if (stack.packageManager.name === 'maven') {
      stack.buildTool = {
        name: 'Maven',
        required: true
      };
    } else if (stack.packageManager.name === 'gradle') {
      stack.buildTool = {
        name: 'Gradle',
        required: true
      };
    }
  }

  /**
   * 检测Spring版本
   * @param {Object} indicators - 检测指标
   * @param {Object} stack - 技术栈对象
   */
  detectSpringVersion(indicators, stack) {
    if (indicators.springFiles.length > 0) {
      // 检查Spring Boot特征
      const hasSpringBoot = indicators.springFiles.some(file => 
        file.fileName.includes('Application') || 
        file.filePath.includes('@SpringBootApplication')
      );
      
      if (hasSpringBoot) {
        stack.frameworks.push({
          name: 'Spring Boot',
          required: true
        });
      } else {
        stack.frameworks.push({
          name: 'Spring Framework',
          required: true
        });
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
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      'gradlew',
      'gradlew.bat',
      'application.properties',
      'application.yml',
      'application.yaml',
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
    const criticalFiles = ['pom.xml', 'build.gradle', 'application.properties'];
    const highFiles = ['build.gradle.kts', 'gradlew', 'Dockerfile'];
    
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
    
    if (fileName.endsWith('.java')) indicators.push('java', 'source-code');
    if (fileName === 'pom.xml') indicators.push('maven', 'configuration');
    if (fileName.includes('build.gradle')) indicators.push('gradle', 'configuration');
    if (fileName.includes('application.')) indicators.push('spring', 'configuration');
    if (fileName === 'gradlew') indicators.push('gradle-wrapper', 'executable');
    
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
      strategy: 'jar', // Java通常打包为JAR文件
      startCommand: this.determineStartCommand(projectInfo, stack),
      buildCommand: this.determineBuildCommand(stack),
      envVars: this.getRequiredEnvVars(projectInfo, stack),
      ports: [8080, 8081, 9000], // 常见的Java端口
      healthCheck: '/actuator/health',
      dependencies: ['java', stack.packageManager.name]
    };

    // Spring Boot特定配置
    if (stack.frameworks.some(f => f.name.includes('Spring'))) {
      deployment.strategy = 'spring-boot';
      deployment.healthCheck = '/actuator/health';
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
    if (stack.frameworks.some(f => f.name.includes('Spring Boot'))) {
      // Spring Boot项目
      if (stack.packageManager.name === 'maven') {
        return 'java -jar target/*.jar';
      } else if (stack.packageManager.name === 'gradle') {
        return 'java -jar build/libs/*.jar';
      }
    }
    
    // 默认启动命令
    return 'java -jar app.jar';
  }

  /**
   * 确定构建命令
   * @param {Object} stack - 技术栈信息
   * @returns {string} 构建命令
   */
  determineBuildCommand(stack) {
    if (stack.packageManager.name === 'maven') {
      return 'mvn clean package -DskipTests';
    } else if (stack.packageManager.name === 'gradle') {
      return './gradlew build -x test';
    }
    
    return null;
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
        key: 'JAVA_HOME',
        defaultValue: '/usr/lib/jvm/default-java',
        required: true,
        description: 'Java安装路径'
      },
      {
        key: 'JAVA_OPTS',
        defaultValue: '-Xmx512m -Xms256m',
        required: false,
        description: 'Java虚拟机参数'
      }
    ];

    // Spring Boot特定环境变量
    if (stack.frameworks.some(f => f.name.includes('Spring'))) {
      envVars.push({
        key: 'SPRING_PROFILES_ACTIVE',
        defaultValue: 'production',
        required: false,
        description: 'Spring激活的配置文件'
      });
      envVars.push({
        key: 'SERVER_PORT',
        defaultValue: '8080',
        required: false,
        description: '服务器端口'
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
      envVars.push({
        key: 'DATABASE_USERNAME',
        defaultValue: '',
        required: true,
        description: '数据库用户名'
      });
      envVars.push({
        key: 'DATABASE_PASSWORD',
        defaultValue: '',
        required: true,
        description: '数据库密码'
      });
    }

    return envVars;
  }

  /**
   * 检查是否是Spring文件
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径
   * @param {string|Object} content - 文件内容
   * @returns {boolean} 是否是Spring文件
   */
  isSpringFile(fileName, filePath, content) {
    // 文件名包含Spring关键词
    const springFileNamePatterns = [
      /Application\.java$/,
      /Controller\.java$/,
      /Service\.java$/,
      /Repository\.java$/,
      /Config\.java$/,
      /Spring.*\.java$/
    ];

    if (springFileNamePatterns.some(pattern => pattern.test(fileName))) {
      return true;
    }

    // 文件内容包含Spring注解
    if (content) {
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const springAnnotations = [
        '@SpringBootApplication',
        '@RestController',
        '@Controller',
        '@Service',
        '@Repository',
        '@Component',
        '@Autowired',
        '@Configuration',
        '@Bean'
      ];

      return springAnnotations.some(annotation => contentStr.includes(annotation));
    }

    return false;
  }
}

module.exports = JavaDetector;
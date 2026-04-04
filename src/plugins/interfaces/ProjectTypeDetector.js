/**
 * 项目类型检测器接口
 * 专用于项目类型识别的插件接口，扩展自BasePlugin
 */

const BasePlugin = require('./BasePlugin');

class ProjectTypeDetector extends BasePlugin {
  constructor() {
    super();
    this.name = 'ProjectTypeDetector';
    this.description = '项目类型检测器基础接口';
    this.supportedTypes = []; // 支持的检测类型数组
    this.priority = 50; // 检测优先级（0-100，数值越高优先级越高）
    this.timeout = 30000; // 检测超时时间（毫秒）
  }

  /**
   * 检测项目类型
   * @param {Object} projectInfo - 项目信息对象
   * @param {string} projectInfo.path - 项目路径
   * @param {Array} projectInfo.files - 文件列表
   * @param {Object} projectInfo.stats - 项目统计信息
   * @param {Object} projectInfo.metadata - 项目元数据
   * @returns {Promise<DetectionResult>} 检测结果
   */
  async detect(projectInfo) {
    throw new Error('detect method must be implemented by subclass');
  }

  /**
   * 验证检测结果
   * @param {DetectionResult} result - 检测结果
   * @returns {Promise<ValidationResult>} 验证结果
   */
  async validate(result) {
    // 默认验证逻辑
    const validation = {
      valid: true,
      confidence: result.confidence || 0,
      suggestions: [],
      errors: []
    };

    // 基本验证规则
    if (!result.success) {
      validation.valid = false;
      validation.errors.push('检测未成功');
    }

    if (result.projectType === 'unknown' && result.confidence > 0.5) {
      validation.warnings = validation.warnings || [];
      validation.warnings.push({
        code: 'W001',
        message: '检测到未知项目类型但置信度较高，建议检查检测逻辑',
        severity: 'low'
      });
    }

    if (result.confidence < 0.3) {
      validation.warnings = validation.warnings || [];
      validation.warnings.push({
        code: 'W002',
        message: '检测置信度过低，结果可能不可靠',
        severity: 'medium'
      });
    }

    return validation;
  }

  /**
   * 获取支持的检测类型
   * @returns {Array<string>} 支持的类型列表
   */
  getSupportedTypes() {
    return this.supportedTypes;
  }

  /**
   * 获取检测优先级
   * @returns {number} 优先级
   */
  getPriority() {
    return this.priority;
  }

  /**
   * 获取检测超时时间
   * @returns {number} 超时时间（毫秒）
   */
  getTimeout() {
    return this.timeout;
  }

  /**
   * 设置检测优先级
   * @param {number} priority - 新的优先级（0-100）
   */
  setPriority(priority) {
    if (priority < 0 || priority > 100) {
      throw new Error('优先级必须在0-100之间');
    }
    this.priority = priority;
  }

  /**
   * 检查是否支持特定项目类型
   * @param {string} projectType - 项目类型
   * @returns {boolean} 是否支持
   */
  supportsType(projectType) {
    return this.supportedTypes.includes(projectType);
  }

  /**
   * 收集项目文件信息（辅助方法）
   * @param {string} projectPath - 项目路径
   * @returns {Promise<Object>} 项目文件信息
   */
  async collectProjectFiles(projectPath) {
    // 这是一个辅助方法，子类可以使用它来收集项目文件
    // 实际的实现应该在插件管理器中提供
    if (this.context && this.context.fileSystem) {
      return await this.context.fileSystem.scanProject(projectPath);
    }
    
    // 如果没有文件系统服务，返回空结构
    return {
      path: projectPath,
      files: [],
      stats: {
        fileCount: 0,
        totalSize: 0,
        lastModified: new Date().toISOString()
      },
      metadata: {}
    };
  }

  /**
   * 分析文件内容（辅助方法）
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Object} 分析结果
   */
  analyzeFileContent(filePath, content) {
    const analysis = {
      filePath,
      indicators: [],
      patterns: [],
      metadata: {}
    };

    // 检测常见的项目文件特征
    const commonIndicators = [
      { pattern: /package\.json/, type: 'nodejs' },
      { pattern: /requirements\.txt/, type: 'python' },
      { pattern: /Cargo\.toml/, type: 'rust' },
      { pattern: /pom\.xml/, type: 'java' },
      { pattern: /go\.mod/, type: 'go' },
      { pattern: /Dockerfile/, type: 'docker' },
      { pattern: /docker-compose\.yml/, type: 'docker' },
      { pattern: /\.gitignore/, type: 'git' },
      { pattern: /README\.md/, type: 'documentation' }
    ];

    // 检测文件路径中的模式
    for (const indicator of commonIndicators) {
      if (indicator.pattern.test(filePath)) {
        analysis.indicators.push({
          type: indicator.type,
          source: 'filename',
          confidence: 1.0
        });
      }
    }

    // 检测文件内容中的模式
    if (content) {
      // 检测JSON配置文件
      if (filePath.endsWith('.json')) {
        try {
          const json = JSON.parse(content);
          analysis.metadata.json = {
            valid: true,
            keys: Object.keys(json)
          };
        } catch (e) {
          analysis.metadata.json = {
            valid: false,
            error: e.message
          };
        }
      }

      // 检测package.json特定字段
      if (filePath.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(content);
          if (pkg.dependencies) {
            analysis.indicators.push({
              type: 'dependencies',
              source: 'package.json',
              count: Object.keys(pkg.dependencies).length
            });
          }
          if (pkg.scripts) {
            analysis.indicators.push({
              type: 'scripts',
              source: 'package.json',
              count: Object.keys(pkg.scripts).length
            });
          }
        } catch (e) {
          // 解析失败，忽略
        }
      }
    }

    return analysis;
  }

  /**
   * 创建标准化的检测结果
   * @param {Object} options - 结果选项
   * @returns {DetectionResult} 标准化的检测结果
   */
  createDetectionResult(options = {}) {
    const {
      success = false,
      projectType = 'unknown',
      confidence = 0,
      stack = {},
      keyFiles = [],
      deployment = null,
      error = null,
      warnings = []
    } = options;

    const result = {
      success,
      projectType,
      confidence: Math.max(0, Math.min(1, confidence)), // 确保在0-1范围内
      stack: this.normalizeStack(stack),
      keyFiles: this.normalizeKeyFiles(keyFiles),
      plugin: this.getMetadata(),
      detectionTime: new Date().toISOString(),
      error,
      warnings
    };

    if (deployment) {
      result.deployment = this.normalizeDeployment(deployment);
    }

    return result;
  }

  /**
   * 标准化技术栈信息
   * @param {Object} stack - 原始技术栈信息
   * @returns {Object} 标准化的技术栈信息
   */
  normalizeStack(stack) {
    return {
      runtime: stack.runtime || { name: 'unknown', version: null, required: false },
      buildTool: stack.buildTool || { name: null, version: null, required: false },
      packageManager: stack.packageManager || { name: null, version: null, lockFile: null },
      frameworks: stack.frameworks || [],
      databases: stack.databases || [],
      otherTools: stack.otherTools || []
    };
  }

  /**
   * 标准化关键文件信息
   * @param {Array} keyFiles - 原始关键文件列表
   * @returns {Array} 标准化的关键文件列表
   */
  normalizeKeyFiles(keyFiles) {
    return keyFiles.map(file => ({
      path: file.path || '',
      exists: file.exists !== undefined ? file.exists : true,
      content: file.content || {},
      indicators: file.indicators || [],
      importance: file.importance || 'medium' // 'low', 'medium', 'high', 'critical'
    }));
  }

  /**
   * 标准化部署信息
   * @param {Object} deployment - 原始部署信息
   * @returns {Object} 标准化的部署信息
   */
  normalizeDeployment(deployment) {
    return {
      strategy: deployment.strategy || 'direct',
      startCommand: deployment.startCommand || '',
      buildCommand: deployment.buildCommand || null,
      envVars: deployment.envVars || [],
      ports: deployment.ports || [],
      healthCheck: deployment.healthCheck || null,
      dependencies: deployment.dependencies || []
    };
  }
}

module.exports = ProjectTypeDetector;
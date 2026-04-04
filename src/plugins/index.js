/**
 * 插件管理器主模块
 * 统一管理插件系统的所有功能
 */

const CoreServices = require('./services/CoreServices');
const PluginLoader = require('./loader');
const { getAllDetectorInfo } = require('./detectors');

class PluginManager {
  constructor(config = {}) {
    this.config = {
      // 核心服务配置
      services: {
        filesystem: {
          maxFileSize: 10 * 1024 * 1024,
          allowedExtensions: ['.js', '.json', '.md', '.txt', '.py', '.java', '.go', '.rs', '.toml', '.yml', '.yaml', '.xml']
        },
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 100
        },
        ...config.services
      },
      
      // 插件加载器配置
      loader: {
        builtin: {
          enabled: true,
          autoLoad: true
        },
        external: {
          enabled: true,
          directories: ['./plugins', '~/.github-deploy-assistant/plugins'],
          scanInterval: 30000,
          autoReload: false,
          maxPlugins: 50
        },
        ...config.loader
      },
      
      // 性能配置
      performance: {
        timeout: 30000,
        maxMemory: 256,
        concurrentLimit: 5,
        ...config.performance
      },
      
      // 默认配置
      ...config
    };
    
    this.services = null;
    this.loader = null;
    this.initialized = false;
  }

  /**
   * 初始化插件管理器
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      throw new Error('插件管理器已经初始化');
    }
    
    // 初始化核心服务
    this.services = new CoreServices(this.config.services);
    await this.services.init();
    
    // 初始化插件加载器
    this.loader = new PluginLoader(this.config.loader);
    await this.loader.init(this.services.getPluginContext('PluginManager'));
    
    this.initialized = true;
    
    this.log('info', '插件管理器初始化完成', {
      config: {
        services: this.config.services,
        loader: this.config.loader,
        performance: this.config.performance
      }
    });
    
    // 记录初始化指标
    this.services.metricsService.increment('manager_init');
  }

  /**
   * 检测项目类型
   * @param {string} projectPath - 项目路径
   * @param {Object} options - 检测选项
   * @returns {Promise<Object>} 检测结果
   */
  async detectProjectType(projectPath, options = {}) {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      // 收集项目信息
      const projectInfo = await this.collectProjectInfo(projectPath, options);
      
      // 执行插件检测
      const detectionResults = await this.loader.detectProject(projectInfo, options.pluginTypes);
      
      // 分析结果
      const analysis = this.analyzeDetectionResults(detectionResults, options);
      
      // 记录指标
      const duration = Date.now() - startTime;
      this.services.metricsService.histogram('detection_duration', duration);
      this.services.metricsService.increment('detection_total');
      
      if (analysis.bestResult) {
        this.services.metricsService.increment('detection_success');
      } else {
        this.services.metricsService.increment('detection_failed');
      }
      
      return {
        success: true,
        projectPath,
        projectInfo: {
          path: projectInfo.path,
          fileCount: projectInfo.stats.fileCount,
          totalSize: projectInfo.stats.totalSize
        },
        analysis,
        detectionResults: detectionResults.map(r => ({
          plugin: r.plugin,
          success: r.success,
          confidence: r.result?.confidence || 0,
          projectType: r.result?.projectType || 'unknown'
        })),
        metadata: {
          detectionTime: new Date().toISOString(),
          duration,
          pluginCount: detectionResults.length
        }
      };
    } catch (error) {
      // 记录错误指标
      this.services.metricsService.increment('detection_error');
      
      this.log('error', '项目检测失败', {
        projectPath,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        projectPath,
        error: error.message,
        metadata: {
          detectionTime: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 收集项目信息
   * @param {string} projectPath - 项目路径
   * @param {Object} options - 收集选项
   * @returns {Promise<Object>} 项目信息
   */
  async collectProjectInfo(projectPath, options = {}) {
    this.log('info', '开始收集项目信息', { projectPath });
    
    // 扫描项目文件
    const scanResult = await this.services.filesystem.scanProject(projectPath, {
      maxDepth: options.maxDepth || 3,
      excludePatterns: options.excludePatterns || [
        'node_modules',
        '.git',
        '.DS_Store',
        '*.log',
        '*.tmp'
      ]
    });
    
    // 提取文件内容（可选）
    const filesWithContent = [];
    if (options.includeContent) {
      // 限制读取的文件数量和大小
      const maxFiles = options.maxContentFiles || 20;
      const maxFileSize = options.maxContentSize || 1024 * 1024; // 1MB
      
      for (let i = 0; i < Math.min(scanResult.files.length, maxFiles); i++) {
        const file = scanResult.files[i];
        
        if (file.size > maxFileSize) {
          continue;
        }
        
        try {
          const content = await this.services.filesystem.readFile(file.absolutePath);
          filesWithContent.push({
            ...file,
            content: this.extractFileContentPreview(content, options.contentPreviewLength || 1000)
          });
        } catch (error) {
          // 读取失败，跳过
          filesWithContent.push({
            ...file,
            content: null,
            error: error.message
          });
        }
      }
    }
    
    const projectInfo = {
      path: projectPath,
      files: options.includeContent ? filesWithContent : scanResult.files,
      stats: scanResult.stats,
      metadata: {
        collectedAt: new Date().toISOString(),
        includeContent: options.includeContent || false,
        fileCount: scanResult.files.length
      }
    };
    
    this.log('info', '项目信息收集完成', {
      projectPath,
      fileCount: projectInfo.files.length,
      totalSize: this.services.utils.formatFileSize(projectInfo.stats.totalSize)
    });
    
    return projectInfo;
  }

  /**
   * 分析检测结果
   * @param {Array} detectionResults - 检测结果数组
   * @param {Object} options - 分析选项
   * @returns {Object} 分析结果
   */
  analyzeDetectionResults(detectionResults, options = {}) {
    const successfulResults = detectionResults.filter(r => 
      r.success && r.result && r.result.success
    );
    
    const failedResults = detectionResults.filter(r => !r.success);
    
    if (successfulResults.length === 0) {
      return {
        bestResult: null,
        confidence: 0,
        suggestions: failedResults.map(r => ({
          plugin: r.plugin?.name,
          error: r.error,
          suggestion: '检查插件配置或项目结构'
        })),
        warnings: ['未检测到任何项目类型']
      };
    }
    
    // 按置信度排序
    successfulResults.sort((a, b) => {
      const confidenceA = a.result.confidence || 0;
      const confidenceB = b.result.confidence || 0;
      return confidenceB - confidenceA;
    });
    
    const bestResult = successfulResults[0].result;
    const confidenceThreshold = options.confidenceThreshold || 0.5;
    
    let analysis = {
      bestResult,
      confidence: bestResult.confidence || 0,
      allResults: successfulResults.map(r => ({
        plugin: r.plugin,
        result: r.result,
        confidence: r.result.confidence || 0
      })),
      metadata: {
        totalResults: detectionResults.length,
        successfulResults: successfulResults.length,
        failedResults: failedResults.length,
        confidenceThreshold
      }
    };
    
    // 添加建议
    if (bestResult.confidence < confidenceThreshold) {
      analysis.suggestions = [
        '检测置信度过低，建议手动检查项目类型',
        '尝试添加更多项目特征文件'
      ];
    }
    
    // 添加警告
    if (failedResults.length > 0) {
      analysis.warnings = [
        `${failedResults.length} 个插件检测失败`
      ];
    }
    
    // 检查结果一致性
    if (successfulResults.length > 1) {
      const uniqueTypes = new Set(successfulResults.map(r => r.result.projectType));
      if (uniqueTypes.size > 1) {
        analysis.warnings = analysis.warnings || [];
        analysis.warnings.push('多个插件检测到不同的项目类型，可能存在歧义');
        analysis.conflictingTypes = Array.from(uniqueTypes);
      }
    }
    
    return analysis;
  }

  /**
   * 提取文件内容预览
   * @param {string} content - 文件内容
   * @param {number} maxLength - 最大长度
   * @returns {string} 内容预览
   */
  extractFileContentPreview(content, maxLength = 1000) {
    if (typeof content !== 'string') {
      return '';
    }
    
    if (content.length <= maxLength) {
      return content;
    }
    
    // 提取前maxLength个字符，确保在完整行结束
    const preview = content.substring(0, maxLength);
    const lastNewline = preview.lastIndexOf('\n');
    
    if (lastNewline > 0) {
      return preview.substring(0, lastNewline) + '\n...';
    }
    
    return preview + '...';
  }

  /**
   * 获取插件系统状态
   * @returns {Object} 系统状态
   */
  getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }
    
    const loaderStatus = this.loader ? this.loader.getStatus() : null;
    const builtinDetectors = getAllDetectorInfo();
    
    return {
      initialized: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      loader: loaderStatus,
      builtinDetectors,
      metrics: this.services.metricsService.getMetrics(),
      performance: this.config.performance
    };
  }

  /**
   * 获取内置检测器信息
   * @returns {Array} 检测器信息列表
   */
  getBuiltinDetectors() {
    return getAllDetectorInfo();
  }

  /**
   * 获取已加载的插件
   * @returns {Array} 插件列表
   */
  getLoadedPlugins() {
    this.ensureInitialized();
    return this.loader.getAllPluginInfo();
  }

  /**
   * 重新加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>} 重新加载结果
   */
  async reloadPlugin(pluginId) {
    this.ensureInitialized();
    
    try {
      const plugin = await this.loader.reloadPlugin(pluginId);
      
      this.log('info', '插件重新加载成功', {
        pluginId,
        plugin: plugin.getMetadata()
      });
      
      return {
        success: true,
        plugin: plugin.getMetadata()
      };
    } catch (error) {
      this.log('error', '插件重新加载失败', {
        pluginId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 扫描并重新加载所有插件
   * @returns {Promise<Object>} 重新加载结果
   */
  async rescanPlugins() {
    this.ensureInitialized();
    
    try {
      const reloadedCount = await this.loader.rescanPlugins();
      
      this.log('info', '插件重新扫描完成', {
        reloadedCount
      });
      
      return {
        success: true,
        reloadedCount,
        totalPlugins: this.getLoadedPlugins().length
      };
    } catch (error) {
      this.log('error', '插件重新扫描失败', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   * @returns {Promise<Object>} 更新结果
   */
  async updateConfig(newConfig) {
    this.ensureInitialized();
    
    try {
      // 更新加载器配置
      await this.loader.updateConfig(newConfig.loader || {});
      
      // 更新本地配置
      this.config = {
        ...this.config,
        ...newConfig,
        services: { ...this.config.services, ...newConfig.services },
        loader: { ...this.config.loader, ...newConfig.loader },
        performance: { ...this.config.performance, ...newConfig.performance }
      };
      
      this.log('info', '配置更新成功', {
        updatedSections: Object.keys(newConfig)
      });
      
      return {
        success: true,
        config: this.getConfig()
      };
    } catch (error) {
      this.log('error', '配置更新失败', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 销毁插件管理器
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this.initialized) {
      return;
    }
    
    this.log('info', '开始销毁插件管理器');
    
    // 销毁插件加载器
    if (this.loader) {
      await this.loader.destroy();
      this.loader = null;
    }
    
    // 销毁核心服务
    if (this.services) {
      await this.services.destroy();
      this.services = null;
    }
    
    this.initialized = false;
    
    this.log('info', '插件管理器已销毁');
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  log(level, message, meta = {}) {
    if (this.services && this.services.logger) {
      this.services.logger[level](message, meta);
    } else {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
    }
  }

  /**
   * 确保插件管理器已初始化
   * @throws {Error} 如果未初始化
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('插件管理器未初始化，请先调用init()方法');
    }
  }

  /**
   * 获取核心服务实例
   * @returns {CoreServices|null} 核心服务实例
   */
  getServices() {
    return this.services;
  }

  /**
   * 获取插件加载器实例
   * @returns {PluginLoader|null} 插件加载器实例
   */
  getLoader() {
    return this.loader;
  }
}

// 创建全局插件管理器实例
let globalPluginManager = null;

/**
 * 获取全局插件管理器实例
 * @param {Object} config - 配置选项
 * @returns {PluginManager} 插件管理器实例
 */
function getPluginManager(config = {}) {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager(config);
  }
  return globalPluginManager;
}

/**
 * 初始化全局插件管理器
 * @param {Object} config - 配置选项
 * @returns {Promise<PluginManager>} 初始化后的插件管理器
 */
async function initPluginManager(config = {}) {
  const manager = getPluginManager(config);
  await manager.init();
  return manager;
}

/**
 * 销毁全局插件管理器
 * @returns {Promise<void>}
 */
async function destroyPluginManager() {
  if (globalPluginManager) {
    await globalPluginManager.destroy();
    globalPluginManager = null;
  }
}

module.exports = {
  // 主类
  PluginManager,
  
  // 全局单例管理
  getPluginManager,
  initPluginManager,
  destroyPluginManager,
  
  // 工具函数
  getAllDetectorInfo
};
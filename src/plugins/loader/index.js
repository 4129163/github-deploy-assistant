/**
 * 插件加载器主模块
 * 统一管理内置和外部插件加载器
 */

const BuiltinLoader = require('./BuiltinLoader');
const ExternalLoader = require('./ExternalLoader');

class PluginLoader {
  constructor(config = {}) {
    this.config = {
      // 内置插件配置
      builtin: {
        enabled: true,
        autoLoad: true,
        ...config.builtin
      },
      
      // 外部插件配置
      external: {
        enabled: true,
        directories: ['./plugins', '~/.github-deploy-assistant/plugins'],
        scanInterval: 30000,
        autoReload: false,
        requireSignature: false,
        sandboxMode: true,
        maxPlugins: 50,
        ...config.external
      },
      
      // 通用配置
      performance: {
        timeout: 30000,
        maxMemory: 256,
        concurrentLimit: 5,
        ...config.performance
      },
      
      // 日志配置
      logging: {
        level: 'info',
        enableFileLogging: false,
        logFile: './logs/plugin-system.log',
        ...config.logging
      }
    };
    
    this.builtinLoader = null;
    this.externalLoader = null;
    this.context = null;
    this.initialized = false;
  }

  /**
   * 初始化插件加载器
   * @param {Object} context - 插件上下文
   * @returns {Promise<void>}
   */
  async init(context) {
    if (this.initialized) {
      throw new Error('插件加载器已经初始化');
    }
    
    this.context = context;
    
    // 初始化内置插件加载器
    if (this.config.builtin.enabled) {
      this.builtinLoader = new BuiltinLoader(this.config.builtin);
      await this.builtinLoader.init(context);
    }
    
    // 初始化外部插件加载器
    if (this.config.external.enabled) {
      this.externalLoader = new ExternalLoader(this.config.external);
      await this.externalLoader.init(context);
    }
    
    this.initialized = true;
    
    if (this.context && this.context.logger) {
      this.context.logger.info('插件加载器初始化完成', this.getStatus());
    }
  }

  /**
   * 加载单个插件
   * @param {string} type - 插件类型（内置）或路径（外部）
   * @param {Object} options - 插件选项
   * @returns {Promise<Object>} 加载的插件实例
   */
  async loadPlugin(type, options = {}) {
    this.ensureInitialized();
    
    // 检查是否是内置插件类型
    if (this.builtinLoader && this.isBuiltinPluginType(type)) {
      return await this.builtinLoader.loadBuiltinPlugin(type, options);
    }
    
    // 检查是否是外部插件路径
    if (this.externalLoader) {
      // 这里可以添加从路径加载外部插件的逻辑
      throw new Error('从路径加载外部插件功能尚未实现');
    }
    
    throw new Error(`未知的插件类型或路径: ${type}`);
  }

  /**
   * 检查是否是内置插件类型
   * @param {string} type - 插件类型
   * @returns {boolean} 是否是内置插件类型
   */
  isBuiltinPluginType(type) {
    // 内置插件类型列表
    const builtinTypes = ['nodejs', 'python', 'rust', 'java', 'go', 'docker'];
    return builtinTypes.includes(type);
  }

  /**
   * 卸载插件
   * @param {string} identifier - 插件标识符（类型或ID）
   * @returns {Promise<boolean>} 是否成功卸载
   */
  async unloadPlugin(identifier) {
    this.ensureInitialized();
    
    // 尝试从内置插件卸载
    if (this.builtinLoader && this.isBuiltinPluginType(identifier)) {
      return await this.builtinLoader.unloadPlugin(identifier);
    }
    
    // 尝试从外部插件卸载
    if (this.externalLoader && this.externalLoader.isPluginLoaded(identifier)) {
      return await this.externalLoader.unloadPlugin(identifier);
    }
    
    return false;
  }

  /**
   * 获取插件实例
   * @param {string} identifier - 插件标识符
   * @returns {Object|null} 插件实例
   */
  getPlugin(identifier) {
    this.ensureInitialized();
    
    // 尝试从内置插件获取
    if (this.builtinLoader) {
      const builtinPlugin = this.builtinLoader.getPlugin(identifier);
      if (builtinPlugin) {
        return builtinPlugin;
      }
    }
    
    // 尝试从外部插件获取
    if (this.externalLoader) {
      return this.externalLoader.getPlugin(identifier);
    }
    
    return null;
  }

  /**
   * 获取所有已加载的插件
   * @returns {Array} 插件实例列表
   */
  getAllPlugins() {
    this.ensureInitialized();
    
    const plugins = [];
    
    if (this.builtinLoader) {
      plugins.push(...this.builtinLoader.getAllPlugins());
    }
    
    if (this.externalLoader) {
      plugins.push(...this.externalLoader.getAllPlugins());
    }
    
    return plugins;
  }

  /**
   * 获取所有插件信息
   * @returns {Array} 插件信息列表
   */
  getAllPluginInfo() {
    this.ensureInitialized();
    
    const infos = [];
    
    if (this.builtinLoader) {
      infos.push(...this.builtinLoader.getAllPluginInfo());
    }
    
    if (this.externalLoader) {
      infos.push(...this.externalLoader.getAllPluginInfo());
    }
    
    return infos;
  }

  /**
   * 根据项目特征推荐插件
   * @param {Object} projectInfo - 项目信息
   * @returns {Array} 推荐的插件列表
   */
  recommendPlugins(projectInfo) {
    this.ensureInitialized();
    
    const recommendations = [];
    
    // 获取内置插件推荐
    if (this.builtinLoader) {
      const builtinRecs = this.builtinLoader.recommendPlugins(projectInfo);
      recommendations.push(...builtinRecs.map(rec => ({
        ...rec,
        source: 'builtin',
        loader: 'builtin'
      })));
    }
    
    // 获取外部插件推荐（这里可以添加外部插件推荐逻辑）
    
    // 按分数排序
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * 执行项目检测
   * @param {Object} projectInfo - 项目信息
   * @param {Array} pluginIdentifiers - 指定要使用的插件标识符（可选）
   * @returns {Promise<Array>} 所有插件的检测结果
   */
  async detectProject(projectInfo, pluginIdentifiers = null) {
    this.ensureInitialized();
    
    const results = [];
    
    // 确定要使用的插件
    let pluginsToUse = [];
    if (pluginIdentifiers && Array.isArray(pluginIdentifiers)) {
      // 使用指定的插件
      for (const identifier of pluginIdentifiers) {
        const plugin = this.getPlugin(identifier);
        if (plugin && plugin.isAvailable()) {
          pluginsToUse.push(plugin);
        }
      }
    } else {
      // 使用所有已加载且可用的插件
      pluginsToUse = this.getAllPlugins().filter(plugin => plugin.isAvailable());
    }
    
    // 按优先级排序
    pluginsToUse.sort((a, b) => b.getPriority() - a.getPriority());
    
    // 执行检测（支持并发限制）
    const concurrentLimit = this.config.performance.concurrentLimit;
    const chunks = [];
    
    for (let i = 0; i < pluginsToUse.length; i += concurrentLimit) {
      chunks.push(pluginsToUse.slice(i, i + concurrentLimit));
    }
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (plugin) => {
        try {
          const result = await this.executeWithTimeout(
            () => plugin.detect(projectInfo),
            this.config.performance.timeout
          );
          
          return {
            plugin: plugin.getMetadata(),
            result,
            timestamp: new Date().toISOString(),
            success: true
          };
        } catch (error) {
          return {
            plugin: plugin.getMetadata(),
            error: error.message,
            timestamp: new Date().toISOString(),
            success: false
          };
        }
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            error: result.reason.message,
            timestamp: new Date().toISOString(),
            success: false
          });
        }
      }
    }
    
    return results;
  }

  /**
   * 带超时执行函数
   * @param {Function} fn - 要执行的函数
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<any>} 执行结果
   */
  async executeWithTimeout(fn, timeout) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`执行超时 (${timeout}ms)`));
      }, timeout);
      
      try {
        const result = await fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 获取适合项目的最佳检测结果
   * @param {Object} projectInfo - 项目信息
   * @returns {Promise<Object|null>} 最佳检测结果
   */
  async getBestDetectionResult(projectInfo) {
    const results = await this.detectProject(projectInfo);
    
    if (results.length === 0) {
      return null;
    }
    
    // 过滤成功的检测结果
    const successfulResults = results.filter(r => r.success && r.result && r.result.success);
    
    if (successfulResults.length === 0) {
      return null;
    }
    
    // 按置信度排序
    successfulResults.sort((a, b) => {
      const confidenceA = a.result.confidence || 0;
      const confidenceB = b.result.confidence || 0;
      return confidenceB - confidenceA;
    });
    
    // 返回置信度最高的结果
    return successfulResults[0].result;
  }

  /**
   * 启用插件
   * @param {string} identifier - 插件标识符
   * @returns {boolean} 是否成功启用
   */
  enablePlugin(identifier) {
    this.ensureInitialized();
    
    const plugin = this.getPlugin(identifier);
    if (!plugin) {
      return false;
    }
    
    plugin.enable();
    return true;
  }

  /**
   * 禁用插件
   * @param {string} identifier - 插件标识符
   * @returns {boolean} 是否成功禁用
   */
  disablePlugin(identifier) {
    this.ensureInitialized();
    
    const plugin = this.getPlugin(identifier);
    if (!plugin) {
      return false;
    }
    
    plugin.disable();
    return true;
  }

  /**
   * 重新加载插件
   * @param {string} identifier - 插件标识符
   * @param {Object} options - 新的插件选项
   * @returns {Promise<Object>} 重新加载后的插件实例
   */
  async reloadPlugin(identifier, options = {}) {
    this.ensureInitialized();
    
    // 先卸载
    await this.unloadPlugin(identifier);
    
    // 重新加载
    return await this.loadPlugin(identifier, options);
  }

  /**
   * 扫描并重新加载所有插件
   * @returns {Promise<number>} 重新加载的插件数量
   */
  async rescanPlugins() {
    this.ensureInitialized();
    
    let reloadedCount = 0;
    
    // 重新扫描外部插件
    if (this.externalLoader) {
      reloadedCount += await this.externalLoader.scanAndLoadPlugins();
    }
    
    return reloadedCount;
  }

  /**
   * 销毁插件加载器，释放所有资源
   * @returns {Promise<void>}
   */
  async destroy() {
    if (!this.initialized) {
      return;
    }
    
    // 销毁内置插件加载器
    if (this.builtinLoader) {
      await this.builtinLoader.destroy();
      this.builtinLoader = null;
    }
    
    // 销毁外部插件加载器
    if (this.externalLoader) {
      await this.externalLoader.destroy();
      this.externalLoader = null;
    }
    
    this.context = null;
    this.initialized = false;
    
    if (this.context && this.context.logger) {
      this.context.logger.info('插件加载器已销毁');
    }
  }

  /**
   * 获取加载器状态
   * @returns {Object} 加载器状态信息
   */
  getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }
    
    const status = {
      initialized: true,
      builtin: {
        enabled: this.config.builtin.enabled,
        loaded: this.builtinLoader ? this.builtinLoader.getStatus() : null
      },
      external: {
        enabled: this.config.external.enabled,
        loaded: this.externalLoader ? this.externalLoader.getStatus() : null
      },
      totalPlugins: this.getAllPlugins().length,
      totalPluginInfo: this.getAllPluginInfo().length,
      performance: this.config.performance,
      lastUpdated: new Date().toISOString()
    };
    
    return status;
  }

  /**
   * 确保加载器已初始化
   * @throws {Error} 如果加载器未初始化
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('插件加载器未初始化，请先调用init()方法');
    }
  }

  /**
   * 获取内置插件加载器
   * @returns {BuiltinLoader|null} 内置插件加载器
   */
  getBuiltinLoader() {
    return this.builtinLoader;
  }

  /**
   * 获取外部插件加载器
   * @returns {ExternalLoader|null} 外部插件加载器
   */
  getExternalLoader() {
    return this.externalLoader;
  }

  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新的配置
   * @returns {Promise<void>}
   */
  async updateConfig(newConfig) {
    // 这里可以添加配置更新逻辑
    // 目前只更新内存中的配置
    this.config = {
      ...this.config,
      ...newConfig,
      builtin: { ...this.config.builtin, ...newConfig.builtin },
      external: { ...this.config.external, ...newConfig.external },
      performance: { ...this.config.performance, ...newConfig.performance },
      logging: { ...this.config.logging, ...newConfig.logging }
    };
    
    if (this.context && this.context.logger) {
      this.context.logger.info('插件加载器配置已更新');
    }
  }
}

module.exports = PluginLoader;
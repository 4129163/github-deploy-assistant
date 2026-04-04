/**
 * 内置插件加载器
 * 负责加载和管理内置插件
 */

const path = require('path');
const { builtinDetectors } = require('../detectors');

class BuiltinLoader {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      autoLoad: true,
      ...config
    };
    
    this.plugins = new Map(); // type -> plugin instance
    this.pluginInfo = new Map(); // type -> plugin metadata
    this.context = null;
  }

  /**
   * 初始化加载器
   * @param {Object} context - 插件上下文
   * @returns {Promise<void>}
   */
  async init(context) {
    this.context = context;
    
    if (this.config.enabled && this.config.autoLoad) {
      await this.loadAllBuiltinPlugins();
    }
    
    if (this.context && this.context.logger) {
      this.context.logger.info(`内置插件加载器初始化完成，已加载 ${this.plugins.size} 个插件`);
    }
  }

  /**
   * 加载所有内置插件
   * @returns {Promise<void>}
   */
  async loadAllBuiltinPlugins() {
    const pluginTypes = Object.keys(builtinDetectors);
    
    for (const type of pluginTypes) {
      try {
        await this.loadBuiltinPlugin(type);
      } catch (error) {
        if (this.context && this.context.logger) {
          this.context.logger.error(`加载内置插件 ${type} 失败:`, error.message);
        }
      }
    }
  }

  /**
   * 加载单个内置插件
   * @param {string} type - 插件类型
   * @param {Object} options - 插件选项
   * @returns {Promise<Object>} 加载的插件实例
   */
  async loadBuiltinPlugin(type, options = {}) {
    if (!builtinDetectors[type]) {
      throw new Error(`未知的内置插件类型: ${type}`);
    }

    // 检查是否已加载
    if (this.plugins.has(type)) {
      if (this.context && this.context.logger) {
        this.context.logger.warn(`插件 ${type} 已加载，跳过重复加载`);
      }
      return this.plugins.get(type);
    }

    // 创建插件实例
    const PluginClass = builtinDetectors[type];
    const plugin = new PluginClass();
    
    // 应用选项
    if (options.priority !== undefined) {
      plugin.setPriority(options.priority);
    }
    
    // 初始化插件
    if (this.context) {
      await plugin.init(this.context);
    }
    
    // 存储插件
    this.plugins.set(type, plugin);
    this.pluginInfo.set(type, plugin.getMetadata());
    
    if (this.context && this.context.logger) {
      this.context.logger.info(`已加载内置插件: ${plugin.name} v${plugin.version}`);
    }
    
    return plugin;
  }

  /**
   * 卸载插件
   * @param {string} type - 插件类型
   * @returns {Promise<boolean>} 是否成功卸载
   */
  async unloadPlugin(type) {
    if (!this.plugins.has(type)) {
      return false;
    }
    
    const plugin = this.plugins.get(type);
    
    try {
      // 销毁插件
      await plugin.destroy();
      
      // 从存储中移除
      this.plugins.delete(type);
      this.pluginInfo.delete(type);
      
      if (this.context && this.context.logger) {
        this.context.logger.info(`已卸载插件: ${plugin.name}`);
      }
      
      return true;
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`卸载插件 ${type} 失败:`, error.message);
      }
      return false;
    }
  }

  /**
   * 获取插件实例
   * @param {string} type - 插件类型
   * @returns {Object|null} 插件实例
   */
  getPlugin(type) {
    return this.plugins.get(type) || null;
  }

  /**
   * 获取所有已加载的插件
   * @returns {Array} 插件实例列表
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取插件信息
   * @param {string} type - 插件类型
   * @returns {Object|null} 插件信息
   */
  getPluginInfo(type) {
    return this.pluginInfo.get(type) || null;
  }

  /**
   * 获取所有插件信息
   * @returns {Array} 插件信息列表
   */
  getAllPluginInfo() {
    return Array.from(this.pluginInfo.values());
  }

  /**
   * 检查插件是否已加载
   * @param {string} type - 插件类型
   * @returns {boolean} 是否已加载
   */
  isPluginLoaded(type) {
    return this.plugins.has(type);
  }

  /**
   * 检查插件是否可用
   * @param {string} type - 插件类型
   * @returns {boolean} 是否可用
   */
  isPluginAvailable(type) {
    const plugin = this.plugins.get(type);
    return plugin ? plugin.isAvailable() : false;
  }

  /**
   * 启用插件
   * @param {string} type - 插件类型
   * @returns {boolean} 是否成功启用
   */
  enablePlugin(type) {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      return false;
    }
    
    plugin.enable();
    return true;
  }

  /**
   * 禁用插件
   * @param {string} type - 插件类型
   * @returns {boolean} 是否成功禁用
   */
  disablePlugin(type) {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      return false;
    }
    
    plugin.disable();
    return true;
  }

  /**
   * 重新加载插件
   * @param {string} type - 插件类型
   * @param {Object} options - 新的插件选项
   * @returns {Promise<Object>} 重新加载后的插件实例
   */
  async reloadPlugin(type, options = {}) {
    // 先卸载
    await this.unloadPlugin(type);
    
    // 重新加载
    return await this.loadBuiltinPlugin(type, options);
  }

  /**
   * 根据项目特征推荐插件
   * @param {Object} projectInfo - 项目信息
   * @returns {Array} 推荐的插件列表（按优先级排序）
   */
  recommendPlugins(projectInfo) {
    const { files } = projectInfo;
    const recommendations = [];
    
    // 检查文件特征
    const fileNames = files.map(f => f.name || f.path.split('/').pop());
    
    // 为每个内置插件计算推荐分数
    for (const [type, PluginClass] of Object.entries(builtinDetectors)) {
      const plugin = new PluginClass();
      const score = this.calculateRecommendationScore(plugin, fileNames, files);
      
      if (score > 0) {
        recommendations.push({
          type,
          name: plugin.name,
          score,
          priority: plugin.getPriority(),
          supportedTypes: plugin.getSupportedTypes()
        });
      }
    }
    
    // 按分数和优先级排序
    return recommendations.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.priority - a.priority;
    });
  }

  /**
   * 计算推荐分数
   * @param {Object} plugin - 插件实例
   * @param {Array} fileNames - 文件名列表
   * @param {Array} files - 文件列表
   * @returns {number} 推荐分数（0-1）
   */
  calculateRecommendationScore(plugin, fileNames, files) {
    let score = 0;
    const maxScore = 10;
    
    // 根据不同插件类型使用不同的检测逻辑
    switch (plugin.constructor.name) {
      case 'NodejsDetector':
        if (fileNames.includes('package.json')) score += 3;
        if (fileNames.includes('package-lock.json')) score += 1;
        if (fileNames.includes('node_modules')) score += 1;
        if (fileNames.some(name => name.endsWith('.js'))) score += 2;
        if (fileNames.some(name => name.endsWith('.ts'))) score += 1;
        break;
        
      case 'PythonDetector':
        if (fileNames.includes('requirements.txt')) score += 3;
        if (fileNames.includes('pyproject.toml')) score += 2;
        if (fileNames.includes('setup.py')) score += 1;
        if (fileNames.some(name => name.endsWith('.py'))) score += 2;
        break;
        
      case 'RustDetector':
        if (fileNames.includes('Cargo.toml')) score += 3;
        if (fileNames.includes('Cargo.lock')) score += 1;
        if (fileNames.some(name => name.endsWith('.rs'))) score += 2;
        break;
        
      case 'JavaDetector':
        if (fileNames.includes('pom.xml')) score += 3;
        if (fileNames.includes('build.gradle')) score += 2;
        if (fileNames.some(name => name.endsWith('.java'))) score += 2;
        break;
        
      case 'GoDetector':
        if (fileNames.includes('go.mod')) score += 3;
        if (fileNames.includes('go.sum')) score += 1;
        if (fileNames.some(name => name.endsWith('.go'))) score += 2;
        break;
        
      case 'DockerDetector':
        if (fileNames.some(name => name.toLowerCase() === 'dockerfile')) score += 3;
        if (fileNames.some(name => name.toLowerCase().includes('docker-compose'))) score += 2;
        if (fileNames.includes('.dockerignore')) score += 1;
        break;
    }
    
    return Math.min(score / maxScore, 1);
  }

  /**
   * 获取适合项目的最佳插件
   * @param {Object} projectInfo - 项目信息
   * @returns {Object|null} 最佳插件实例
   */
  async getBestPluginForProject(projectInfo) {
    const recommendations = this.recommendPlugins(projectInfo);
    
    if (recommendations.length === 0) {
      return null;
    }
    
    // 获取评分最高的插件
    const bestRecommendation = recommendations[0];
    
    // 确保插件已加载
    if (!this.isPluginLoaded(bestRecommendation.type)) {
      await this.loadBuiltinPlugin(bestRecommendation.type);
    }
    
    return this.getPlugin(bestRecommendation.type);
  }

  /**
   * 执行项目检测
   * @param {Object} projectInfo - 项目信息
   * @param {Array} pluginTypes - 指定要使用的插件类型（可选）
   * @returns {Promise<Array>} 所有插件的检测结果
   */
  async detectProject(projectInfo, pluginTypes = null) {
    const results = [];
    
    // 确定要使用的插件
    let pluginsToUse = [];
    if (pluginTypes && Array.isArray(pluginTypes)) {
      // 使用指定的插件
      for (const type of pluginTypes) {
        if (this.isPluginLoaded(type) && this.isPluginAvailable(type)) {
          pluginsToUse.push(this.getPlugin(type));
        }
      }
    } else {
      // 使用所有已加载且可用的插件
      pluginsToUse = this.getAllPlugins().filter(plugin => plugin.isAvailable());
    }
    
    // 按优先级排序
    pluginsToUse.sort((a, b) => b.getPriority() - a.getPriority());
    
    // 执行检测
    for (const plugin of pluginsToUse) {
      try {
        const result = await plugin.detect(projectInfo);
        results.push({
          plugin: plugin.getMetadata(),
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.push({
          plugin: plugin.getMetadata(),
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * 销毁加载器，释放所有资源
   * @returns {Promise<void>}
   */
  async destroy() {
    // 卸载所有插件
    const unloadPromises = [];
    for (const type of this.plugins.keys()) {
      unloadPromises.push(this.unloadPlugin(type));
    }
    
    await Promise.allSettled(unloadPromises);
    
    // 清理资源
    this.plugins.clear();
    this.pluginInfo.clear();
    this.context = null;
    
    if (this.context && this.context.logger) {
      this.context.logger.info('内置插件加载器已销毁');
    }
  }

  /**
   * 获取加载器状态
   * @returns {Object} 加载器状态信息
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      autoLoad: this.config.autoLoad,
      totalPlugins: this.plugins.size,
      availablePlugins: this.getAllPlugins().filter(p => p.isAvailable()).length,
      pluginTypes: Array.from(this.plugins.keys()),
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = BuiltinLoader;
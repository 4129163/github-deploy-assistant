/**
 * 外部插件加载器
 * 负责从外部目录动态加载和管理插件
 */

const fs = require('fs').promises;
const path = require('path');
const { BasePlugin, ProjectTypeDetector } = require('../interfaces');

class ExternalLoader {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      directories: ['./plugins', '~/.github-deploy-assistant/plugins'],
      scanInterval: 30000, // 30秒
      autoReload: false,
      requireSignature: false,
      sandboxMode: true,
      maxPlugins: 50,
      ...config
    };
    
    this.plugins = new Map(); // pluginId -> plugin instance
    this.pluginInfo = new Map(); // pluginId -> plugin metadata
    this.pluginFiles = new Map(); // pluginId -> file path
    this.context = null;
    this.scanIntervalId = null;
    this.watchers = new Map();
  }

  /**
   * 初始化加载器
   * @param {Object} context - 插件上下文
   * @returns {Promise<void>}
   */
  async init(context) {
    this.context = context;
    
    if (this.config.enabled) {
      // 创建插件目录（如果不存在）
      await this.createPluginDirectories();
      
      // 扫描并加载插件
      await this.scanAndLoadPlugins();
      
      // 启动定时扫描
      if (this.config.scanInterval > 0) {
        this.startAutoScan();
      }
    }
    
    if (this.context && this.context.logger) {
      this.context.logger.info(`外部插件加载器初始化完成，已加载 ${this.plugins.size} 个插件`);
    }
  }

  /**
   * 创建插件目录
   * @returns {Promise<void>}
   */
  async createPluginDirectories() {
    const directories = Array.isArray(this.config.directories) 
      ? this.config.directories 
      : [this.config.directories];
    
    for (const dir of directories) {
      try {
        // 展开用户主目录路径
        const expandedDir = dir.replace('~', process.env.HOME || process.env.USERPROFILE);
        const absoluteDir = path.resolve(expandedDir);
        
        await fs.mkdir(absoluteDir, { recursive: true });
        
        if (this.context && this.context.logger) {
          this.context.logger.debug(`已创建插件目录: ${absoluteDir}`);
        }
      } catch (error) {
        if (this.context && this.context.logger) {
          this.context.logger.warn(`创建插件目录失败 ${dir}:`, error.message);
        }
      }
    }
  }

  /**
   * 扫描并加载插件
   * @returns {Promise<number>} 加载的插件数量
   */
  async scanAndLoadPlugins() {
    const directories = Array.isArray(this.config.directories) 
      ? this.config.directories 
      : [this.config.directories];
    
    let totalLoaded = 0;
    
    for (const dir of directories) {
      try {
        const loadedCount = await this.scanDirectory(dir);
        totalLoaded += loadedCount;
      } catch (error) {
        if (this.context && this.context.logger) {
          this.context.logger.error(`扫描目录 ${dir} 失败:`, error.message);
        }
      }
    }
    
    return totalLoaded;
  }

  /**
   * 扫描单个目录
   * @param {string} directory - 目录路径
   * @returns {Promise<number>} 加载的插件数量
   */
  async scanDirectory(directory) {
    const expandedDir = directory.replace('~', process.env.HOME || process.env.USERPROFILE);
    const absoluteDir = path.resolve(expandedDir);
    
    try {
      // 检查目录是否存在
      await fs.access(absoluteDir);
    } catch (error) {
      // 目录不存在，跳过
      return 0;
    }
    
    let files;
    try {
      files = await fs.readdir(absoluteDir);
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`读取目录 ${absoluteDir} 失败:`, error.message);
      }
      return 0;
    }
    
    let loadedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(absoluteDir, file);
      
      try {
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          // 检查目录中是否有package.json或index.js
          const hasPackageJson = await this.checkFileExists(path.join(filePath, 'package.json'));
          const hasIndexJs = await this.checkFileExists(path.join(filePath, 'index.js'));
          
          if (hasPackageJson || hasIndexJs) {
            const loaded = await this.loadPluginFromDirectory(filePath);
            if (loaded) loadedCount++;
          }
        } else if (file.endsWith('.js')) {
          // 直接加载JS文件
          const loaded = await this.loadPluginFromFile(filePath);
          if (loaded) loadedCount++;
        }
      } catch (error) {
        if (this.context && this.context.logger) {
          this.context.logger.error(`处理文件 ${filePath} 失败:`, error.message);
        }
      }
    }
    
    return loadedCount;
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 是否存在
   */
  async checkFileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从目录加载插件
   * @param {string} dirPath - 目录路径
   * @returns {Promise<boolean>} 是否加载成功
   */
  async loadPluginFromDirectory(dirPath) {
    try {
      // 尝试加载index.js
      const indexJsPath = path.join(dirPath, 'index.js');
      if (await this.checkFileExists(indexJsPath)) {
        return await this.loadPluginFromFile(indexJsPath);
      }
      
      // 尝试加载package.json的main文件
      const packageJsonPath = path.join(dirPath, 'package.json');
      if (await this.checkFileExists(packageJsonPath)) {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        
        if (packageJson.main) {
          const mainFilePath = path.join(dirPath, packageJson.main);
          return await this.loadPluginFromFile(mainFilePath);
        }
      }
      
      return false;
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`从目录加载插件失败 ${dirPath}:`, error.message);
      }
      return false;
    }
  }

  /**
   * 从文件加载插件
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 是否加载成功
   */
  async loadPluginFromFile(filePath) {
    try {
      // 检查文件签名（如果启用）
      if (this.config.requireSignature) {
        const valid = await this.verifyPluginSignature(filePath);
        if (!valid) {
          if (this.context && this.context.logger) {
            this.context.logger.warn(`插件签名验证失败: ${filePath}`);
          }
          return false;
        }
      }
      
      // 动态加载模块
      delete require.cache[require.resolve(filePath)];
      const module = require(filePath);
      
      // 查找导出的插件类
      let PluginClass = null;
      
      if (module.default && this.isPluginClass(module.default)) {
        PluginClass = module.default;
      } else if (this.isPluginClass(module)) {
        PluginClass = module;
      } else {
        // 查找导出的类
        for (const key in module) {
          if (this.isPluginClass(module[key])) {
            PluginClass = module[key];
            break;
          }
        }
      }
      
      if (!PluginClass) {
        if (this.context && this.context.logger) {
          this.context.logger.warn(`文件 ${filePath} 不包含有效的插件类`);
        }
        return false;
      }
      
      // 创建插件实例
      const plugin = new PluginClass();
      
      // 验证插件
      const validation = this.validatePlugin(plugin);
      if (!validation.valid) {
        if (this.context && this.context.logger) {
          this.context.logger.warn(`插件验证失败 ${filePath}:`, validation.errors.join(', '));
        }
        return false;
      }
      
      // 生成插件ID
      const pluginId = this.generatePluginId(plugin, filePath);
      
      // 检查是否已加载
      if (this.plugins.has(pluginId)) {
        if (this.config.autoReload) {
          // 重新加载
          await this.unloadPlugin(pluginId);
        } else {
          if (this.context && this.context.logger) {
            this.context.logger.debug(`插件已加载，跳过: ${plugin.name}`);
          }
          return false;
        }
      }
      
      // 检查插件数量限制
      if (this.plugins.size >= this.config.maxPlugins) {
        if (this.context && this.context.logger) {
          this.context.logger.warn(`达到最大插件数量限制: ${this.config.maxPlugins}`);
        }
        return false;
      }
      
      // 初始化插件
      if (this.context) {
        await plugin.init(this.context);
      }
      
      // 存储插件
      this.plugins.set(pluginId, plugin);
      this.pluginInfo.set(pluginId, plugin.getMetadata());
      this.pluginFiles.set(pluginId, filePath);
      
      if (this.context && this.context.logger) {
        this.context.logger.info(`已加载外部插件: ${plugin.name} v${plugin.version} (${filePath})`);
      }
      
      // 设置文件监视（如果启用）
      if (this.config.autoReload) {
        this.setupFileWatcher(filePath, pluginId);
      }
      
      return true;
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`加载插件文件失败 ${filePath}:`, error.message);
      }
      return false;
    }
  }

  /**
   * 检查是否是有效的插件类
   * @param {any} obj - 要检查的对象
   * @returns {boolean} 是否是插件类
   */
  isPluginClass(obj) {
    if (typeof obj !== 'function') {
      return false;
    }
    
    // 检查是否是BasePlugin或ProjectTypeDetector的子类
    try {
      const instance = new obj();
      return instance instanceof BasePlugin || instance instanceof ProjectTypeDetector;
    } catch {
      return false;
    }
  }

  /**
   * 验证插件
   * @param {Object} plugin - 插件实例
   * @returns {Object} 验证结果
   */
  validatePlugin(plugin) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // 检查必需属性
    const requiredProps = ['name', 'version', 'description', 'author'];
    for (const prop of requiredProps) {
      if (!plugin[prop]) {
        result.valid = false;
        result.errors.push(`缺少必需属性: ${prop}`);
      }
    }
    
    // 检查名称格式
    if (plugin.name && (typeof plugin.name !== 'string' || plugin.name.trim() === '')) {
      result.valid = false;
      result.errors.push('插件名称必须是非空字符串');
    }
    
    // 检查版本格式
    if (plugin.version && !/^\d+\.\d+\.\d+$/.test(plugin.version)) {
      result.warnings.push('插件版本格式不符合语义化版本规范');
    }
    
    // 检查依赖
    const dependencies = plugin.getDependencies ? plugin.getDependencies() : [];
    for (const dep of dependencies) {
      if (typeof dep !== 'string') {
        result.warnings.push(`依赖名称格式不正确: ${dep}`);
      }
    }
    
    return result;
  }

  /**
   * 生成插件ID
   * @param {Object} plugin - 插件实例
   * @param {string} filePath - 文件路径
   * @returns {string} 插件ID
   */
  generatePluginId(plugin, filePath) {
    // 使用名称和文件路径生成唯一ID
    const namePart = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const pathPart = path.basename(filePath, '.js').toLowerCase();
    return `${namePart}-${pathPart}`;
  }

  /**
   * 验证插件签名
   * @param {string} filePath - 文件路径
   * @returns {Promise<boolean>} 签名是否有效
   */
  async verifyPluginSignature(filePath) {
    // 这里可以添加实际的签名验证逻辑
    // 目前返回true表示跳过验证
    return true;
  }

  /**
   * 设置文件监视
   * @param {string} filePath - 文件路径
   * @param {string} pluginId - 插件ID
   */
  setupFileWatcher(filePath, pluginId) {
    try {
      // 这里可以添加文件监视逻辑
      // 目前只是一个占位实现
      if (this.context && this.context.logger) {
        this.context.logger.debug(`设置文件监视: ${filePath}`);
      }
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`设置文件监视失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 启动自动扫描
   */
  startAutoScan() {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
    }
    
    this.scanIntervalId = setInterval(async () => {
      try {
        const loadedCount = await this.scanAndLoadPlugins();
        if (loadedCount > 0 && this.context && this.context.logger) {
          this.context.logger.info(`自动扫描加载了 ${loadedCount} 个新插件`);
        }
      } catch (error) {
        if (this.context && this.context.logger) {
          this.context.logger.error('自动扫描失败:', error.message);
        }
      }
    }, this.config.scanInterval);
  }

  /**
   * 停止自动扫描
   */
  stopAutoScan() {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
  }

  /**
   * 卸载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<boolean>} 是否成功卸载
   */
  async unloadPlugin(pluginId) {
    if (!this.plugins.has(pluginId)) {
      return false;
    }
    
    const plugin = this.plugins.get(pluginId);
    const filePath = this.pluginFiles.get(pluginId);
    
    try {
      // 销毁插件
      await plugin.destroy();
      
      // 从存储中移除
      this.plugins.delete(pluginId);
      this.pluginInfo.delete(pluginId);
      this.pluginFiles.delete(pluginId);
      
      // 移除文件监视
      if (filePath && this.watchers.has(filePath)) {
        const watcher = this.watchers.get(filePath);
        watcher.close();
        this.watchers.delete(filePath);
      }
      
      // 清除require缓存
      if (filePath && require.cache[require.resolve(filePath)]) {
        delete require.cache[require.resolve(filePath)];
      }
      
      if (this.context && this.context.logger) {
        this.context.logger.info(`已卸载外部插件: ${plugin.name}`);
      }
      
      return true;
    } catch (error) {
      if (this.context && this.context.logger) {
        this.context.logger.error(`卸载插件 ${pluginId} 失败:`, error.message);
      }
      return false;
    }
  }

  /**
   * 获取插件实例
   * @param {string} pluginId - 插件ID
   * @returns {Object|null} 插件实例
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * 通过名称查找插件
   * @param {string} name - 插件名称
   * @returns {Array} 匹配的插件实例
   */
  findPluginsByName(name) {
    const results = [];
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.name.toLowerCase().includes(name.toLowerCase())) {
        results.push({
          id: pluginId,
          plugin,
          info: this.pluginInfo.get(pluginId)
        });
      }
    }
    return results;
  }

  /**
   * 获取所有已加载的插件
   * @returns {Array} 插件实例列表
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
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
   * @param {string} pluginId - 插件ID
   * @returns {boolean} 是否已加载
   */
  isPluginLoaded(pluginId) {
    return this.plugins.has(pluginId);
  }

  /**
   * 销毁加载器，释放所有资源
   * @returns {Promise<void>}
   */
  async destroy() {
    // 停止自动扫描
    this.stopAutoScan();
    
    // 卸载所有插件
    const unloadPromises = [];
    for (const pluginId of this.plugins.keys()) {
      unloadPromises.push(this.unloadPlugin(pluginId));
    }
    
    await Promise.allSettled(unloadPromises);
    
    // 清理资源
    this.plugins.clear();
    this.pluginInfo.clear();
    this.pluginFiles.clear();
    
    // 关闭所有文件监视
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    this.context = null;
    
    if (this.context && this.context.logger) {
      this.context.logger.info('外部插件加载器已销毁');
    }
  }

  /**
   * 获取加载器状态
   * @returns {Object} 加载器状态信息
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      directories: this.config.directories,
      scanInterval: this.config.scanInterval,
      autoReload: this.config.autoReload,
      totalPlugins: this.plugins.size,
      pluginIds: Array.from(this.plugins.keys()),
      lastScan: new Date().toISOString()
    };
  }
}

module.exports = ExternalLoader;
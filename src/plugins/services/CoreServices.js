/**
 * 核心服务抽象模块
 * 为插件提供统一的公共服务接口
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CoreServices {
  constructor(config = {}) {
    this.config = {
      // 文件系统配置
      filesystem: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedExtensions: ['.js', '.json', '.md', '.txt', '.py', '.java', '.go', '.rs', '.toml', '.yml', '.yaml', '.xml'],
        ...config.filesystem
      },
      
      // 网络配置
      network: {
        timeout: 10000,
        maxRetries: 3,
        userAgent: 'GitHub-Deploy-Assistant/1.0.0',
        ...config.network
      },
      
      // 缓存配置
      cache: {
        enabled: true,
        ttl: 300000, // 5分钟
        maxSize: 100,
        ...config.cache
      },
      
      // 日志配置
      logging: {
        level: 'info',
        format: 'json',
        ...config.logging
      },
      
      // 指标配置
      metrics: {
        enabled: true,
        prefix: 'plugin_',
        ...config.metrics
      }
    };
    
    // 服务实例
    this.logger = null;
    this.cache = new Map();
    this.metrics = new Map();
    this.initialized = false;
  }

  /**
   * 初始化核心服务
   * @param {Object} options - 初始化选项
   * @returns {Promise<void>}
   */
  async init(options = {}) {
    if (this.initialized) {
      return;
    }
    
    // 合并配置
    this.config = {
      ...this.config,
      ...options
    };
    
    // 初始化缓存清理
    if (this.config.cache.enabled) {
      this.startCacheCleanup();
    }
    
    this.initialized = true;
    
    // 记录初始化日志
    this.log('info', '核心服务初始化完成', {
      config: {
        filesystem: this.config.filesystem,
        cache: this.config.cache
      }
    });
  }

  /**
   * 文件系统服务
   */
  filesystem = {
    /**
     * 安全读取文件
     * @param {string} filePath - 文件路径
     * @param {Object} options - 读取选项
     * @returns {Promise<string>} 文件内容
     */
    readFile: async (filePath, options = {}) => {
      const absolutePath = path.resolve(filePath);
      
      // 安全检查
      await this.validateFileAccess(absolutePath, 'read');
      
      // 检查文件大小限制
      const stats = await fs.stat(absolutePath);
      if (stats.size > this.config.filesystem.maxFileSize) {
        throw new Error(`文件大小超过限制: ${stats.size} > ${this.config.filesystem.maxFileSize}`);
      }
      
      // 检查文件扩展名
      const ext = path.extname(absolutePath).toLowerCase();
      if (!this.config.filesystem.allowedExtensions.includes(ext) && 
          !this.config.filesystem.allowedExtensions.includes('.*')) {
        throw new Error(`不允许的文件扩展名: ${ext}`);
      }
      
      return await fs.readFile(absolutePath, { encoding: 'utf8', ...options });
    },

    /**
     * 写入文件
     * @param {string} filePath - 文件路径
     * @param {string} content - 文件内容
     * @param {Object} options - 写入选项
     * @returns {Promise<void>}
     */
    writeFile: async (filePath, content, options = {}) => {
      const absolutePath = path.resolve(filePath);
      
      // 安全检查
      await this.validateFileAccess(absolutePath, 'write');
      
      // 检查内容大小
      if (content.length > this.config.filesystem.maxFileSize) {
        throw new Error(`内容大小超过限制: ${content.length} > ${this.config.filesystem.maxFileSize}`);
      }
      
      await fs.writeFile(absolutePath, content, { encoding: 'utf8', ...options });
    },

    /**
     * 扫描项目目录
     * @param {string} projectPath - 项目路径
     * @param {Object} options - 扫描选项
     * @returns {Promise<Object>} 项目文件信息
     */
    scanProject: async (projectPath, options = {}) => {
      const absolutePath = path.resolve(projectPath);
      
      // 安全检查
      await this.validateFileAccess(absolutePath, 'read');
      
      const result = {
        path: absolutePath,
        files: [],
        stats: {
          fileCount: 0,
          totalSize: 0,
          lastModified: null
        },
        metadata: {}
      };
      
      await this.scanDirectory(absolutePath, absolutePath, result, options);
      
      return result;
    },

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>} 是否存在
     */
    exists: async (filePath) => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * 获取文件信息
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} 文件信息
     */
    stat: async (filePath) => {
      const absolutePath = path.resolve(filePath);
      await this.validateFileAccess(absolutePath, 'read');
      return await fs.stat(absolutePath);
    },

    /**
     * 列出目录内容
     * @param {string} dirPath - 目录路径
     * @returns {Promise<Array>} 目录内容列表
     */
    readdir: async (dirPath) => {
      const absolutePath = path.resolve(dirPath);
      await this.validateFileAccess(absolutePath, 'read');
      return await fs.readdir(absolutePath);
    }
  };

  /**
   * 日志服务
   */
  logger = {
    /**
     * 记录信息日志
     * @param {string} message - 日志消息
     * @param {Object} meta - 元数据
     */
    info: (message, meta = {}) => {
      this.log('info', message, meta);
    },

    /**
     * 记录调试日志
     * @param {string} message - 日志消息
     * @param {Object} meta - 元数据
     */
    debug: (message, meta = {}) => {
      this.log('debug', message, meta);
    },

    /**
     * 记录警告日志
     * @param {string} message - 日志消息
     * @param {Object} meta - 元数据
     */
    warn: (message, meta = {}) => {
      this.log('warn', message, meta);
    },

    /**
     * 记录错误日志
     * @param {string} message - 日志消息
     * @param {Object} meta - 元数据
     */
    error: (message, meta = {}) => {
      this.log('error', message, meta);
    }
  };

  /**
   * HTTP客户端服务
   */
  http = {
    /**
     * 发送GET请求
     * @param {string} url - 请求URL
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    get: async (url, options = {}) => {
      return await this.makeRequest(url, { method: 'GET', ...options });
    },

    /**
     * 发送POST请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    post: async (url, data, options = {}) => {
      return await this.makeRequest(url, { 
        method: 'POST', 
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options 
      });
    },

    /**
     * 下载文件
     * @param {string} url - 文件URL
     * @param {string} destPath - 目标路径
     * @param {Object} options - 下载选项
     * @returns {Promise<string>} 下载的文件路径
     */
    download: async (url, destPath, options = {}) => {
      // 这里可以添加文件下载逻辑
      throw new Error('文件下载功能尚未实现');
    }
  };

  /**
   * 缓存服务
   */
  cacheService = {
    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {any} value - 缓存值
     * @param {number} ttl - 生存时间（毫秒）
     * @returns {Promise<void>}
     */
    set: async (key, value, ttl = this.config.cache.ttl) => {
      if (!this.config.cache.enabled) {
        return;
      }
      
      const cacheKey = this.generateCacheKey(key);
      const expiresAt = Date.now() + ttl;
      
      this.cache.set(cacheKey, {
        value,
        expiresAt,
        createdAt: Date.now()
      });
      
      // 检查缓存大小
      if (this.cache.size > this.config.cache.maxSize) {
        this.cleanupCache();
      }
    },

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {Promise<any>} 缓存值
     */
    get: async (key) => {
      if (!this.config.cache.enabled) {
        return null;
      }
      
      const cacheKey = this.generateCacheKey(key);
      const item = this.cache.get(cacheKey);
      
      if (!item) {
        return null;
      }
      
      // 检查是否过期
      if (Date.now() > item.expiresAt) {
        this.cache.delete(cacheKey);
        return null;
      }
      
      return item.value;
    },

    /**
     * 删除缓存
     * @param {string} key - 缓存键
     * @returns {Promise<boolean>} 是否删除成功
     */
    delete: async (key) => {
      const cacheKey = this.generateCacheKey(key);
      return this.cache.delete(cacheKey);
    },

    /**
     * 清空缓存
     * @returns {Promise<void>}
     */
    clear: async () => {
      this.cache.clear();
    },

    /**
     * 检查缓存是否存在
     * @param {string} key - 缓存键
     * @returns {Promise<boolean>} 是否存在
     */
    has: async (key) => {
      const cacheKey = this.generateCacheKey(key);
      const item = this.cache.get(cacheKey);
      
      if (!item) {
        return false;
      }
      
      // 检查是否过期
      if (Date.now() > item.expiresAt) {
        this.cache.delete(cacheKey);
        return false;
      }
      
      return true;
    }
  };

  /**
   * 指标服务
   */
  metricsService = {
    /**
     * 增加计数器
     * @param {string} name - 指标名称
     * @param {number} value - 增加值
     * @param {Object} labels - 标签
     */
    increment: (name, value = 1, labels = {}) => {
      if (!this.config.metrics.enabled) {
        return;
      }
      
      const metricName = `${this.config.metrics.prefix}${name}`;
      const labelKey = this.generateLabelKey(labels);
      const fullKey = `${metricName}:${labelKey}`;
      
      const current = this.metrics.get(fullKey) || 0;
      this.metrics.set(fullKey, current + value);
    },

    /**
     * 设置测量值
     * @param {string} name - 指标名称
     * @param {number} value - 测量值
     * @param {Object} labels - 标签
     */
    gauge: (name, value, labels = {}) => {
      if (!this.config.metrics.enabled) {
        return;
      }
      
      const metricName = `${this.config.metrics.prefix}${name}`;
      const labelKey = this.generateLabelKey(labels);
      const fullKey = `${metricName}:${labelKey}`;
      
      this.metrics.set(fullKey, value);
    },

    /**
     * 记录直方图
     * @param {string} name - 指标名称
     * @param {number} value - 值
     * @param {Object} labels - 标签
     */
    histogram: (name, value, labels = {}) => {
      if (!this.config.metrics.enabled) {
        return;
      }
      
      const metricName = `${this.config.metrics.prefix}${name}_histogram`;
      const labelKey = this.generateLabelKey(labels);
      const fullKey = `${metricName}:${labelKey}`;
      
      const current = this.metrics.get(fullKey) || [];
      current.push({
        value,
        timestamp: Date.now()
      });
      
      // 只保留最近100个值
      if (current.length > 100) {
        current.shift();
      }
      
      this.metrics.set(fullKey, current);
    },

    /**
     * 获取指标数据
     * @param {string} name - 指标名称（可选）
     * @returns {Object} 指标数据
     */
    getMetrics: (name = null) => {
      const result = {};
      
      for (const [key, value] of this.metrics.entries()) {
        const [metricName, labelKey] = key.split(':');
        
        if (name && !metricName.includes(name)) {
          continue;
        }
        
        if (!result[metricName]) {
          result[metricName] = [];
        }
        
        result[metricName].push({
          labels: this.parseLabelKey(labelKey),
          value
        });
      }
      
      return result;
    },

    /**
     * 重置指标
     */
    reset: () => {
      this.metrics.clear();
    }
  };

  /**
   * 配置服务
   */
  configService = {
    /**
     * 获取配置值
     * @param {string} key - 配置键
     * @param {any} defaultValue - 默认值
     * @returns {any} 配置值
     */
    get: (key, defaultValue = null) => {
      const keys = key.split('.');
      let value = this.config;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return defaultValue;
        }
      }
      
      return value;
    },

    /**
     * 设置配置值
     * @param {string} key - 配置键
     * @param {any} value - 配置值
     */
    set: (key, value) => {
      const keys = key.split('.');
      let current = this.config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in current)) {
          current[k] = {};
        }
        current = current[k];
      }
      
      current[keys[keys.length - 1]] = value;
    },

    /**
     * 获取所有配置
     * @returns {Object} 所有配置
     */
    getAll: () => {
      return JSON.parse(JSON.stringify(this.config));
    }
  };

  /**
   * 工具服务
   */
  utils = {
    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId: () => {
      return crypto.randomBytes(16).toString('hex');
    },

    /**
     * 深度克隆对象
     * @param {any} obj - 要克隆的对象
     * @returns {any} 克隆后的对象
     */
    deepClone: (obj) => {
      return JSON.parse(JSON.stringify(obj));
    },

    /**
     * 延迟执行
     * @param {number} ms - 延迟时间（毫秒）
     * @returns {Promise<void>}
     */
    delay: (ms) => {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 安全执行函数
     * @param {Function} fn - 要执行的函数
     * @param {any} defaultValue - 默认返回值
     * @returns {any} 执行结果或默认值
     */
    safeExecute: (fn, defaultValue = null) => {
      try {
        return fn();
      } catch {
        return defaultValue;
      }
    },

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize: (bytes) => {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  };

  /**
   * 获取插件上下文
   * @param {string} pluginName - 插件名称
   * @returns {Object} 插件上下文
   */
  getPluginContext(pluginName) {
    return {
      config: this.configService,
      logger: {
        ...this.logger,
        // 添加插件名称到日志
        info: (message, meta) => this.log('info', message, { plugin: pluginName, ...meta }),
        debug: (message, meta) => this.log('debug', message, { plugin: pluginName, ...meta }),
        warn: (message, meta) => this.log('warn', message, { plugin: pluginName, ...meta }),
        error: (message, meta) => this.log('error', message, { plugin: pluginName, ...meta })
      },
      fileSystem: this.filesystem,
      httpClient: this.http,
      cache: this.cacheService,
      metrics: this.metricsService,
      utils: this.utils
    };
  }

  /**
   * 销毁核心服务
   */
  async destroy() {
    // 停止缓存清理
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    
    // 清空缓存
    this.cache.clear();
    this.metrics.clear();
    
    this.initialized = false;
    
    this.log('info', '核心服务已销毁');
  }

  // 私有方法

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {Object} meta - 元数据
   */
  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    // 根据配置格式输出日志
    if (this.config.logging.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
    }
  }

  /**
   * 验证文件访问权限
   * @param {string} filePath - 文件路径
   * @param {string} operation - 操作类型（read/write）
   * @throws {Error} 如果访问被拒绝
   */
  async validateFileAccess(filePath, operation) {
    // 这里可以添加更复杂的权限检查逻辑
    // 目前只进行基本的安全检查
    
    // 检查路径是否在允许的目录内
    const allowedPrefixes = [
      process.cwd(),
      path.resolve('./projects'),
      path.resolve('./temp')
    ];
    
    const isAllowed = allowedPrefixes.some(prefix => 
      filePath.startsWith(prefix)
    );
    
    if (!isAllowed) {
      throw new Error(`拒绝访问路径: ${filePath}`);
    }
    
    // 检查路径遍历攻击
    if (filePath.includes('..') || filePath.includes('//')) {
      throw new Error(`检测到路径遍历攻击: ${filePath}`);
    }
  }

  /**
   * 扫描目录
   * @param {string} rootPath - 根路径
   * @param {string} currentPath - 当前路径
   * @param {Object} result - 结果对象
   * @param {Object} options - 扫描选项
   */
  async scanDirectory(rootPath, currentPath, result, options) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, entryPath);
        
        // 跳过隐藏文件和目录
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        // 跳过node_modules等大型目录
        if (entry.isDirectory() && (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'vendor' ||
          entry.name === 'target'
        )) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // 递归扫描子目录
          await this.scanDirectory(rootPath, entryPath, result, options);
        } else if (entry.isFile()) {
          // 处理文件
          const stats = await fs.stat(entryPath);
          
          result.files.push({
            name: entry.name,
            path: relativePath,
            absolutePath: entryPath,
            size: stats.size,
            modified: stats.mtime,
            isDirectory: false
          });
          
          // 更新统计信息
          result.stats.fileCount++;
          result.stats.totalSize += stats.size;
          
          if (!result.stats.lastModified || stats.mtime > result.stats.lastModified) {
            result.stats.lastModified = stats.mtime;
          }
        }
      }
    } catch (error) {
      this.log('warn', `扫描目录失败: ${currentPath}`, { error: error.message });
    }
  }

  /**
   * 启动缓存清理
   */
  startCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    // 如果缓存仍然过大，删除最旧的条目
    if (this.cache.size > this.config.cache.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      const toDelete = entries.slice(0, this.cache.size - this.config.cache.maxSize);
      for (const [key] of toDelete) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      this.log('debug', `清理了 ${deletedCount} 个缓存条目`);
    }
  }

  /**
   * 生成缓存键
   * @param {string} key - 原始键
   * @returns {string} 缓存键
   */
  generateCacheKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * 生成标签键
   * @param {Object} labels - 标签对象
   * @returns {string} 标签键
   */
  generateLabelKey(labels) {
    const sortedKeys = Object.keys(labels).sort();
    return sortedKeys.map(k => `${k}=${labels[k]}`).join(',');
  }

  /**
   * 解析标签键
   * @param {string} labelKey - 标签键
   * @returns {Object} 标签对象
   */
  parseLabelKey(labelKey) {
    const labels = {};
    if (!labelKey) return labels;
    
    const pairs = labelKey.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }
    
    return labels;
  }

  /**
   * 发送HTTP请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async makeRequest(url, options = {}) {
    // 这里可以添加实际的HTTP请求逻辑
    // 目前返回模拟数据
    this.log('debug', `HTTP请求: ${options.method || 'GET'} ${url}`);
    
    return {
      status: 200,
      data: { message: '模拟响应' },
      headers: {},
      url
    };
  }
}

module.exports = CoreServices;
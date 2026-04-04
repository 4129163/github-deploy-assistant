/**
 * 基础插件接口
 * 所有插件必须继承的基础接口，定义插件的基本属性和生命周期方法
 */

class BasePlugin {
  constructor() {
    this.name = 'BasePlugin';
    this.version = '1.0.0';
    this.description = '基础插件接口';
    this.author = 'System';
    this.enabled = true;
    this.context = null;
  }

  /**
   * 初始化插件
   * @param {Object} context - 插件上下文，包含配置、日志等核心服务
   * @returns {Promise<void>}
   */
  async init(context) {
    this.context = context;
    // 默认初始化逻辑，子类可以覆盖
    if (this.context && this.context.logger) {
      this.context.logger.info(`插件 ${this.name} v${this.version} 初始化完成`);
    }
  }

  /**
   * 销毁插件，释放资源
   * @returns {Promise<void>}
   */
  async destroy() {
    // 默认清理逻辑，子类可以覆盖
    if (this.context && this.context.logger) {
      this.context.logger.info(`插件 ${this.name} 正在销毁`);
    }
    this.context = null;
  }

  /**
   * 启用插件
   */
  enable() {
    this.enabled = true;
    if (this.context && this.context.logger) {
      this.context.logger.info(`插件 ${this.name} 已启用`);
    }
  }

  /**
   * 禁用插件
   */
  disable() {
    this.enabled = false;
    if (this.context && this.context.logger) {
      this.context.logger.info(`插件 ${this.name} 已禁用`);
    }
  }

  /**
   * 获取插件元数据
   * @returns {Object} 插件元数据
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      enabled: this.enabled,
      type: this.constructor.name
    };
  }

  /**
   * 检查插件是否可用
   * @returns {boolean} 插件是否可用
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * 验证插件配置
   * @param {Object} config - 插件配置
   * @returns {ValidationResult} 验证结果
   */
  validateConfig(config) {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * 获取插件依赖
   * @returns {Array<string>} 依赖的插件名称列表
   */
  getDependencies() {
    return [];
  }

  /**
   * 获取插件权限要求
   * @returns {Object} 权限要求
   */
  getPermissions() {
    return {
      filesystem: {
        read: [],
        write: [],
        execute: []
      },
      network: {
        http: false,
        https: false
      },
      environment: {
        envVars: [],
        process: false
      }
    };
  }
}

module.exports = BasePlugin;
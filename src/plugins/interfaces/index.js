/**
 * 插件接口模块导出
 */

const BasePlugin = require('./BasePlugin');
const ProjectTypeDetector = require('./ProjectTypeDetector');

// 导出类型定义（用于文档）
const types = {
  /**
   * 检测结果类型定义
   * @typedef {Object} DetectionResult
   * @property {boolean} success - 检测是否成功
   * @property {string} projectType - 检测到的项目类型
   * @property {number} confidence - 检测置信度（0-1）
   * @property {Object} stack - 技术栈详情
   * @property {Array} keyFiles - 关键文件列表
   * @property {Object} deployment - 部署建议
   * @property {Object} plugin - 插件信息
   * @property {string} detectionTime - 检测时间
   * @property {string|null} error - 错误信息
   * @property {Array} warnings - 警告信息
   */

  /**
   * 验证结果类型定义
   * @typedef {Object} ValidationResult
   * @property {boolean} valid - 是否有效
   * @property {number} confidence - 置信度
   * @property {Array} suggestions - 建议列表
   * @property {Array} errors - 错误列表
   * @property {Array} warnings - 警告列表
   */

  /**
   * 项目信息类型定义
   * @typedef {Object} ProjectInfo
   * @property {string} path - 项目路径
   * @property {Array} files - 文件列表
   * @property {Object} stats - 项目统计信息
   * @property {Object} metadata - 项目元数据
   */

  /**
   * 插件上下文类型定义
   * @typedef {Object} PluginContext
   * @property {Object} config - 应用配置
   * @property {Object} logger - 日志服务
   * @property {Object} fileSystem - 文件系统服务
   * @property {Object} httpClient - HTTP客户端
   * @property {Object} cache - 缓存服务
   * @property {Object} metrics - 指标收集
   */
};

module.exports = {
  BasePlugin,
  ProjectTypeDetector,
  types
};
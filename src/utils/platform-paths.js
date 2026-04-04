/**
 * 跨平台路径工具模块
 * 提供统一的路径操作，确保Windows/Linux/macOS兼容性
 */

const path = require('path');
const os = require('os');

/**
 * 获取用户目录下的GADA工作目录
 * @returns {string} 跨平台兼容的工作目录路径
 */
function getWorkspaceDir() {
  return path.join(os.homedir(), 'gada-workspace');
}

/**
 * 获取跨平台兼容的临时目录
 * @returns {string} 临时目录路径
 */
function getTempDir() {
  return path.join(os.tmpdir(), 'gada-temp');
}

/**
 * 确保目录存在（跨平台兼容）
 * @param {string} dirPath - 目录路径
 * @returns {Promise<string>} 创建的目录路径
 */
async function ensureDir(dirPath) {
  const fs = require('fs-extra');
  await fs.ensureDir(dirPath);
  return dirPath;
}

/**
 * 标准化路径（跨平台兼容）
 * @param {string} filePath - 文件路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(filePath) {
  // 将反斜杠统一为正斜杠，然后使用path.normalize
  const normalized = filePath.replace(/\\/g, '/');
  return path.normalize(normalized);
}

/**
 * 连接路径（跨平台兼容的path.join替代）
 * @param {...string} paths - 路径片段
 * @returns {string} 连接后的路径
 */
function joinPath(...paths) {
  return path.join(...paths);
}

/**
 * 获取相对于工作目录的路径
 * @param {...string} paths - 路径片段
 * @returns {string} 相对于工作目录的路径
 */
function fromWorkspace(...paths) {
  const config = require('../config');
  return path.join(config.WORK_DIR, ...paths);
}

/**
 * 检查路径是否在工作目录内（安全验证）
 * @param {string} targetPath - 要检查的路径
 * @returns {boolean} 是否在工作目录内
 */
function isWithinWorkspace(targetPath) {
  const config = require('../config');
  const workspace = path.resolve(config.WORK_DIR);
  const target = path.resolve(targetPath);
  
  // 检查目标路径是否以工作目录开头
  return target.startsWith(workspace + path.sep) || target === workspace;
}

/**
 * 获取平台特定的路径分隔符
 * @returns {string} 路径分隔符
 */
function getPathSeparator() {
  return path.sep;
}

/**
 * 获取平台特定的路径分隔符（用于显示）
 * @returns {string} 路径分隔符
 */
function getDisplaySeparator() {
  return os.platform() === 'win32' ? '\\' : '/';
}

/**
 * 将路径转换为平台特定的格式
 * @param {string} filePath - 文件路径
 * @returns {string} 平台特定的路径
 */
function toPlatformPath(filePath) {
  return filePath.split(/[\\/]/).join(path.sep);
}

/**
 * 获取默认的项目目录
 * @param {string} projectName - 项目名称
 * @returns {string} 项目目录路径
 */
function getProjectDir(projectName) {
  const config = require('../config');
  return path.join(config.WORK_DIR, projectName);
}

/**
 * 获取日志目录
 * @returns {string} 日志目录路径
 */
function getLogsDir() {
  const config = require('../config');
  return config.LOGS_DIR;
}

/**
 * 获取数据库路径
 * @returns {string} 数据库路径
 */
function getDbPath() {
  const config = require('../config');
  return config.DB_PATH;
}

module.exports = {
  getWorkspaceDir,
  getTempDir,
  ensureDir,
  normalizePath,
  joinPath,
  fromWorkspace,
  isWithinWorkspace,
  getPathSeparator,
  getDisplaySeparator,
  toPlatformPath,
  getProjectDir,
  getLogsDir,
  getDbPath
};
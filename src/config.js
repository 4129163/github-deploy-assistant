/**
 * 统一配置模块
 * 所有模块从这里读取配置，避免各处硬编码
 */

const path = require('path');

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3456,
  WORK_DIR: process.env.WORK_DIR || path.join(__dirname, '../workspace'),
  ALLOW_AUTO_EXEC: process.env.ALLOW_AUTO_EXEC !== 'false',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  DEFAULT_AI_PROVIDER: process.env.DEFAULT_AI_PROVIDER || 'openai',
  DB_PATH: path.join(__dirname, '../database/gada.db'),
  LOGS_DIR: path.join(__dirname, '../logs'),
};

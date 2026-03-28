/**
 * 日志工具
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = path.join(__dirname, '../../logs');

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function shouldLog(level) {
  return levels[level] >= levels[LOG_LEVEL];
}

function writeLog(level, message, ...args) {
  if (!shouldLog(level)) return;
  
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  // 控制台输出
  console.log(logMessage, ...args);
  
  // 写入文件
  const date = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `${date}.log`);
  const fullMessage = `${logMessage} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  
  fs.appendFileSync(logFile, fullMessage);
}

const logger = {
  debug: (message, ...args) => writeLog('debug', message, ...args),
  info: (message, ...args) => writeLog('info', message, ...args),
  warn: (message, ...args) => writeLog('warn', message, ...args),
  error: (message, ...args) => writeLog('error', message, ...args),
  
  // 项目相关日志
  project: (projectId, message, ...args) => {
    writeLog('info', `[Project:${projectId}] ${message}`, ...args);
  }
};

module.exports = { logger };

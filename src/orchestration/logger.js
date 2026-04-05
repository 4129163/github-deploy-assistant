/**
 * 简单的日志工具
 * 避免依赖外部logger
 */

class SimpleLogger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.level = process.env.LOG_LEVEL || 'info';
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  error(message) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message));
    }
  }

  warn(message) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message));
    }
  }

  info(message) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message));
    }
  }

  debug(message) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message));
    }
  }
}

// 创建单例
const logger = new SimpleLogger();

module.exports = { logger };
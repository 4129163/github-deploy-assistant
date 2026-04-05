/**
 * 简单的日志记录器（用于测试）
 */

const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose'
};

class LogEntry {
  constructor(level, message, meta = {}) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.message = message;
    this.meta = meta;
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      meta: this.meta
    };
  }

  toString() {
    return `[${this.timestamp}] [${this.level.toUpperCase()}] ${this.message}`;
  }
}

const logger = {
  error: (message, meta) => {
    const entry = new LogEntry(LogLevel.ERROR, message, meta);
    console.error(entry.toString());
    return entry;
  },
  
  warn: (message, meta) => {
    const entry = new LogEntry(LogLevel.WARN, message, meta);
    console.warn(entry.toString());
    return entry;
  },
  
  info: (message, meta) => {
    const entry = new LogEntry(LogLevel.INFO, message, meta);
    console.log(entry.toString());
    return entry;
  },
  
  debug: (message, meta) => {
    const entry = new LogEntry(LogLevel.DEBUG, message, meta);
    console.debug(entry.toString());
    return entry;
  },
  
  verbose: (message, meta) => {
    const entry = new LogEntry(LogLevel.VERBOSE, message, meta);
    console.log(entry.toString());
    return entry;
  }
};

module.exports = { logger, LogEntry, LogLevel };
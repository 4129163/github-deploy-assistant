/**
 * 增强版日志工具
 * - 支持结构化日志
 * - 按日期分文件（YYYY-MM-DD.log）
 * - 自动轮转和清理
 * - 支持多种输出目标（控制台、文件、远程）
 * - 性能监控集成
 */

const fs = require('fs');
const path = require('path');
const { LOG_LEVEL, LOGS_DIR } = require('../config');

// 日志级别定义
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const levelNames = {
  0: 'DEBUG',
  1: 'INFO', 
  2: 'WARN',
  3: 'ERROR',
  4: 'FATAL'
};

// 配置
const LOG_DIR = LOGS_DIR;
const MAX_LOG_SIZE_MB = parseInt(process.env.MAX_LOG_SIZE_MB, 10) || 20;
const MAX_LOG_DAYS = parseInt(process.env.MAX_LOG_DAYS, 10) || 30;
const MAX_TOTAL_LOG_MB = parseInt(process.env.MAX_TOTAL_LOG_MB, 10) || 200;
const ENABLE_JSON_LOG = process.env.ENABLE_JSON_LOG === 'true';
const ENABLE_REMOTE_LOG = process.env.ENABLE_REMOTE_LOG === 'true';
const REMOTE_LOG_URL = process.env.REMOTE_LOG_URL;

// 当前日志级别
const currentLevel = LogLevel[LOG_LEVEL?.toUpperCase()] || LogLevel.INFO;

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 性能监控
const performanceStats = {
  totalLogs: 0,
  byLevel: {},
  errors: 0,
  startTime: Date.now()
};

// 远程日志队列
const remoteLogQueue = [];
let isSendingRemoteLogs = false;

/**
 * 结构化日志条目
 */
class LogEntry {
  constructor(level, message, meta = {}) {
    this.timestamp = new Date().toISOString();
    this.level = levelNames[level];
    this.levelCode = level;
    this.message = message;
    this.meta = meta;
    this.pid = process.pid;
    this.hostname = require('os').hostname();
    this.service = 'github-deploy-assistant';
    
    // 添加调用栈信息（仅限错误级别）
    if (level >= LogLevel.ERROR) {
      const stack = new Error().stack;
      this.stack = stack ? stack.split('\n').slice(3).join('\n') : '';
    }
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      level: this.level,
      message: this.message,
      ...this.meta,
      pid: this.pid,
      hostname: this.hostname,
      service: this.service,
      ...(this.stack && { stack: this.stack })
    };
  }

  toString() {
    const metaStr = Object.keys(this.meta).length > 0 
      ? ` ${JSON.stringify(this.meta)}`
      : '';
    return `[${this.timestamp}] [${this.level}] ${this.message}${metaStr}`;
  }
}

/**
 * 日志轮转和清理（向后兼容）
 */
class LogRotator {
  constructor() {
    this.lastCleanup = Date.now();
  }

  rotateLogs() {
    const now = Date.now();
    if (now - this.lastCleanup < 60 * 60 * 1000) return; // 1小时内不重复清理
    this.lastCleanup = now;

    try {
      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          full: path.join(LOG_DIR, f),
          mtime: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime(),
          size: fs.statSync(path.join(LOG_DIR, f)).size,
        }))
        .sort((a, b) => a.mtime - b.mtime);

      // 删除超过 MAX_LOG_DAYS 天的文件
      const cutoff = now - MAX_LOG_DAYS * 24 * 60 * 60 * 1000;
      files.filter(f => f.mtime < cutoff).forEach(f => {
        try { fs.unlinkSync(f.full); } catch (_) {}
      });

      // 总大小超限时删除最老的
      let totalBytes = files.reduce((s, f) => s + f.size, 0);
      const maxBytes = MAX_TOTAL_LOG_MB * 1024 * 1024;
      for (const f of files) {
        if (totalBytes <= maxBytes) break;
        try { 
          fs.unlinkSync(f.full); 
          totalBytes -= f.size; 
        } catch (_) {}
      }
    } catch (error) {
      // 轮转失败不阻塞主流程
      console.error('Log rotation failed:', error.message);
    }
  }

  truncateIfNeeded(logFile) {
    try {
      if (!fs.existsSync(logFile)) return false;

      const { size } = fs.statSync(logFile);
      if (size <= MAX_LOG_SIZE_MB * 1024 * 1024) return false;

      // 保留文件末尾 10MB
      const content = fs.readFileSync(logFile);
      const keep = content.slice(-10 * 1024 * 1024);
      const truncHeader = `[${new Date().toISOString()}] [INFO] --- log truncated (size limit) ---\n`;
      fs.writeFileSync(logFile, truncHeader + keep);
      return true;
    } catch (error) {
      return false;
    }
  }
}

const rotator = new LogRotator();

// 尝试加载增强版轮转器
let enhancedRotator = null;
try {
  const { createLogRotator } = require('./log-rotator-enhanced');
  createLogRotator().then(rotator => {
    enhancedRotator = rotator;
    logger.info('Enhanced log rotator initialized successfully');
  }).catch(error => {
    logger.warn('Failed to initialize enhanced log rotator, using basic one:', error.message);
  });
} catch (error) {
  // 增强版轮转器不可用，使用基础版
  logger.debug('Enhanced log rotator not available, using basic rotation');
}

/**
 * 远程日志发送
 */
async function sendRemoteLog(entry) {
  if (!ENABLE_REMOTE_LOG || !REMOTE_LOG_URL) return;

  try {
    const axios = require('axios');
    await axios.post(REMOTE_LOG_URL, entry.toJSON(), {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // 远程日志失败不阻塞主流程
    console.error('Remote log failed:', error.message);
  }
}

/**
 * 写入日志
 */
function writeLog(level, message, meta = {}) {
  if (level < currentLevel) return;

  // 更新统计
  performanceStats.totalLogs++;
  performanceStats.byLevel[levelNames[level]] = (performanceStats.byLevel[levelNames[level]] || 0) + 1;
  if (level >= LogLevel.ERROR) performanceStats.errors++;

  const entry = new LogEntry(level, message, meta);

  // 控制台输出
  if (level >= LogLevel.ERROR) {
    process.stderr.write(entry.toString() + '\n');
  } else {
    process.stdout.write(entry.toString() + '\n');
  }

  // 文件输出
  try {
    const date = entry.timestamp.slice(0, 10);
    const logFile = path.join(LOG_DIR, `${date}.log`);

    // 检查是否需要截断
    rotator.truncateIfNeeded(logFile);

    const logLine = ENABLE_JSON_LOG 
      ? JSON.stringify(entry.toJSON()) + '\n'
      : entry.toString() + '\n';

    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('File log failed:', error.message);
  }

  // 远程日志（异步）
  if (ENABLE_REMOTE_LOG) {
    remoteLogQueue.push(entry);
    if (!isSendingRemoteLogs) {
      isSendingRemoteLogs = true;
      setImmediate(async () => {
        while (remoteLogQueue.length > 0) {
          const nextEntry = remoteLogQueue.shift();
          await sendRemoteLog(nextEntry);
        }
        isSendingRemoteLogs = false;
      });
    }
  }

  // 触发轮转检查
  if (enhancedRotator) {
    // 使用增强版轮转器的异步检查
    enhancedRotator.checkAndRotate().catch(() => {
      // 如果增强版失败，回退到基础版
      rotator.rotateLogs();
    });
  } else {
    // 使用基础版轮转
    rotator.rotateLogs();
  }
}

/**
 * 增强版日志记录器
 */
const logger = {
  debug: (message, meta = {}) => writeLog(LogLevel.DEBUG, message, meta),
  info: (message, meta = {}) => writeLog(LogLevel.INFO, message, meta),
  warn: (message, meta = {}) => writeLog(LogLevel.WARN, message, meta),
  error: (message, meta = {}) => writeLog(LogLevel.ERROR, message, meta),
  fatal: (message, meta = {}) => writeLog(LogLevel.FATAL, message, meta),

  // 项目相关日志
  project: (projectId, message, meta = {}) => 
    writeLog(LogLevel.INFO, `[Project:${projectId}] ${message}`, { projectId, ...meta }),

  // API请求日志
  request: (req, res, duration, meta = {}) => {
    const logMeta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      ...meta
    };
    const level = res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    writeLog(level, `HTTP ${req.method} ${req.path} ${res.statusCode} ${duration}ms`, logMeta);
  },

  // 数据库操作日志
  db: (operation, query, duration, meta = {}) => {
    writeLog(LogLevel.DEBUG, `DB ${operation} ${duration}ms`, { operation, query, duration, ...meta });
  },

  // 性能监控
  performance: (operation, duration, meta = {}) => {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    writeLog(level, `Performance ${operation} ${duration}ms`, { operation, duration, ...meta });
  },

  // 获取统计信息
  getStats: () => ({
    ...performanceStats,
    uptime: Date.now() - performanceStats.startTime,
    currentLevel: levelNames[currentLevel]
  }),

  // 设置日志级别
  setLevel: (level) => {
    const newLevel = LogLevel[level?.toUpperCase()];
    if (newLevel !== undefined) {
      currentLevel = newLevel;
      logger.info(`Log level changed to ${level}`);
    }
  }
};

// 启动时立即清理一次
setImmediate(() => rotator.rotateLogs());

module.exports = { logger, LogEntry, LogLevel };
/**
 * 日志工具（带自动轮转）
 * - 按日期分文件（YYYY-MM-DD.log）
 * - 单文件超过 MAX_LOG_SIZE_MB 时自动截断（保留尾部）
 * - 日志目录总大小超过 MAX_TOTAL_LOG_MB 时删除最老的文件
 * - 保留最近 MAX_LOG_DAYS 天
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = path.join(__dirname, '../../logs');
const MAX_LOG_SIZE_MB = parseInt(process.env.MAX_LOG_SIZE_MB, 10) || 20;  // 单文件上限 20MB
const MAX_LOG_DAYS = parseInt(process.env.MAX_LOG_DAYS, 10) || 30;        // 保留 30 天
const MAX_TOTAL_LOG_MB = parseInt(process.env.MAX_TOTAL_LOG_MB, 10) || 200; // 总上限 200MB

const levels = { debug: 0, info: 1, warn: 2, error: 3 };

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// 上次清理时间（启动时 + 每小时最多一次）
let lastCleanup = 0;

function rotateLogs() {
  const now = Date.now();
  if (now - lastCleanup < 60 * 60 * 1000) return; // 1小时内不重复清理
  lastCleanup = now;

  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => ({
        name: f,
        full: path.join(LOG_DIR, f),
        mtime: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime(),
        size: fs.statSync(path.join(LOG_DIR, f)).size,
      }))
      .sort((a, b) => a.mtime - b.mtime); // 从老到新

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
      try { fs.unlinkSync(f.full); totalBytes -= f.size; } catch (_) {}
    }
  } catch (_) {}
}

// 启动时立即清理一次
setImmediate(rotateLogs);

function shouldLog(level) {
  return (levels[level] ?? 99) >= (levels[LOG_LEVEL] ?? 1);
}

function writeLog(level, message, ...args) {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  const extras = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const line = extras ? `${prefix} ${extras}\n` : `${prefix}\n`;

  // 控制台
  if (level === 'error') process.stderr.write(line);
  else process.stdout.write(line);

  // 写文件
  try {
    const date = timestamp.slice(0, 10);
    const logFile = path.join(LOG_DIR, `${date}.log`);

    // 单文件大小检查
    let needsTruncate = false;
    if (fs.existsSync(logFile)) {
      const { size } = fs.statSync(logFile);
      if (size > MAX_LOG_SIZE_MB * 1024 * 1024) needsTruncate = true;
    }
    if (needsTruncate) {
      // 保留文件末尾 10MB
      const content = fs.readFileSync(logFile);
      const keep = content.slice(-10 * 1024 * 1024);
      const truncHeader = `[${timestamp}] [INFO] --- log truncated (size limit) ---\n`;
      fs.writeFileSync(logFile, truncHeader + keep);
    }

    fs.appendFileSync(logFile, line);
  } catch (_) {}

  // 每次写入后触发轮转检查（低频）
  rotateLogs();
}

const logger = {
  debug: (msg, ...a) => writeLog('debug', msg, ...a),
  info:  (msg, ...a) => writeLog('info',  msg, ...a),
  warn:  (msg, ...a) => writeLog('warn',  msg, ...a),
  error: (msg, ...a) => writeLog('error', msg, ...a),
  project: (projectId, msg, ...a) => writeLog('info', `[Project:${projectId}] ${msg}`, ...a),
};

module.exports = { logger };

/**
 * 审计日志服务
 * 记录所有关键操作：谁、何时、做了什么、结果如何
 */

const path = require('path');
const fs = require('fs-extra');
const { WORK_DIR } = require('../config');
const { logger } = require('../utils/logger');

const AUDIT_LOG_PATH = path.join(WORK_DIR, '..', 'logs', 'audit.log');

/**
 * 记录一条审计日志
 */
async function auditLog(action, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    ...details,
  };
  try {
    await fs.ensureDir(path.dirname(AUDIT_LOG_PATH));
    await fs.appendFile(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    logger.error('Audit log write error:', err);
  }
}

/**
 * 读取审计日志（最新 N 条，支持过滤）
 */
async function readAuditLog(limit = 100, filter = '') {
  try {
    if (!(await fs.pathExists(AUDIT_LOG_PATH))) return [];
    const content = await fs.readFile(AUDIT_LOG_PATH, 'utf8');
    let lines = content.split('\n').filter(l => l.trim()).map(l => {
      try { return JSON.parse(l); } catch (_) { return null; }
    }).filter(Boolean);
    if (filter) {
      const lf = filter.toLowerCase();
      lines = lines.filter(l => JSON.stringify(l).toLowerCase().includes(lf));
    }
    return lines.slice(-limit).reverse();
  } catch (err) {
    logger.error('Audit log read error:', err);
    return [];
  }
}

/**
 * Express 中间件：自动记录写操作
 */
function auditMiddleware(req, res, next) {
  // 只记录写操作（POST/PUT/PATCH/DELETE）
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  // 跳过日志/监控/健康检查等高频接口
  const skip = ['/api/logs', '/api/monitor', '/api/diagnose/network', '/webhook'];
  if (skip.some(p => req.path.startsWith(p))) return next();

  const start = Date.now();
  const origJson = res.json.bind(res);
  res.json = function(data) {
    const success = data?.success !== false && res.statusCode < 400;
    auditLog(`${req.method} ${req.path}`, {
      ip: req.ip || req.connection?.remoteAddress,
      body_keys: req.body ? Object.keys(req.body).join(',') : '',
      status: res.statusCode,
      success,
      ms: Date.now() - start,
    }).catch(() => {});
    return origJson(data);
  };
  next();
}

module.exports = { auditLog, readAuditLog, auditMiddleware };

/**
 * 增强版审计日志服务 - 实现【可靠性-P1】审计日志功能
 * 记录谁（本地用户）、什么时间、做了什么敏感操作（删除项目、改配置、远程部署）
 * 影响模块：日志模块（结构化 JSON 日志 + 定期轮转）
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { logger } = require('../utils/logger');
const { WORK_DIR, AUDIT_LOG_RETENTION_DAYS, AUDIT_LOG_MAX_SIZE_MB } = require('../config');

// 审计日志配置
const AUDIT_LOG_DIR = path.join(WORK_DIR, '..', 'logs', 'audit');
const AUDIT_LOG_RETENTION = AUDIT_LOG_RETENTION_DAYS || 90; // 默认保留90天
const AUDIT_LOG_MAX_SIZE = (AUDIT_LOG_MAX_SIZE_MB || 50) * 1024 * 1024; // 默认50MB
const AUDIT_LOG_ROTATE_SIZE = 10 * 1024 * 1024; // 单个文件10MB时轮转

// 敏感操作类型定义
const AUDIT_ACTION_TYPES = {
  // 项目管理
  PROJECT_CREATE: 'project_create',
  PROJECT_DELETE: 'project_delete',
  PROJECT_UPDATE: 'project_update',
  PROJECT_CONFIG_CHANGE: 'project_config_change',
  
  // 部署操作
  DEPLOY_START: 'deploy_start',
  DEPLOY_COMPLETE: 'deploy_complete',
  DEPLOY_FAIL: 'deploy_fail',
  DEPLOY_CANCEL: 'deploy_cancel',
  REMOTE_DEPLOY: 'remote_deploy',
  
  // 配置管理
  CONFIG_UPDATE: 'config_update',
  CONFIG_DELETE: 'config_delete',
  ENV_VAR_CHANGE: 'env_var_change',
  
  // 系统操作
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore',
  SYSTEM_CLEANUP: 'system_cleanup',
  SERVICE_INSTALL: 'service_install',
  SERVICE_UNINSTALL: 'service_uninstall',
  
  // 安全操作
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  PERMISSION_CHANGE: 'permission_change',
  
  // 数据操作
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  DATA_DELETE: 'data_delete'
};

// 操作风险级别
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// 操作风险映射
const ACTION_RISK_MAPPING = {
  [AUDIT_ACTION_TYPES.PROJECT_DELETE]: RISK_LEVELS.HIGH,
  [AUDIT_ACTION_TYPES.CONFIG_DELETE]: RISK_LEVELS.HIGH,
  [AUDIT_ACTION_TYPES.REMOTE_DEPLOY]: RISK_LEVELS.HIGH,
  [AUDIT_ACTION_TYPES.SYSTEM_RESTORE]: RISK_LEVELS.HIGH,
  [AUDIT_ACTION_TYPES.DATA_DELETE]: RISK_LEVELS.CRITICAL,
  [AUDIT_ACTION_TYPES.PERMISSION_CHANGE]: RISK_LEVELS.CRITICAL,
  [AUDIT_ACTION_TYPES.PROJECT_CREATE]: RISK_LEVELS.LOW,
  [AUDIT_ACTION_TYPES.USER_LOGIN]: RISK_LEVELS.LOW,
  [AUDIT_ACTION_TYPES.USER_LOGOUT]: RISK_LEVELS.LOW,
  // 默认中等风险
  _default: RISK_LEVELS.MEDIUM
};

/**
 * 获取当前用户信息
 */
function getCurrentUserInfo() {
  return {
    username: process.env.USER || process.env.USERNAME || os.userInfo().username,
    uid: process.getuid ? process.getuid() : null,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  };
}

/**
 * 获取操作风险级别
 */
function getActionRiskLevel(actionType) {
  return ACTION_RISK_MAPPING[actionType] || ACTION_RISK_MAPPING._default;
}

/**
 * 生成审计日志文件名（按日期）
 */
function getAuditLogFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `audit-${year}-${month}-${day}.json`;
}

/**
 * 获取当前审计日志文件路径
 */
function getCurrentAuditLogPath() {
  const filename = getAuditLogFilename();
  return path.join(AUDIT_LOG_DIR, filename);
}

/**
 * 确保审计日志目录存在
 */
async function ensureAuditLogDir() {
  try {
    await fs.ensureDir(AUDIT_LOG_DIR);
    return true;
  } catch (error) {
    logger.error('Failed to create audit log directory:', error);
    return false;
  }
}

/**
 * 检查是否需要轮转日志文件
 */
async function checkLogRotationNeeded(logPath) {
  try {
    if (!await fs.pathExists(logPath)) {
      return false;
    }
    
    const stats = await fs.stat(logPath);
    return stats.size >= AUDIT_LOG_ROTATE_SIZE;
  } catch (error) {
    logger.error('Failed to check log rotation:', error);
    return false;
  }
}

/**
 * 轮转审计日志文件
 */
async function rotateAuditLog(oldLogPath) {
  try {
    if (!await fs.pathExists(oldLogPath)) {
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = oldLogPath.replace('.json', `.${timestamp}.json`);
    
    await fs.move(oldLogPath, rotatedPath);
    logger.info(`Audit log rotated: ${path.basename(oldLogPath)} -> ${path.basename(rotatedPath)}`);
    
    // 清理过期的轮转文件
    await cleanupOldAuditLogs();
  } catch (error) {
    logger.error('Failed to rotate audit log:', error);
  }
}

/**
 * 清理过期的审计日志
 */
async function cleanupOldAuditLogs() {
  try {
    const files = await fs.readdir(AUDIT_LOG_DIR);
    const now = Date.now();
    const cutoff = now - (AUDIT_LOG_RETENTION * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      if (!file.startsWith('audit-') || !file.endsWith('.json')) {
        continue;
      }
      
      const filePath = path.join(AUDIT_LOG_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtimeMs < cutoff) {
        await fs.unlink(filePath);
        logger.info(`Cleaned up old audit log: ${file}`);
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup old audit logs:', error);
  }
}

/**
 * 记录增强版审计日志
 */
async function auditLogEnhanced(actionType, details = {}) {
  try {
    // 确保目录存在
    if (!await ensureAuditLogDir()) {
      logger.error('Audit log directory not available');
      return false;
    }
    
    const userInfo = getCurrentUserInfo();
    const riskLevel = getActionRiskLevel(actionType);
    const logPath = getCurrentAuditLogPath();
    
    // 检查是否需要轮转
    if (await checkLogRotationNeeded(logPath)) {
      await rotateAuditLog(logPath);
    }
    
    // 构建结构化日志条目
    const auditEntry = {
      // 元数据
      timestamp: new Date().toISOString(),
      timestamp_unix: Date.now(),
      log_id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      
      // 操作信息
      action_type: actionType,
      action_name: actionType.replace(/_/g, ' ').toUpperCase(),
      risk_level: riskLevel,
      
      // 用户信息
      user: {
        username: userInfo.username,
        uid: userInfo.uid,
        hostname: userInfo.hostname
      },
      
      // 系统信息
      system: {
        platform: userInfo.platform,
        arch: userInfo.arch,
        pid: process.pid,
        node_version: process.version
      },
      
      // 操作详情
      details: {
        ...details,
        // 确保敏感数据被标记
        _sensitive: details._sensitive || false
      },
      
      // 结果状态
      result: details.result || 'unknown',
      success: details.success !== false,
      
      // 性能指标
      duration_ms: details.duration_ms || 0,
      resource_usage: {
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        uptime_seconds: process.uptime()
      }
    };
    
    // 写入日志文件
    const logLine = JSON.stringify(auditEntry) + '\n';
    await fs.appendFile(logPath, logLine, 'utf8');
    
    // 同时记录到常规日志（用于实时监控）
    const logMessage = `[AUDIT] ${auditEntry.action_name} by ${userInfo.username}@${userInfo.hostname}`;
    const logMeta = {
      audit_id: auditEntry.log_id,
      action_type: auditEntry.action_type,
      risk_level: auditEntry.risk_level,
      user: auditEntry.user.username,
      success: auditEntry.success
    };
    
    if (riskLevel === RISK_LEVELS.CRITICAL || riskLevel === RISK_LEVELS.HIGH) {
      logger.warn(logMessage, logMeta);
    } else {
      logger.info(logMessage, logMeta);
    }
    
    return auditEntry.log_id;
  } catch (error) {
    logger.error('Failed to write enhanced audit log:', error);
    return false;
  }
}

/**
 * 查询审计日志
 */
async function queryAuditLogs(options = {}) {
  try {
    if (!await fs.pathExists(AUDIT_LOG_DIR)) {
      return { total: 0, logs: [] };
    }
    
    const {
      startDate = null,
      endDate = new Date(),
      actionType = null,
      riskLevel = null,
      username = null,
      success = null,
      limit = 100,
      offset = 0
    } = options;
    
    const files = await fs.readdir(AUDIT_LOG_DIR);
    const auditLogs = [];
    
    // 按日期过滤文件
    const filteredFiles = files.filter(file => {
      if (!file.startsWith('audit-') || !file.endsWith('.json')) {
        return false;
      }
      
      if (startDate) {
        const fileDateStr = file.match(/audit-(\d{4})-(\d{2})-(\d{2})/);
        if (fileDateStr) {
          const fileDate = new Date(fileDateStr[1], fileDateStr[2] - 1, fileDateStr[3]);
          if (fileDate < startDate) {
            return false;
          }
        }
      }
      
      return true;
    });
    
    // 读取并解析日志
    for (const file of filteredFiles.sort().reverse()) {
      const filePath = path.join(AUDIT_LOG_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            
            // 应用过滤器
            if (actionType && logEntry.action_type !== actionType) continue;
            if (riskLevel && logEntry.risk_level !== riskLevel) continue;
            if (username && logEntry.user.username !== username) continue;
            if (success !== null && logEntry.success !== success) continue;
            if (endDate && new Date(logEntry.timestamp) > endDate) continue;
            
            auditLogs.push(logEntry);
          } catch (parseError) {
            logger.warn(`Failed to parse audit log line in ${file}:`, parseError);
          }
        }
      } catch (readError) {
        logger.warn(`Failed to read audit log file ${file}:`, readError);
      }
      
      // 达到限制时停止
      if (auditLogs.length >= limit + offset) {
        break;
      }
    }
    
    // 应用分页
    const paginatedLogs = auditLogs.slice(offset, offset + limit);
    
    return {
      total: auditLogs.length,
      logs: paginatedLogs,
      page_info: {
        limit,
        offset,
        has_more: auditLogs.length > offset + limit
      }
    };
  } catch (error) {
    logger.error('Failed to query audit logs:', error);
    return { total: 0, logs: [], error: error.message };
  }
}

/**
 * 获取审计统计信息
 */
async function getAuditStats(options = {}) {
  try {
    const queryResult = await queryAuditLogs({ ...options, limit: 10000 });
    
    const stats = {
      total_entries: queryResult.total,
      by_action_type: {},
      by_risk_level: {},
      by_user: {},
      by_hour: {},
      success_rate: 0,
      failure_rate: 0
    };
    
    let successCount = 0;
    let failureCount = 0;
    
    queryResult.logs.forEach(log => {
      // 按操作类型统计
      stats.by_action_type[log.action_type] = (stats.by_action_type[log.action_type] || 0) + 1;
      
      // 按风险级别统计
      stats.by_risk_level[log.risk_level] = (stats.by_risk_level[log.risk_level] || 0) + 1;
      
      // 按用户统计
      const userKey = `${log.user.username}@${log.user.hostname}`;
      stats.by_user[userKey] = (stats.by_user[userKey] || 0) + 1;
      
      // 按小时统计
      const hour = new Date(log.timestamp).getHours();
      stats.by_hour[hour] = (stats.by_hour[hour] || 0) + 1;
      
      // 成功/失败统计
      if (log.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });
    
    const total = successCount + failureCount;
    if (total > 0) {
      stats.success_rate = Math.round((successCount / total) * 100);
      stats.failure_rate = Math.round((failureCount / total) * 100);
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get audit stats:', error);
    return { error: error.message };
  }
}

/**
 * 导出审计日志
 */
async function exportAuditLogs(options = {}) {
  try {
    const queryResult = await queryAuditLogs({ ...options, limit: 100000 });
    
    const exportData = {
      export_timestamp: new Date().toISOString(),
      export_range: {
        start_date: options.startDate || 'all',
        end_date: options.endDate || 'now'
      },
      total_entries: queryResult.total,
      logs: queryResult.logs
    };
    
    return exportData;
  } catch (error) {
    logger.error('Failed to export audit logs:', error);
    return { error: error.message };
  }
}

/**
 * 审计日志中间件（用于Express应用）
 */
function auditLogMiddleware(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  
  // 只记录敏感操作
  const sensitiveMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const sensitivePaths = [
    '/api/projects/delete',
    '/api/projects/config',
    '/api/deploy/remote',
    '/api/config/',
    '/api/system/'
  ];
  
  const isSensitive = sensitiveMethods.includes(req.method) && 
    sensitivePaths.some(path => req.path.startsWith(path));
  
  if (!isSensitive) {
    return next();
  }
  
  // 包装响应方法以记录结果
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // 异步记录审计日志
    setImmediate(async () => {
      const actionType = getActionTypeFromRequest(req);
      await auditLogEnhanced(actionType, {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        success,
        duration_ms: duration,
        user_agent: req.get('User-Agent'),
        client_ip: req.ip,
        request_body: sanitizeRequestBody(req.body),
        response_size: typeof body === 'string' ? body.length : JSON.stringify(body).length
      });
    });
    
    return originalSend.call(this, body);
  };
  
  res.json = function(body) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // 异步记录审计日志
    setImmediate(async () => {
      const actionType = getActionTypeFromRequest(req);
      await auditLogEnhanced(actionType, {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        success,
        duration_ms: duration,
        user_agent: req.get('User-Agent'),
        client_ip: req.ip,
        request_body: sanitizeRequestBody(req.body),
        response_body: sanitizeResponseBody(body)
      });
    });
    
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * 从请求中提取操作类型
 */
function getActionTypeFromRequest(req) {
  const path = req.path;
  const method = req.method;
  
  if (path.includes('/projects/delete')) {
    return AUDIT_ACTION_TYPES.PROJECT_DELETE;
  } else if (path.includes('/projects/config')) {
    return AUDIT_ACTION_TYPES.PROJECT_CONFIG_CHANGE;
  } else if (path.includes('/deploy/remote')) {
    return AUDIT_ACTION_TYPES.REMOTE_DEPLOY;
  } else if (path.includes('/config/')) {
    return method === 'DELETE' ? AUDIT_ACTION_TYPES.CONFIG_DELETE : AUDIT_ACTION_TYPES.CONFIG_UPDATE;
  } else if (path.includes('/system/')) {
    if (path.includes('/backup')) return AUDIT_ACTION_TYPES.SYSTEM_BACKUP;
    if (path.includes('/restore')) return AUDIT_ACTION_TYPES.SYSTEM_RESTORE;
    return AUDIT_ACTION_TYPES.SYSTEM_CLEANUP;
  }
  
  // 默认基于HTTP方法
  switch (method) {
    case 'POST': return AUDIT_ACTION_TYPES.PROJECT_CREATE;
    case 'PUT': return AUDIT_ACTION_TYPES.PROJECT_UPDATE;
    case 'DELETE': return AUDIT_ACTION_TYPES.PROJECT_DELETE;
    default: return AUDIT_ACTION_TYPES.PROJECT_UPDATE;
  }
}

/**
 * 清理请求体中的敏感信息
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field] !== undefined) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * 清理响应体中的敏感信息
 */
function sanitizeResponseBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  const sensitiveFields = ['token', 'secret', 'private_key', 'access_token', 'refresh_token'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field] !== undefined) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * CLI命令审计日志包装器
 */
function wrapCliCommand(commandFn, actionType, commandName) {
  return async function(...args) {
    const startTime = Date.now();
    let success = false;
    let result = 'unknown';
    
    try {
      const commandResult = await commandFn(...args);
      success = true;
      result = 'success';
      return commandResult;
    } catch (error) {
      result = 'error';
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      const userInfo = getCurrentUserInfo();
      
      await auditLogEnhanced(actionType, {
        command: commandName,
        success,
        result,
        duration_ms: duration,
        user: userInfo.username,
        hostname: userInfo.hostname,
        args: args.slice(0, 3) // 只记录前3个参数
      });
    }
  };
}

module.exports = {
  AUDIT_ACTION_TYPES,
  RISK_LEVELS,
  
  // 核心功能
  auditLogEnhanced,
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  
  // 工具函数
  getCurrentUserInfo,
  getActionRiskLevel,
  ensureAuditLogDir,
  cleanupOldAuditLogs,
  
  // 中间件和包装器
  auditLogMiddleware,
  wrapCliCommand,
  
  // 配置
  AUDIT_LOG_DIR,
  AUDIT_LOG_RETENTION,
  AUDIT_LOG_MAX_SIZE
};
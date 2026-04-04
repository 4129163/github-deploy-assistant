/**
 * 统一配置模块
 * 所有模块从这里读取配置，避免各处硬编码
 */

const path = require('path');

module.exports = {
  // 服务器配置
  PORT: parseInt(process.env.PORT, 10) || 3456,
  NODE_ENV: process.env.NODE_ENV || 'development',
  HOST: process.env.HOST || '0.0.0.0',
  
  // 工作目录
  WORK_DIR: process.env.WORK_DIR || path.join(__dirname, '../workspace'),
  ALLOW_AUTO_EXEC: process.env.ALLOW_AUTO_EXEC !== 'false',
  
  // 日志配置
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  MAX_LOG_SIZE_MB: parseInt(process.env.MAX_LOG_SIZE_MB, 10) || 20,
  MAX_LOG_DAYS: parseInt(process.env.MAX_LOG_DAYS, 10) || 30,
  MAX_TOTAL_LOG_MB: parseInt(process.env.MAX_TOTAL_LOG_MB, 10) || 200,
  ENABLE_JSON_LOG: process.env.ENABLE_JSON_LOG === 'true',
  ENABLE_REMOTE_LOG: process.env.ENABLE_REMOTE_LOG === 'true',
  REMOTE_LOG_URL: process.env.REMOTE_LOG_URL || '',
  
  // AI配置
  DEFAULT_AI_PROVIDER: process.env.DEFAULT_AI_PROVIDER || 'openai',
  
  // 数据库配置
  DB_PATH: path.join(__dirname, '../database/gada.db'),
  
  // 日志目录
  LOGS_DIR: path.join(__dirname, '../logs'),
  
  // 安全配置
  GADA_SECRET_KEY: process.env.GADA_SECRET_KEY || null,
  SESSION_SECRET: process.env.SESSION_SECRET || 'gada-session-secret-change-me',
  JWT_SECRET: process.env.JWT_SECRET || 'gada-jwt-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15分钟
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  
  // 缓存配置
  LOG_CACHE_SIZE: parseInt(process.env.LOG_CACHE_SIZE) || 200,
  LOG_CACHE_TTL: parseInt(process.env.LOG_CACHE_TTL) || 3600000,
  API_CACHE_TTL: parseInt(process.env.API_CACHE_TTL) || 300000,
  
  // 进程管理
  PROCESS_RESTART_MAX_WAIT: parseInt(process.env.PROCESS_RESTART_MAX_WAIT) || 10000,
  PROCESS_RESTART_DELAY: parseInt(process.env.PROCESS_RESTART_DELAY) || 500,
  PROCESS_MONITOR_INTERVAL: parseInt(process.env.PROCESS_MONITOR_INTERVAL) || 30000,
  
  // 性能监控
  PERFORMANCE_MONITOR_ENABLED: process.env.PERFORMANCE_MONITOR_ENABLED !== 'false',
  PERFORMANCE_SAMPLING_INTERVAL: parseInt(process.env.PERFORMANCE_SAMPLING_INTERVAL, 10) || 60000,
  
  // GitHub配置
  GITHUB_API_TIMEOUT: parseInt(process.env.GITHUB_API_TIMEOUT, 10) || 10000,
  GITHUB_RATE_LIMIT_WINDOW: parseInt(process.env.GITHUB_RATE_LIMIT_WINDOW, 10) || 60000,
  
  // Webhook配置
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',
  WEBHOOK_TIMEOUT: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 5000,
  
  // 文件上传配置
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 50 * 1024 * 1024, // 50MB
  UPLOAD_ALLOWED_TYPES: (process.env.UPLOAD_ALLOWED_TYPES || '.zip,.tar,.tar.gz,.tgz,.gz').split(','),
  
  // 备份配置
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 7,
  BACKUP_MAX_COUNT: parseInt(process.env.BACKUP_MAX_COUNT, 10) || 10,
  BACKUP_COMPRESS_LEVEL: parseInt(process.env.BACKUP_COMPRESS_LEVEL, 10) || 6,
  
  // 健康检查配置
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
  HEALTH_CHECK_TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 5000,
  
  // 邮件通知配置
  EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL || '',
  
  // 调试配置
  DEBUG_SQL: process.env.DEBUG_SQL === 'true',
  DEBUG_API: process.env.DEBUG_API === 'true',
  DEBUG_PERFORMANCE: process.env.DEBUG_PERFORMANCE === 'true'
};
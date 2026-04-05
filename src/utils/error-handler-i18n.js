/**
 * 国际化错误处理模块
 * 基于原有的错误处理模块，添加国际化支持
 */

// 使用简单的logger进行测试
let logger;
try {
  // 尝试加载原始logger
  logger = require('./logger').logger;
} catch (error) {
  // 如果原始logger有问题，使用简单logger
  logger = require('./logger-simple').logger;
}
const { i18nErrorHandler } = require('./i18n/error-messages');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // 保持调用栈
    Error.captureStackTrace(this, this.constructor);
  }
}

// 国际化错误类
class I18nAppError extends AppError {
  constructor(key, statusCode = 500, params = {}, details = null, lang = 'zh-CN') {
    const message = i18nErrorHandler.getErrorMessage(key, lang, params);
    super(message, statusCode, true, details);
    this.key = key;
    this.params = params;
    this.lang = lang;
  }
}

// 错误分类（与原有模块兼容）
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

// 预定义的错误工厂（国际化版本）
const createI18nError = (type, key, params = {}, details = null, lang = 'zh-CN') => {
  const statusCodes = {
    [ErrorTypes.VALIDATION_ERROR]: 400,
    [ErrorTypes.AUTHENTICATION_ERROR]: 401,
    [ErrorTypes.AUTHORIZATION_ERROR]: 403,
    [ErrorTypes.NOT_FOUND_ERROR]: 404,
    [ErrorTypes.CONFLICT_ERROR]: 409,
    [ErrorTypes.RATE_LIMIT_ERROR]: 429,
    [ErrorTypes.EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorTypes.DATABASE_ERROR]: 503,
    [ErrorTypes.INTERNAL_ERROR]: 500,
    [ErrorTypes.CONFIGURATION_ERROR]: 500,
    [ErrorTypes.NETWORK_ERROR]: 503
  };

  const statusCode = statusCodes[type] || 500;
  return new I18nAppError(key, statusCode, params, details, lang);
};

// 国际化错误工厂（简化版本）
const I18nErrors = {
  validation: (key, params, details, lang) => createI18nError(ErrorTypes.VALIDATION_ERROR, key, params, details, lang),
  authentication: (key, params, details, lang) => createI18nError(ErrorTypes.AUTHENTICATION_ERROR, key, params, details, lang),
  authorization: (key, params, details, lang) => createI18nError(ErrorTypes.AUTHORIZATION_ERROR, key, params, details, lang),
  notFound: (key, params, details, lang) => createI18nError(ErrorTypes.NOT_FOUND_ERROR, key, params, details, lang),
  conflict: (key, params, details, lang) => createI18nError(ErrorTypes.CONFLICT_ERROR, key, params, details, lang),
  rateLimit: (key, params, details, lang) => createI18nError(ErrorTypes.RATE_LIMIT_ERROR, key, params, details, lang),
  externalService: (key, params, details, lang) => createI18nError(ErrorTypes.EXTERNAL_SERVICE_ERROR, key, params, details, lang),
  database: (key, params, details, lang) => createI18nError(ErrorTypes.DATABASE_ERROR, key, params, details, lang),
  internal: (key, params, details, lang) => createI18nError(ErrorTypes.INTERNAL_ERROR, key, params, details, lang),
  configuration: (key, params, details, lang) => createI18nError(ErrorTypes.CONFIGURATION_ERROR, key, params, details, lang),
  network: (key, params, details, lang) => createI18nError(ErrorTypes.NETWORK_ERROR, key, params, details, lang)
};

// 常用的预定义错误（国际化）
const CommonErrors = {
  // 验证错误
  invalidInput: (params, details, lang) => I18nErrors.validation('INVALID_INPUT', params, details, lang),
  missingField: (field, details, lang) => I18nErrors.validation('MISSING_REQUIRED_FIELD', { field }, details, lang),
  invalidEmail: (details, lang) => I18nErrors.validation('INVALID_EMAIL', {}, details, lang),
  invalidUrl: (details, lang) => I18nErrors.validation('INVALID_URL', {}, details, lang),
  invalidPort: (details, lang) => I18nErrors.validation('INVALID_PORT', {}, details, lang),
  invalidPath: (details, lang) => I18nErrors.validation('INVALID_PATH', {}, details, lang),
  invalidProjectType: (details, lang) => I18nErrors.validation('INVALID_PROJECT_TYPE', {}, details, lang),
  
  // 认证错误
  invalidCredentials: (details, lang) => I18nErrors.authentication('INVALID_CREDENTIALS', {}, details, lang),
  tokenExpired: (details, lang) => I18nErrors.authentication('TOKEN_EXPIRED', {}, details, lang),
  tokenInvalid: (details, lang) => I18nErrors.authentication('TOKEN_INVALID', {}, details, lang),
  accessDenied: (details, lang) => I18nErrors.authentication('ACCESS_DENIED', {}, details, lang),
  insufficientPermissions: (details, lang) => I18nErrors.authentication('INSUFFICIENT_PERMISSIONS', {}, details, lang),
  
  // 未找到错误
  projectNotFound: (params, details, lang) => I18nErrors.notFound('PROJECT_NOT_FOUND', params, details, lang),
  userNotFound: (params, details, lang) => I18nErrors.notFound('USER_NOT_FOUND', params, details, lang),
  fileNotFound: (params, details, lang) => I18nErrors.notFound('FILE_NOT_FOUND', params, details, lang),
  resourceNotFound: (params, details, lang) => I18nErrors.notFound('RESOURCE_NOT_FOUND', params, details, lang),
  endpointNotFound: (params, details, lang) => I18nErrors.notFound('ENDPOINT_NOT_FOUND', params, details, lang),
  
  // 冲突错误
  projectExists: (params, details, lang) => I18nErrors.conflict('PROJECT_EXISTS', params, details, lang),
  userExists: (params, details, lang) => I18nErrors.conflict('USER_EXISTS', params, details, lang),
  duplicateEntry: (params, details, lang) => I18nErrors.conflict('DUPLICATE_ENTRY', params, details, lang),
  
  // 速率限制错误
  tooManyRequests: (params, details, lang) => I18nErrors.rateLimit('TOO_MANY_REQUESTS', params, details, lang),
  rateLimitExceeded: (params, details, lang) => I18nErrors.rateLimit('RATE_LIMIT_ERROR', params, details, lang),
  
  // 外部服务错误
  githubApiError: (params, details, lang) => I18nErrors.externalService('GITHUB_API_ERROR', params, details, lang),
  dockerApiError: (params, details, lang) => I18nErrors.externalService('DOCKER_API_ERROR', params, details, lang),
  databaseConnectionError: (params, details, lang) => I18nErrors.externalService('DATABASE_CONNECTION_ERROR', params, details, lang),
  networkError: (params, details, lang) => I18nErrors.externalService('NETWORK_ERROR', params, details, lang),
  
  // 数据库错误
  queryFailed: (params, details, lang) => I18nErrors.database('QUERY_FAILED', params, details, lang),
  connectionFailed: (params, details, lang) => I18nErrors.database('CONNECTION_FAILED', params, details, lang),
  transactionFailed: (params, details, lang) => I18nErrors.database('TRANSACTION_FAILED', params, details, lang),
  
  // 部署相关错误
  deploymentFailed: (params, details, lang) => I18nErrors.internal('DEPLOYMENT_ERROR', params, details, lang),
  buildFailed: (params, details, lang) => I18nErrors.internal('BUILD_FAILED', params, details, lang),
  dependencyInstallFailed: (params, details, lang) => I18nErrors.internal('DEPENDENCY_INSTALL_FAILED', params, details, lang),
  startFailed: (params, details, lang) => I18nErrors.internal('START_FAILED', params, details, lang),
  stopFailed: (params, details, lang) => I18nErrors.internal('STOP_FAILED', params, details, lang),
  restartFailed: (params, details, lang) => I18nErrors.internal('RESTART_FAILED', params, details, lang),
  backupFailed: (params, details, lang) => I18nErrors.internal('BACKUP_FAILED', params, details, lang),
  restoreFailed: (params, details, lang) => I18nErrors.internal('RESTORE_FAILED', params, details, lang),
  
  // 项目操作错误
  projectCreateFailed: (params, details, lang) => I18nErrors.internal('PROJECT_CREATE_ERROR', params, details, lang),
  projectUpdateFailed: (params, details, lang) => I18nErrors.internal('PROJECT_UPDATE_ERROR', params, details, lang),
  projectDeleteFailed: (params, details, lang) => I18nErrors.internal('PROJECT_DELETE_ERROR', params, details, lang),
  projectStartFailed: (params, details, lang) => I18nErrors.internal('PROJECT_START_ERROR', params, details, lang),
  projectStopFailed: (params, details, lang) => I18nErrors.internal('PROJECT_STOP_ERROR', params, details, lang),
  projectRestartFailed: (params, details, lang) => I18nErrors.internal('PROJECT_RESTART_ERROR', params, details, lang),
  projectBackupFailed: (params, details, lang) => I18nErrors.internal('PROJECT_BACKUP_ERROR', params, details, lang),
  projectRestoreFailed: (params, details, lang) => I18nErrors.internal('PROJECT_RESTORE_ERROR', params, details, lang),
  
  // 系统错误
  internalError: (params, details, lang) => I18nErrors.internal('INTERNAL_ERROR', params, details, lang),
  unexpectedError: (params, details, lang) => I18nErrors.internal('UNEXPECTED_ERROR', params, details, lang),
  serverError: (params, details, lang) => I18nErrors.internal('SERVER_ERROR', params, details, lang),
  configurationError: (params, details, lang) => I18nErrors.configuration('CONFIGURATION_ERROR', params, details, lang),
  missingConfig: (config, details, lang) => I18nErrors.configuration('MISSING_CONFIG', { config }, details, lang),
  
  // 文件系统错误
  fileReadError: (params, details, lang) => I18nErrors.internal('FILE_READ_ERROR', params, details, lang),
  fileWriteError: (params, details, lang) => I18nErrors.internal('FILE_WRITE_ERROR', params, details, lang),
  fileDeleteError: (params, details, lang) => I18nErrors.internal('FILE_DELETE_ERROR', params, details, lang),
  permissionDenied: (params, details, lang) => I18nErrors.internal('PERMISSION_DENIED', params, details, lang)
};

// 国际化错误处理中间件
const i18nErrorHandlerMiddleware = (err, req, res, next) => {
  // 记录错误日志
  logger.error(`[${err.statusCode || 500}] ${err.message}`, {
    errorType: err.constructor.name,
    key: err.key,
    params: err.params,
    details: err.details,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: err.timestamp || new Date().toISOString(),
    lang: req.lang || 'zh-CN'
  });

  // 如果是国际化错误
  if (err instanceof I18nAppError) {
    const response = i18nErrorHandler.createErrorResponse(
      err.key,
      req.lang || err.lang || 'zh-CN',
      err.params,
      err.details
    );
    
    return res.status(err.statusCode).json(response);
  }

  // 如果是AppError（原有模块）
  if (err instanceof AppError) {
    // 尝试将原有错误消息映射到国际化键
    let errorKey = 'INTERNAL_ERROR';
    let errorParams = {};
    
    // 简单的消息映射（可以根据需要扩展）
    const messageToKey = {
      'Invalid token': 'TOKEN_INVALID',
      'Validation failed': 'VALIDATION_ERROR',
      'Resource not found': 'RESOURCE_NOT_FOUND',
      'Authentication failed': 'AUTHENTICATION_ERROR',
      'Permission denied': 'ACCESS_DENIED'
    };
    
    for (const [message, key] of Object.entries(messageToKey)) {
      if (err.message.includes(message)) {
        errorKey = key;
        break;
      }
    }
    
    const response = i18nErrorHandler.createErrorResponse(
      errorKey,
      req.lang || 'zh-CN',
      errorParams,
      err.details
    );
    
    return res.status(err.statusCode).json(response);
  }

  // 如果是 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    const response = i18nErrorHandler.createErrorResponse(
      'TOKEN_INVALID',
      req.lang || 'zh-CN',
      {},
      err.message
    );
    
    return res.status(401).json(response);
  }

  // 如果是验证错误
  if (err.name === 'ValidationError' || err.name === 'ValidatorError') {
    const response = i18nErrorHandler.createErrorResponse(
      'VALIDATION_ERROR',
      req.lang || 'zh-CN',
      {},
      err.details || err.message
    );
    
    return res.status(400).json(response);
  }

  // 默认错误处理
  const response = i18nErrorHandler.createErrorResponse(
    'INTERNAL_ERROR',
    req.lang || 'zh-CN',
    {},
    process.env.NODE_ENV === 'development' ? err.message : undefined
  );

  return res.status(err.statusCode || 500).json(response);
};

// 404处理器（国际化）
const i18nNotFoundHandler = (req, res, next) => {
  const error = CommonErrors.endpointNotFound(
    { path: req.originalUrl, method: req.method },
    null,
    req.lang || 'zh-CN'
  );
  next(error);
};

// 成功响应包装器（国际化）
const successResponse = (req, key = 'SUCCESS', data = null, params = {}) => {
  return i18nErrorHandler.createSuccessResponse(
    key,
    req.lang || 'zh-CN',
    params,
    data
  );
};

// 异步包装器，用于处理 async/await 错误
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  // 原有模块导出（保持兼容性）
  AppError,
  ErrorTypes,
  
  // 国际化模块导出
  I18nAppError,
  createI18nError,
  I18nErrors,
  CommonErrors,
  
  // 中间件
  i18nErrorHandlerMiddleware,
  i18nNotFoundHandler,
  
  // 工具函数
  successResponse,
  asyncHandler,
  
  // 错误处理函数
  errorHandler: i18nErrorHandlerMiddleware,
  notFoundHandler: i18nNotFoundHandler
};
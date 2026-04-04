/**
 * 统一错误处理模块
 * 提供标准化的错误分类、日志记录和响应格式化
 */

const { logger } = require('./logger');

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

// 错误分类
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

// 预定义的错误工厂
const createError = (type, message, details = null) => {
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
  return new AppError(message, statusCode, true, details);
};

// 通用错误
const Errors = {
  validation: (message, details) => createError(ErrorTypes.VALIDATION_ERROR, message, details),
  authentication: (message, details) => createError(ErrorTypes.AUTHENTICATION_ERROR, message, details),
  authorization: (message, details) => createError(ErrorTypes.AUTHORIZATION_ERROR, message, details),
  notFound: (message, details) => createError(ErrorTypes.NOT_FOUND_ERROR, message, details),
  conflict: (message, details) => createError(ErrorTypes.CONFLICT_ERROR, message, details),
  rateLimit: (message, details) => createError(ErrorTypes.RATE_LIMIT_ERROR, message, details),
  externalService: (message, details) => createError(ErrorTypes.EXTERNAL_SERVICE_ERROR, message, details),
  database: (message, details) => createError(ErrorTypes.DATABASE_ERROR, message, details),
  internal: (message, details) => createError(ErrorTypes.INTERNAL_ERROR, message, details),
  configuration: (message, details) => createError(ErrorTypes.CONFIGURATION_ERROR, message, details),
  network: (message, details) => createError(ErrorTypes.NETWORK_ERROR, message, details)
};

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 如果是自定义错误，使用其状态码和消息
  if (err instanceof AppError) {
    logger.error(`[${err.statusCode}] ${err.message}`, {
      errorType: err.constructor.name,
      details: err.details,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: err.timestamp
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.statusCode,
        type: err.constructor.name,
        details: err.details,
        timestamp: err.timestamp,
        path: req.path
      }
    });
  }

  // 如果是 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    logger.error('JWT Error', { error: err.message, path: req.path, method: req.method });
    
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 401,
        type: 'AUTHENTICATION_ERROR',
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }

  // 如果是验证错误（如 Joi、express-validator）
  if (err.name === 'ValidationError' || err.name === 'ValidatorError') {
    logger.error('Validation Error', { error: err.message, details: err.details, path: req.path });
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 400,
        type: 'VALIDATION_ERROR',
        details: err.details || err.message,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }

  // 默认错误处理
  logger.error('Unhandled Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      type: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
};

// 异步包装器，用于处理 async/await 错误
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 处理器
const notFoundHandler = (req, res, next) => {
  const error = Errors.notFound(`Cannot ${req.method} ${req.originalUrl}`);
  next(error);
};

// 安全错误处理 - 防止泄露敏感信息
const safeError = (err, includeDetails = false) => {
  if (err instanceof AppError) {
    return {
      message: err.message,
      statusCode: err.statusCode,
      timestamp: err.timestamp,
      ...(includeDetails && { details: err.details })
    };
  }

  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  AppError,
  ErrorTypes,
  Errors,
  createError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  safeError
};
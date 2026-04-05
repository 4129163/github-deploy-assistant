/**
 * 统一错误处理中间件
 * 捕获所有未处理的错误，提供统一的错误响应格式
 */

const { logger } = require('../utils/logger');
const { ValidationError, AuthenticationError, AuthorizationError, ResourceNotFoundError, RateLimitError, InternalServerError } = require('../utils/custom-errors');

/**
 * 创建统一错误处理中间件
 * 应该作为最后一个中间件使用
 */
function createErrorHandler() {
  return function errorHandler(err, req, res, next) {
    // 如果响应已经发送，直接调用默认的 Express 错误处理器
    if (res.headersSent) {
      return next(err);
    }
    
    // 标准化错误对象
    const standardizedError = standardizeError(err);
    
    // 记录错误日志
    logError(standardizedError, req);
    
    // 根据环境决定是否发送堆栈信息
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response = buildErrorResponse(standardizedError, isDevelopment);
    
    // 发送错误响应
    res.status(response.statusCode).json(response);
  };
}

/**
 * 标准化错误对象
 */
function standardizeError(err) {
  // 如果是自定义错误类型，直接使用
  if (err instanceof ValidationError ||
      err instanceof AuthenticationError ||
      err instanceof AuthorizationError ||
      err instanceof ResourceNotFoundError ||
      err instanceof RateLimitError ||
      err instanceof InternalServerError) {
    return err;
  }
  
  // 处理常见的错误类型
  if (err.name === 'ValidationError' || err.name === 'ValidatorError') {
    return new ValidationError(err.message, err.details || err.errors);
  }
  
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return new AuthenticationError('无效或过期的认证令牌');
  }
  
  if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'MongoError' && err.code === 11000) {
    return new ValidationError('数据已存在', { field: Object.keys(err.keyPattern || {})[0] });
  }
  
  if (err.name === 'CastError' || err.name === 'ObjectId' || err.name === 'SequelizeDatabaseError') {
    return new ValidationError('无效的数据格式或ID');
  }
  
  if (err.statusCode && err.statusCode === 404) {
    return new ResourceNotFoundError(err.message || '请求的资源不存在');
  }
  
  if (err.statusCode && err.statusCode === 429) {
    return new RateLimitError(err.message || '请求过于频繁，请稍后再试');
  }
  
  // 对于其他错误，包装为内部服务器错误
  return new InternalServerError(err.message || '服务器内部错误', {
    originalError: err.message,
    stack: err.stack
  });
}

/**
 * 记录错误日志
 */
function logError(err, req) {
  const logContext = {
    timestamp: new Date().toISOString(),
    errorType: err.name,
    statusCode: err.statusCode,
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user ? req.user.id : null
  };
  
  // 根据错误级别记录不同的日志
  if (err.statusCode >= 500) {
    logger.error(`服务器错误: ${err.message}`, {
      ...logContext,
      stack: err.stack,
      details: err.details
    });
  } else if (err.statusCode >= 400) {
    logger.warn(`客户端错误: ${err.message}`, logContext);
  } else {
    logger.info(`业务错误: ${err.message}`, logContext);
  }
  
  // 记录额外的错误指标
  if (err.statusCode >= 500) {
    // 这里可以集成错误监控服务，如 Sentry、New Relic 等
    // trackErrorMetric(err, req);
  }
}

/**
 * 构建错误响应
 */
function buildErrorResponse(err, includeStack = false) {
  const response = {
    success: false,
    error: {
      code: err.code || `ERR_${err.statusCode}`,
      message: err.message,
      type: err.name
    },
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substring(2, 15)
  };
  
  // 添加详情信息（如果有）
  if (err.details) {
    response.error.details = err.details;
  }
  
  // 添加验证错误详情（如果有）
  if (err.validationErrors) {
    response.error.validationErrors = err.validationErrors;
  }
  
  // 在开发环境中包含堆栈信息
  if (includeStack && err.stack) {
    response.error.stack = err.stack.split('\n').map(line => line.trim());
  }
  
  // 添加文档链接（如果有）
  if (err.documentationUrl) {
    response.error.documentation = err.documentationUrl;
  }
  
  return response;
}

/**
 * 404 错误处理中间件
 */
function createNotFoundHandler() {
  return function notFoundHandler(req, res, next) {
    const err = new ResourceNotFoundError(`路由 ${req.method} ${req.originalUrl} 不存在`);
    next(err);
  };
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理函数，自动捕获错误
 */
function asyncHandler(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 全局未捕获异常处理器
 */
function setupGlobalErrorHandlers() {
  // 处理未捕获的异常
  process.on('uncaughtException', (err) => {
    logger.error('未捕获的异常:', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    // 优雅关闭
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝:', {
      reason: reason.message || reason,
      stack: reason.stack,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = {
  createErrorHandler,
  createNotFoundHandler,
  asyncHandler,
  setupGlobalErrorHandlers,
  standardizeError,
  logError,
  buildErrorResponse
};
/**
 * 统一错误处理中间件
 * 集成现有的错误处理系统，提供完整的错误处理链
 */

const { AppError, Errors, errorHandler: baseErrorHandler, asyncHandler: baseAsyncHandler } = require('../utils/error-handler');
const { logger } = require('../utils/logger');

/**
 * 增强的错误处理中间件
 * 提供更完整的错误处理功能，包括：
 * 1. 错误标准化
 * 2. 错误分类
 * 3. 错误日志记录
 * 4. 错误指标收集
 * 5. 错误响应格式化
 */
function createUnifiedErrorHandler(options = {}) {
  const config = {
    logErrors: true,
    trackMetrics: false,
    includeStack: process.env.NODE_ENV === 'development',
    formatResponse: true,
    ...options
  };
  
  return function unifiedErrorHandler(err, req, res, next) {
    // 如果响应已经发送，直接调用默认处理器
    if (res.headersSent) {
      return next(err);
    }
    
    // 标准化错误
    const standardizedError = standardizeError(err);
    
    // 记录错误日志
    if (config.logErrors) {
      logErrorWithContext(standardizedError, req, config);
    }
    
    // 跟踪错误指标
    if (config.trackMetrics) {
      trackErrorMetrics(standardizedError, req);
    }
    
    // 使用基础的错误处理器
    baseErrorHandler(standardizedError, req, res, next);
  };
}

/**
 * 标准化错误对象
 */
function standardizeError(err) {
  // 如果已经是 AppError，直接返回
  if (err instanceof AppError) {
    return err;
  }
  
  // 处理常见的错误类型
  switch (err.name) {
    case 'ValidationError':
    case 'ValidatorError':
      return Errors.validation(err.message, err.details || err.errors);
    
    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      return Errors.authentication('无效或过期的认证令牌');
    
    case 'SequelizeUniqueConstraintError':
      return Errors.conflict('数据已存在', { 
        field: Object.keys(err.fields || {})[0],
        value: Object.values(err.fields || {})[0]
      });
    
    case 'MongoError':
      if (err.code === 11000) {
        return Errors.conflict('数据已存在', { 
          field: Object.keys(err.keyPattern || {})[0]
        });
      }
      return Errors.database('数据库错误', err.message);
    
    case 'CastError':
    case 'ObjectId':
      return Errors.validation('无效的数据格式或ID');
    
    case 'SequelizeDatabaseError':
      return Errors.database('数据库操作错误', err.message);
    
    case 'AxiosError':
      return Errors.externalService(`外部服务错误: ${err.message}`, {
        url: err.config?.url,
        method: err.config?.method,
        status: err.response?.status
      });
    
    default:
      // 检查是否有状态码
      if (err.statusCode) {
        switch (err.statusCode) {
          case 400:
            return Errors.validation(err.message, err.details);
          case 401:
            return Errors.authentication(err.message, err.details);
          case 403:
            return Errors.authorization(err.message, err.details);
          case 404:
            return Errors.notFound(err.message, err.details);
          case 409:
            return Errors.conflict(err.message, err.details);
          case 429:
            return Errors.rateLimit(err.message, err.details);
          case 502:
          case 503:
          case 504:
            return Errors.externalService(err.message, err.details);
          default:
            return Errors.internal(err.message, err.details);
        }
      }
      
      // 默认转换为内部错误
      return Errors.internal(err.message || '服务器内部错误', {
        originalError: err.message,
        stack: err.stack
      });
  }
}

/**
 * 带上下文的错误日志记录
 */
function logErrorWithContext(err, req, config) {
  const logContext = {
    timestamp: new Date().toISOString(),
    errorType: err.constructor.name,
    statusCode: err.statusCode,
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user ? req.user.id : null,
    requestId: req.requestId || Math.random().toString(36).substring(2, 15)
  };
  
  // 根据错误级别记录不同的日志
  if (err.statusCode >= 500) {
    logger.error(`服务器错误 [${err.statusCode}]: ${err.message}`, {
      ...logContext,
      stack: config.includeStack ? err.stack : undefined,
      details: err.details,
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    // 发送到错误监控服务
    if (config.trackMetrics) {
      sendToErrorMonitoring(err, logContext);
    }
    
  } else if (err.statusCode >= 400) {
    logger.warn(`客户端错误 [${err.statusCode}]: ${err.message}`, logContext);
  } else {
    logger.info(`业务错误 [${err.statusCode}]: ${err.message}`, logContext);
  }
}

/**
 * 跟踪错误指标
 */
function trackErrorMetrics(err, req) {
  // 这里可以集成 Prometheus、StatsD 等指标收集系统
  const metrics = {
    error_type: err.constructor.name,
    status_code: err.statusCode,
    path: req.path,
    method: req.method,
    timestamp: Date.now()
  };
  
  // 示例：发送到指标收集服务
  // metricsClient.increment('errors.total', 1, metrics);
  // metricsClient.increment(`errors.by_type.${metrics.error_type}`, 1);
  // metricsClient.increment(`errors.by_status.${metrics.status_code}`, 1);
  
  // 记录到日志供后续分析
  logger.debug('错误指标', metrics);
}

/**
 * 发送到错误监控服务
 */
function sendToErrorMonitoring(err, context) {
  // 这里可以集成 Sentry、New Relic、Datadog 等错误监控服务
  const errorData = {
    ...context,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'unknown'
  };
  
  // 示例：发送到 Sentry
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(err, { extra: errorData });
  // }
  
  // 记录到文件供后续分析
  logger.info('错误监控数据', errorData);
}

/**
 * 404 处理器
 */
function createNotFoundHandler() {
  return function notFoundHandler(req, res, next) {
    const err = Errors.notFound(`路由 ${req.method} ${req.originalUrl} 不存在`);
    next(err);
  };
}

/**
 * 全局未捕获异常处理器
 */
function setupGlobalErrorHandlers() {
  // 处理未捕获的异常
  process.on('uncaughtException', (err) => {
    logger.fatal('未捕获的异常:', {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
    
    // 记录最后一次错误
    require('fs').writeFileSync(
      '/tmp/last-uncaught-exception.json',
      JSON.stringify({
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        pid: process.pid
      }, null, 2)
    );
    
    // 优雅关闭
    setTimeout(() => {
      logger.fatal('因未捕获异常而退出进程');
      process.exit(1);
    }, 1000);
  });
  
  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝:', {
      reason: reason.message || reason,
      stack: reason.stack,
      timestamp: new Date().toISOString(),
      promise: promise.toString().substring(0, 200)
    });
    
    // 记录最后一次拒绝
    require('fs').writeFileSync(
      '/tmp/last-unhandled-rejection.json',
      JSON.stringify({
        reason: reason.message || reason,
        stack: reason.stack,
        timestamp: new Date().toISOString(),
        promise: promise.toString().substring(0, 200)
      }, null, 2)
    );
  });
}

/**
 * 验证中间件
 * 用于验证请求数据
 */
function createValidationMiddleware(validator) {
  return baseAsyncHandler(async (req, res, next) => {
    try {
      await validator(req, res, next);
      next();
    } catch (error) {
      next(Errors.validation('请求验证失败', error.details || error.message));
    }
  });
}

/**
 * 速率限制错误处理器
 */
function createRateLimitHandler(limiter) {
  return function rateLimitHandler(req, res, next) {
    limiter(req, res, (err) => {
      if (err) {
        return next(Errors.rateLimit('请求过于频繁，请稍后再试', {
          retryAfter: err.retryAfter,
          limit: err.limit,
          remaining: err.remaining
        }));
      }
      next();
    });
  };
}

module.exports = {
  createUnifiedErrorHandler,
  createNotFoundHandler,
  setupGlobalErrorHandlers,
  createValidationMiddleware,
  createRateLimitHandler,
  standardizeError,
  logErrorWithContext,
  trackErrorMetrics,
  // 重新导出基础功能
  AppError,
  Errors,
  asyncHandler: baseAsyncHandler
};
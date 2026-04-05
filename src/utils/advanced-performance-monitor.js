/**
 * 高级性能监控模块
 * 扩展原有的性能监控，添加更多指标收集功能：
 * 1. 请求队列深度监控
 * 2. 垃圾回收统计
 * 3. 事件循环延迟
 * 4. HTTP请求详情
 * 5. 数据库连接池状态
 * 6. 缓存命中率
 * 7. 自定义业务指标
 */

const os = require('os');
const v8 = require('v8');
const { performance, PerformanceObserver } = require('perf_hooks');
const { logger } = require('./logger');

class AdvancedPerformanceMonitor {
  constructor() {
    // 继承基础指标
    this.baseMetrics = require('./performance-monitor').performanceMonitor;
    
    // 高级指标
    this.advancedMetrics = {
      // 请求队列深度
      requestQueueDepth: {
        current: 0,
        max: 0,
        avg: 0,
        samples: [],
        totalRequests: 0
      },
      
      // 事件循环延迟
      eventLoopDelay: {
        current: 0,
        max: 0,
        avg: 0,
        samples: [],
        histograms: []
      },
      
      // 垃圾回收统计
      gcStats: {
        totalCount: 0,
        totalTime: 0,
        byType: new Map(), // type -> { count, totalTime }
        lastGcTime: 0
      },
      
      // HTTP请求详情
      httpRequests: {
        byStatusCode: new Map(), // status -> count
        byContentType: new Map(), // contentType -> count
        byUserAgent: new Map(), // userAgent -> count
        responseSizes: [], // 响应大小分布
        requestSizes: [] // 请求大小分布
      },
      
      // 数据库连接池状态
      databasePool: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        connectionErrors: 0
      },
      
      // 缓存统计
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: 0,
        evictions: 0
      },
      
      // 自定义业务指标
      businessMetrics: new Map(), // key -> { value, type, labels }
      
      // 资源限制
      resourceLimits: {
        maxMemory: process.memoryUsage().heapTotal,
        maxEventLoopDelay: 100, // ms
        maxQueueDepth: 100,
        maxCpuUsage: 90 // percent
      }
    };
    
    this.samplingInterval = 5000; // 5秒采样一次
    this.maxSamples = 720; // 保留1小时数据
    
    // 性能观察器配置
    this.performanceObservers = [];
    
    // 启动监控
    this.startAdvancedMonitoring();
  }
  
  /**
   * 启动高级监控
   */
  startAdvancedMonitoring() {
    // 设置事件循环延迟监控
    this.setupEventLoopMonitoring();
    
    // 设置垃圾回收监控
    this.setupGCMonitoring();
    
    // 设置HTTP请求监控
    this.setupHttpMonitoring();
    
    // 定期采样
    this.samplingTimer = setInterval(() => {
      this.sampleAdvancedMetrics();
    }, this.samplingInterval);
    
    logger.info('高级性能监控已启动');
  }
  
  /**
   * 停止监控
   */
  stopAdvancedMonitoring() {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }
    
    // 停止所有性能观察器
    this.performanceObservers.forEach(observer => observer.disconnect());
    this.performanceObservers = [];
    
    logger.info('高级性能监控已停止');
  }
  
  /**
   * 设置事件循环延迟监控
   */
  setupEventLoopMonitoring() {
    let lastCheck = Date.now();
    
    const checkEventLoop = () => {
      const now = Date.now();
      const delay = now - lastCheck - 1000; // 应该正好是1000ms
      lastCheck = now;
      
      this.recordEventLoopDelay(delay);
      
      // 如果延迟过高，记录警告
      if (delay > 50) {
        logger.warn(`高事件循环延迟: ${delay}ms`, {
          delay,
          timestamp: new Date().toISOString(),
          memoryUsage: process.memoryUsage()
        });
      }
    };
    
    // 每秒检查一次事件循环延迟
    this.eventLoopTimer = setInterval(checkEventLoop, 1000);
  }
  
  /**
   * 设置垃圾回收监控
   */
  setupGCMonitoring() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.recordGarbageCollection(entry);
        });
      });
      
      observer.observe({ entryTypes: ['gc'], buffered: true });
      this.performanceObservers.push(observer);
    } catch (error) {
      logger.warn('垃圾回收监控不可用:', error.message);
    }
  }
  
  /**
   * 设置HTTP请求监控
   */
  setupHttpMonitoring() {
    // 这将在中间件中实现
  }
  
  /**
   * 采样高级指标
   */
  sampleAdvancedMetrics() {
    const timestamp = Date.now();
    
    // 采样内存详细信息
    const memoryDetails = v8.getHeapStatistics();
    
    // 采样进程信息
    const processInfo = {
      timestamp,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      heap: memoryDetails,
      cpuUsage: process.cpuUsage(),
      activeHandles: process._getActiveHandles ? process._getActiveHandles().length : 0,
      activeRequests: process._getActiveRequests ? process._getActiveRequests().length : 0
    };
    
    // 添加到指标历史
    this.addToHistory('processInfo', processInfo);
    
    // 计算缓存命中率
    this.calculateCacheHitRate();
    
    // 检查资源限制
    this.checkResourceLimits();
  }
  
  /**
   * 记录事件循环延迟
   */
  recordEventLoopDelay(delay) {
    const metrics = this.advancedMetrics.eventLoopDelay;
    
    metrics.current = delay;
    metrics.max = Math.max(metrics.max, delay);
    metrics.samples.push({
      timestamp: Date.now(),
      delay
    });
    
    // 计算平均值
    const recentSamples = metrics.samples.slice(-100); // 最近100个样本
    const sum = recentSamples.reduce((acc, sample) => acc + sample.delay, 0);
    metrics.avg = recentSamples.length > 0 ? sum / recentSamples.length : 0;
    
    // 限制样本数量
    if (metrics.samples.length > this.maxSamples) {
      metrics.samples.splice(0, metrics.samples.length - this.maxSamples);
    }
    
    // 构建直方图
    if (metrics.samples.length % 60 === 0) { // 每60个样本构建一次直方图
      this.buildEventLoopHistogram(metrics.samples);
    }
  }
  
  /**
   * 构建事件循环延迟直方图
   */
  buildEventLoopHistogram(samples) {
    const histogram = {
      timestamp: Date.now(),
      bins: {
        '0-10ms': 0,
        '10-50ms': 0,
        '50-100ms': 0,
        '100-200ms': 0,
        '200+ms': 0
      }
    };
    
    samples.forEach(sample => {
      if (sample.delay <= 10) histogram.bins['0-10ms']++;
      else if (sample.delay <= 50) histogram.bins['10-50ms']++;
      else if (sample.delay <= 100) histogram.bins['50-100ms']++;
      else if (sample.delay <= 200) histogram.bins['100-200ms']++;
      else histogram.bins['200+ms']++;
    });
    
    this.advancedMetrics.eventLoopDelay.histograms.push(histogram);
    
    // 限制直方图数量
    if (this.advancedMetrics.eventLoopDelay.histograms.length > 24) {
      this.advancedMetrics.eventLoopDelay.histograms.splice(0, 1);
    }
  }
  
  /**
   * 记录垃圾回收事件
   */
  recordGarbageCollection(gcEntry) {
    const metrics = this.advancedMetrics.gcStats;
    const gcType = gcEntry.name || 'unknown';
    
    metrics.totalCount++;
    metrics.totalTime += gcEntry.duration;
    metrics.lastGcTime = Date.now();
    
    // 按类型统计
    if (!metrics.byType.has(gcType)) {
      metrics.byType.set(gcType, { count: 0, totalTime: 0 });
    }
    
    const typeStats = metrics.byType.get(gcType);
    typeStats.count++;
    typeStats.totalTime += gcEntry.duration;
    
    // 如果GC时间过长，记录警告
    if (gcEntry.duration > 100) {
      logger.warn(`长时间垃圾回收: ${gcType} 耗时 ${gcEntry.duration}ms`, {
        gcType,
        duration: gcEntry.duration,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 记录HTTP请求详情
   */
  recordHttpRequestDetails(req, res, duration, responseSize) {
    const metrics = this.advancedMetrics.httpRequests;
    const statusCode = res.statusCode;
    const contentType = res.get('Content-Type') || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const requestSize = req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0;
    
    // 按状态码统计
    if (!metrics.byStatusCode.has(statusCode)) {
      metrics.byStatusCode.set(statusCode, 0);
    }
    metrics.byStatusCode.set(statusCode, metrics.byStatusCode.get(statusCode) + 1);
    
    // 按内容类型统计
    if (!metrics.byContentType.has(contentType)) {
      metrics.byContentType.set(contentType, 0);
    }
    metrics.byContentType.set(contentType, metrics.byContentType.get(contentType) + 1);
    
    // 按User-Agent统计（限制数量）
    const simplifiedUA = this.simplifyUserAgent(userAgent);
    if (!metrics.byUserAgent.has(simplifiedUA)) {
      metrics.byUserAgent.set(simplifiedUA, 0);
    }
    metrics.byUserAgent.set(simplifiedUA, metrics.byUserAgent.get(simplifiedUA) + 1);
    
    // 记录响应大小
    if (responseSize > 0) {
      metrics.responseSizes.push({
        timestamp: Date.now(),
        size: responseSize,
        path: req.path,
        method: req.method
      });
    }
    
    // 记录请求大小
    if (requestSize > 0) {
      metrics.requestSizes.push({
        timestamp: Date.now(),
        size: requestSize,
        path: req.path,
        method: req.method
      });
    }
    
    // 限制数据量
    if (metrics.responseSizes.length > 1000) {
      metrics.responseSizes.splice(0, 500);
    }
    if (metrics.requestSizes.length > 1000) {
      metrics.requestSizes.splice(0, 500);
    }
  }
  
  /**
   * 简化User-Agent
   */
  simplifyUserAgent(userAgent) {
    if (!userAgent) return 'unknown';
    
    // 常见的浏览器和机器人
    const patterns = [
      { pattern: /Chrome\/(\d+)/, name: 'Chrome' },
      { pattern: /Firefox\/(\d+)/, name: 'Firefox' },
      { pattern: /Safari\/(\d+)/, name: 'Safari' },
      { pattern: /Edge\/(\d+)/, name: 'Edge' },
      { pattern: /curl\/(\d+)/, name: 'curl' },
      { pattern: /PostmanRuntime\/(\d+)/, name: 'Postman' },
      { pattern: /Googlebot/, name: 'GoogleBot' },
      { pattern: /Bingbot/, name: 'BingBot' },
      { pattern: /Slackbot/, name: 'SlackBot' }
    ];
    
    for (const { pattern, name } of patterns) {
      if (pattern.test(userAgent)) {
        return name;
      }
    }
    
    return 'other';
  }
  
  /**
   * 更新数据库连接池状态
   */
  updateDatabasePoolStatus(status) {
    this.advancedMetrics.databasePool = {
      ...this.advancedMetrics.databasePool,
      ...status
    };
    
    // 如果等待客户端过多，记录警告
    if (status.waitingClients > 10) {
      logger.warn(`数据库连接池压力: ${status.waitingClients}个客户端等待`, {
        ...status,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 更新缓存统计
   */
  updateCacheStats(stats) {
    this.advancedMetrics.cacheStats = {
      ...this.advancedMetrics.cacheStats,
      ...stats
    };
  }
  
  /**
   * 计算缓存命中率
   */
  calculateCacheHitRate() {
    const stats = this.advancedMetrics.cacheStats;
    const total = stats.hits + stats.misses;
    
    if (total > 0) {
      stats.hitRate = (stats.hits / total) * 100;
    }
    
    return stats.hitRate;
  }
  
  /**
   * 记录自定义业务指标
   */
  recordBusinessMetric(key, value, labels = {}) {
    if (!this.advancedMetrics.businessMetrics.has(key)) {
      this.advancedMetrics.businessMetrics.set(key, {
        values: [],
        labels,
        type: typeof value
      });
    }
    
    const metric = this.advancedMetrics.businessMetrics.get(key);
    metric.values.push({
      timestamp: Date.now(),
      value
    });
    
    // 限制样本数量
    if (metric.values.length > 1000) {
      metric.values.splice(0, 500);
    }
  }
  
  /**
   * 增加请求队列深度
   */
  incrementRequestQueue() {
    const metrics = this.advancedMetrics.requestQueueDepth;
    metrics.current++;
    metrics.max = Math.max(metrics.max, metrics.current);
    metrics.totalRequests++;
  }
  
  /**
   * 减少请求队列深度
   */
  decrementRequestQueue() {
    const metrics = this.advancedMetrics.requestQueueDepth;
    if (metrics.current > 0) {
      metrics.current--;
    }
    
    // 记录样本
    metrics.samples.push({
      timestamp: Date.now(),
      depth: metrics.current
    });
    
    // 计算平均值
    const recentSamples = metrics.samples.slice(-100);
    const sum = recentSamples.reduce((acc, sample) => acc + sample.depth, 0);
    metrics.avg = recentSamples.length > 0 ? sum / recentSamples.length : 0;
    
    // 限制样本数量
    if (metrics.samples.length > this.maxSamples) {
      metrics.samples.splice(0, metrics.samples.length - this.maxSamples);
    }
  }
  
  /**
   * 检查资源限制
   */
  checkResourceLimits() {
    const limits = this.advancedMetrics.resourceLimits;
    const alerts = [];
    
    // 检查内存
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (memoryPercent > 90) {
      alerts.push({
        level: 'critical',
        type: 'memory',
        message: `内存使用率过高: ${memoryPercent.toFixed(2)}%`,
        value: memoryPercent
      });
    } else if (memoryPercent > 80) {
      alerts.push({
        level: 'warning',
        type: 'memory',
        message: `内存使用率较高: ${memoryPercent.toFixed(2)}%`,
        value: memoryPercent
      });
    }
    
    // 检查事件循环延迟
    const currentDelay = this.advancedMetrics.eventLoopDelay.current;
    if (currentDelay > limits.maxEventLoopDelay) {
      alerts.push({
        level: 'critical',
        type: 'eventLoop',
        message: `事件循环延迟过高: ${currentDelay}ms`,
        value: currentDelay
      });
    }
    
    // 检查请求队列深度
    const currentDepth = this.advancedMetrics.requestQueueDepth.current;
    if (currentDepth > limits.maxQueueDepth) {
      alerts.push({
        level: 'critical',
        type: 'queue',
        message: `请求队列深度过高: ${currentDepth}`,
        value: currentDepth
      });
    }
    
    // 如果有告警，记录下来
    if (alerts.length > 0) {
      logger.warn('资源限制告警', { alerts });
    }
    
    return alerts;
  }
  
  /**
   * 添加到历史记录
   */
  addToHistory(key, data) {
    // 这里可以存储到数据库或文件系统
    // 目前只保留在内存中
  }
  
  /**
   * 获取高级性能报告
   */
  getAdvancedReport() {
    const baseReport = this.baseMetrics.getReport();
    
    // 转换高级指标为可序列化格式
    const advancedReport = {
      timestamp: Date.now(),
      
      requestQueue: {
        current: this.advancedMetrics.requestQueueDepth.current,
        max: this.advancedMetrics.requestQueueDepth.max,
        avg: this.advancedMetrics.requestQueueDepth.avg,
        totalRequests: this.advancedMetrics.requestQueueDepth.totalRequests
      },
      
      eventLoop: {
        currentDelay: this.advancedMetrics.eventLoopDelay.current,
        maxDelay: this.advancedMetrics.eventLoopDelay.max,
        avgDelay: this.advancedMetrics.eventLoopDelay.avg,
        histograms: this.advancedMetrics.eventLoopDelay.histograms.slice(-5) // 最近5个直方图
      },
      
      garbageCollection: {
        totalCount: this.advancedMetrics.gcStats.totalCount,
        totalTime: this.advancedMetrics.gcStats.totalTime,
        avgTime: this.advancedMetrics.gcStats.totalCount > 0 
          ? this.advancedMetrics.gcStats.totalTime / this.advancedMetrics.gcStats.totalCount 
          : 0,
        byType: Object.fromEntries(this.advancedMetrics.gcStats.byType),
        lastGcTime: this.advancedMetrics.gcStats.lastGcTime
      },
      
      httpDetails: {
        byStatusCode: Object.fromEntries(this.advancedMetrics.httpRequests.byStatusCode),
        byContentType: Object.fromEntries(this.advancedMetrics.httpRequests.byContentType),
        byUserAgent: Object.fromEntries(
          Array.from(this.advancedMetrics.httpRequests.byUserAgent.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Top 10 User-Agents
        ),
        avgResponseSize: this.calculateAverage(this.advancedMetrics.httpRequests.responseSizes, 'size'),
        avgRequestSize: this.calculateAverage(this.advancedMetrics.httpRequests.requestSizes, 'size')
      },
      
      databasePool: this.advancedMetrics.databasePool,
      
      cache: this.advancedMetrics.cacheStats,
      
      businessMetrics: Object.fromEntries(
        Array.from(this.advancedMetrics.businessMetrics.entries()).map(([key, metric]) => [
          key,
          {
            current: metric.values.length > 0 ? metric.values[metric.values.length - 1].value : null,
            avg: this.calculateAverage(metric.values, 'value'),
            count: metric.values.length,
            labels: metric.labels
          }
        ])
      ),
      
      resourceAlerts: this.checkResourceLimits()
    };
    
    return {
      ...baseReport,
      advanced: advancedReport
    };
  }
  
  /**
   * 计算平均值
   */
  calculateAverage(array, field) {
    if (!array || array.length === 0) return 0;
    
    const sum = array.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / array.length;
  }
  
  /**
   * 获取HTTP监控中间件
   */
  getHttpMiddleware() {
    return (req, res, next) => {
      // 增加请求队列深度
      this.incrementRequestQueue();
      
      const startTime = Date.now();
      let responseSize = 0;
      
      // 拦截响应以获取大小
      const originalWrite = res.write;
      const originalEnd = res.end;
      
      res.write = function(chunk, encoding, callback) {
        if (chunk) {
          responseSize += typeof chunk === 'string' 
            ? Buffer.byteLength(chunk, encoding) 
            : chunk.length;
        }
        return originalWrite.call(this, chunk, encoding, callback);
      };
      
      res.end = function(chunk, encoding, callback) {
        if (chunk) {
          responseSize += typeof chunk === 'string' 
            ? Buffer.byteLength(chunk, encoding) 
            : chunk.length;
        }
        return originalEnd.call(this, chunk, encoding, callback);
      };
      
      // 记录响应完成
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // 减少请求队列深度
        this.decrementRequestQueue();
        
        // 记录基础API指标
        this.baseMetrics.recordApiRequest(req.path, req.method, duration, res.statusCode);
        
        // 记录高级HTTP详情
        this.recordHttpRequestDetails(req, res, duration, responseSize);
        
        // 记录自定义业务指标
        this.recordBusinessMetric('http_response_time', duration, {
          path: req.path,
          method: req.method,
          status: res.statusCode
        });
        
        // 记录到基础日志
        logger.request(req, res, duration);
      });
      
      next();
    };
  }
  
  /**
   * 导出指标到Prometheus格式
   */
  exportPrometheusMetrics() {
    const metrics = [];
    
    // 基础系统指标
    metrics.push(`# HELP node_memory_usage_bytes Memory usage in bytes`);
    metrics.push(`# TYPE node_memory_usage_bytes gauge`);
    const memoryUsage = process.memoryUsage();
    metrics.push(`node_memory_usage_bytes{type="rss"} ${memoryUsage.rss}`);
    metrics.push(`node_memory_usage_bytes{type="heapTotal"} ${memoryUsage.heapTotal}`);
    metrics.push(`node_memory_usage_bytes{type="heapUsed"} ${memoryUsage.heapUsed}`);
    metrics.push(`node_memory_usage_bytes{type="external"} ${memoryUsage.external}`);
    
    // 事件循环延迟
    metrics.push(`# HELP node_eventloop_delay_ms Event loop delay in milliseconds`);
    metrics.push(`# TYPE node_eventloop_delay_ms gauge`);
    metrics.push(`node_eventloop_delay_ms ${this.advancedMetrics.eventLoopDelay.current}`);
    
    // 请求队列深度
    metrics.push(`# HELP node_request_queue_depth Current request queue depth`);
    metrics.push(`# TYPE node_request_queue_depth gauge`);
    metrics.push(`node_request_queue_depth ${this.advancedMetrics.requestQueueDepth.current}`);
    
    // HTTP请求统计
    metrics.push(`# HELP http_requests_total Total number of HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    
    for (const [status, count] of this.advancedMetrics.httpRequests.byStatusCode) {
      metrics.push(`http_requests_total{status="${status}"} ${count}`);
    }
    
    // 缓存命中率
    metrics.push(`# HELP cache_hit_rate Cache hit rate percentage`);
    metrics.push(`# TYPE cache_hit_rate gauge`);
    metrics.push(`cache_hit_rate ${this.advancedMetrics.cacheStats.hitRate}`);
    
    return metrics.join('\n');
  }
}

// 创建单例实例
const advancedPerformanceMonitor = new AdvancedPerformanceMonitor();

module.exports = {
  AdvancedPerformanceMonitor,
  advancedPerformanceMonitor,
  getHttpMiddleware: () => advancedPerformanceMonitor.getHttpMiddleware(),
  getAdvancedReport: () => advancedPerformanceMonitor.getAdvancedReport(),
  recordBusinessMetric: (...args) => advancedPerformanceMonitor.recordBusinessMetric(...args),
  updateDatabasePoolStatus: (...args) => advancedPerformanceMonitor.updateDatabasePoolStatus(...args),
  updateCacheStats: (...args) => advancedPerformanceMonitor.updateCacheStats(...args),
  exportPrometheusMetrics: () => advancedPerformanceMonitor.exportPrometheusMetrics(),
  stopAdvancedMonitoring: () => advancedPerformanceMonitor.stopAdvancedMonitoring()
};
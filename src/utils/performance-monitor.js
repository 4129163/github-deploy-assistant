/**
 * 性能监控模块
 * 监控系统性能、API响应时间、资源使用情况等
 */

const os = require('os');
const { logger } = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiRequests: new Map(), // path -> { count, totalTime, avgTime, errors }
      databaseQueries: new Map(), // operation -> { count, totalTime, avgTime }
      externalCalls: new Map(), // service -> { count, totalTime, avgTime, errors }
      memoryUsage: [],
      cpuUsage: [],
      startTime: Date.now()
    };

    this.samplingInterval = 60000; // 1分钟采样一次
    this.maxSamples = 1440; // 保留24小时数据（1440个样本）
    
    // 启动监控
    this.startMonitoring();
  }

  /**
   * 开始性能监控
   */
  startMonitoring() {
    // 定期采样系统指标
    this.samplingTimer = setInterval(() => {
      this.sampleSystemMetrics();
    }, this.samplingInterval);

    // 首次采样
    this.sampleSystemMetrics();
  }

  /**
   * 停止性能监控
   */
  stopMonitoring() {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }
  }

  /**
   * 采样系统指标
   */
  sampleSystemMetrics() {
    const timestamp = Date.now();
    
    // 内存使用情况
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    // CPU使用情况
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idlePercent = (totalIdle / totalTick) * 100;
    const cpuUsagePercent = 100 - idlePercent;

    // 添加内存指标
    this.metrics.memoryUsage.push({
      timestamp,
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: memoryUsagePercent
    });

    // 添加CPU指标
    this.metrics.cpuUsage.push({
      timestamp,
      percent: cpuUsagePercent,
      cpus: cpus.length
    });

    // 限制样本数量
    if (this.metrics.memoryUsage.length > this.maxSamples) {
      this.metrics.memoryUsage.splice(0, this.metrics.memoryUsage.length - this.maxSamples);
    }
    if (this.metrics.cpuUsage.length > this.maxSamples) {
      this.metrics.cpuUsage.splice(0, this.metrics.cpuUsage.length - this.maxSamples);
    }

    // 如果内存或CPU使用率过高，记录警告
    if (memoryUsagePercent > 80) {
      logger.warn(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`, {
        memory: {
          total: this.formatBytes(totalMem),
          used: this.formatBytes(usedMem),
          free: this.formatBytes(freeMem),
          percent: memoryUsagePercent
        }
      });
    }

    if (cpuUsagePercent > 85) {
      logger.warn(`High CPU usage: ${cpuUsagePercent.toFixed(2)}%`, {
        cpu: {
          percent: cpuUsagePercent,
          cores: cpus.length
        }
      });
    }
  }

  /**
   * 记录API请求性能
   */
  recordApiRequest(path, method, duration, statusCode) {
    const key = `${method}:${path}`;
    
    if (!this.metrics.apiRequests.has(key)) {
      this.metrics.apiRequests.set(key, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastUpdated: Date.now()
      });
    }

    const stats = this.metrics.apiRequests.get(key);
    stats.count++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.avgTime = stats.totalTime / stats.count;
    stats.lastUpdated = Date.now();

    if (statusCode >= 400) {
      stats.errors++;
    }

    // 如果响应时间过长，记录警告
    if (duration > 1000) {
      logger.warn(`Slow API response: ${method} ${path} took ${duration}ms`, {
        path,
        method,
        duration,
        statusCode
      });
    }

    // 定期清理旧数据（超过24小时）
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [reqKey, reqStats] of this.metrics.apiRequests) {
      if (reqStats.lastUpdated < cutoff) {
        this.metrics.apiRequests.delete(reqKey);
      }
    }
  }

  /**
   * 记录数据库查询性能
   */
  recordDatabaseQuery(operation, duration, success = true) {
    if (!this.metrics.databaseQueries.has(operation)) {
      this.metrics.databaseQueries.set(operation, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastUpdated: Date.now()
      });
    }

    const stats = this.metrics.databaseQueries.get(operation);
    stats.count++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.avgTime = stats.totalTime / stats.count;
    stats.lastUpdated = Date.now();

    if (!success) {
      stats.errors++;
    }

    // 如果查询时间过长，记录警告
    if (duration > 500) {
      logger.warn(`Slow database query: ${operation} took ${duration}ms`, {
        operation,
        duration
      });
    }
  }

  /**
   * 记录外部调用性能
   */
  recordExternalCall(service, duration, success = true) {
    if (!this.metrics.externalCalls.has(service)) {
      this.metrics.externalCalls.set(service, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastUpdated: Date.now()
      });
    }

    const stats = this.metrics.externalCalls.get(service);
    stats.count++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.avgTime = stats.totalTime / stats.count;
    stats.lastUpdated = Date.now();

    if (!success) {
      stats.errors++;
    }

    // 如果调用时间过长，记录警告
    if (duration > 2000) {
      logger.warn(`Slow external call: ${service} took ${duration}ms`, {
        service,
        duration
      });
    }
  }

  /**
   * 获取性能报告
   */
  getReport() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    // 当前系统状态
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;

    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idlePercent = (totalIdle / totalTick) * 100;
    const cpuUsagePercent = 100 - idlePercent;

    // 转换API请求统计
    const apiStats = {};
    for (const [key, stats] of this.metrics.apiRequests) {
      apiStats[key] = {
        ...stats,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      };
    }

    // 转换数据库查询统计
    const dbStats = {};
    for (const [operation, stats] of this.metrics.databaseQueries) {
      dbStats[operation] = {
        ...stats,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      };
    }

    // 转换外部调用统计
    const externalStats = {};
    for (const [service, stats] of this.metrics.externalCalls) {
      externalStats[service] = {
        ...stats,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      };
    }

    // 计算历史趋势
    const memoryTrend = this.calculateTrend(this.metrics.memoryUsage, 'percent');
    const cpuTrend = this.calculateTrend(this.metrics.cpuUsage, 'percent');

    return {
      timestamp: now,
      uptime: this.formatDuration(uptime),
      
      system: {
        memory: {
          total: this.formatBytes(totalMem),
          used: this.formatBytes(usedMem),
          free: this.formatBytes(freeMem),
          percent: memoryUsagePercent.toFixed(2),
          trend: memoryTrend
        },
        cpu: {
          percent: cpuUsagePercent.toFixed(2),
          cores: cpus.length,
          trend: cpuTrend
        },
        loadavg: os.loadavg(),
        platform: os.platform(),
        arch: os.arch()
      },

      api: apiStats,
      database: dbStats,
      external: externalStats,

      alerts: this.getAlerts()
    };
  }

  /**
   * 计算趋势
   */
  calculateTrend(data, field) {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(-10); // 最近10个样本
    if (recent.length < 2) return 'stable';

    const first = recent[0][field];
    const last = recent[recent.length - 1][field];
    const change = last - first;

    if (Math.abs(change) < 0.1) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * 获取告警信息
   */
  getAlerts() {
    const alerts = [];

    // 检查内存使用率
    const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    if (currentMemory && currentMemory.percent > 80) {
      alerts.push({
        level: currentMemory.percent > 90 ? 'critical' : 'warning',
        type: 'memory',
        message: `High memory usage: ${currentMemory.percent.toFixed(2)}%`,
        value: currentMemory.percent
      });
    }

    // 检查CPU使用率
    const currentCpu = this.metrics.cpuUsage[this.metrics.cpuUsage.length - 1];
    if (currentCpu && currentCpu.percent > 85) {
      alerts.push({
        level: currentCpu.percent > 95 ? 'critical' : 'warning',
        type: 'cpu',
        message: `High CPU usage: ${currentCpu.percent.toFixed(2)}%`,
        value: currentCpu.percent
      });
    }

    // 检查慢API
    for (const [key, stats] of this.metrics.apiRequests) {
      if (stats.avgTime > 500) {
        alerts.push({
          level: stats.avgTime > 2000 ? 'critical' : 'warning',
          type: 'slow-api',
          message: `Slow API: ${key} (avg: ${stats.avgTime.toFixed(2)}ms)`,
          value: stats.avgTime
        });
      }
    }

    return alerts;
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 格式化持续时间
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * 获取API请求中间件
   */
  getMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 记录响应完成时间
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordApiRequest(req.path, req.method, duration, res.statusCode);
        logger.request(req, res, duration);
      });

      next();
    };
  }
}

// 创建单例实例
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor,
  getMiddleware: () => performanceMonitor.getMiddleware(),
  recordApiRequest: (...args) => performanceMonitor.recordApiRequest(...args),
  recordDatabaseQuery: (...args) => performanceMonitor.recordDatabaseQuery(...args),
  recordExternalCall: (...args) => performanceMonitor.recordExternalCall(...args),
  getReport: () => performanceMonitor.getReport(),
  stopMonitoring: () => performanceMonitor.stopMonitoring()
};
/**
 * 增强版日志轮转器
 * 支持多种轮转策略：按时间、按大小、按数量
 * 支持压缩、加密、归档功能
 */

const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');

const { logger } = require('./logger');
const { 
  MAX_LOG_SIZE_MB, 
  MAX_LOG_DAYS, 
  MAX_TOTAL_LOG_MB,
  AUDIT_LOG_RETENTION_DAYS,
  AUDIT_LOG_MAX_SIZE_MB,
  AUDIT_LOG_COMPRESSION,
  AUDIT_LOG_ENCRYPTION
} = require('../config');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// 轮转策略定义
const ROTATION_STRATEGIES = {
  TIME_BASED: 'time',      // 按时间轮转（天/小时）
  SIZE_BASED: 'size',      // 按大小轮转
  COUNT_BASED: 'count',    // 按数量轮转
  HYBRID: 'hybrid'         // 混合策略
};

// 压缩算法
const COMPRESSION_ALGORITHMS = {
  GZIP: 'gzip',
  DEFLATE: 'deflate',
  BROTLI: 'brotli'
};

/**
 * 增强版日志轮转器类
 */
class EnhancedLogRotator {
  constructor(options = {}) {
    this.options = {
      // 基础配置
      logDir: options.logDir || path.join(__dirname, '../logs'),
      auditLogDir: options.auditLogDir || path.join(__dirname, '../logs/audit'),
      
      // 轮转策略
      rotationStrategy: options.rotationStrategy || ROTATION_STRATEGIES.HYBRID,
      rotationTime: options.rotationTime || 'daily', // daily, hourly, weekly
      rotationSize: options.rotationSize || MAX_LOG_SIZE_MB * 1024 * 1024,
      rotationCount: options.rotationCount || 10,
      
      // 保留策略
      retentionDays: options.retentionDays || MAX_LOG_DAYS,
      retentionCount: options.retentionCount || 100,
      maxTotalSize: options.maxTotalSize || MAX_TOTAL_LOG_MB * 1024 * 1024,
      
      // 审计日志配置
      auditRetentionDays: options.auditRetentionDays || AUDIT_LOG_RETENTION_DAYS,
      auditMaxSize: options.auditMaxSize || AUDIT_LOG_MAX_SIZE_MB * 1024 * 1024,
      
      // 高级功能
      enableCompression: options.enableCompression || AUDIT_LOG_COMPRESSION,
      enableEncryption: options.enableEncryption || AUDIT_LOG_ENCRYPTION,
      encryptionKey: options.encryptionKey || process.env.LOG_ENCRYPTION_KEY,
      
      // 性能配置
      checkInterval: options.checkInterval || 60 * 60 * 1000, // 1小时
      batchSize: options.batchSize || 100
    };
    
    this.lastRotationCheck = Date.now();
    this.rotationStats = {
      totalRotations: 0,
      totalCompressions: 0,
      totalEncryptions: 0,
      totalCleanups: 0,
      spaceFreed: 0
    };
  }
  
  /**
   * 初始化轮转器
   */
  async initialize() {
    try {
      // 确保目录存在
      await fs.ensureDir(this.options.logDir);
      await fs.ensureDir(this.options.auditLogDir);
      
      // 创建必要的子目录
      await fs.ensureDir(path.join(this.options.logDir, 'compressed'));
      await fs.ensureDir(path.join(this.options.logDir, 'archived'));
      await fs.ensureDir(path.join(this.options.auditLogDir, 'compressed'));
      await fs.ensureDir(path.join(this.options.auditLogDir, 'archived'));
      
      logger.info('Enhanced log rotator initialized', {
        logDir: this.options.logDir,
        auditLogDir: this.options.auditLogDir,
        strategy: this.options.rotationStrategy
      });
      
      // 立即执行一次轮转检查
      await this.checkAndRotate();
      
      // 设置定期检查
      setInterval(() => this.checkAndRotate(), this.options.checkInterval);
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize enhanced log rotator:', error);
      return false;
    }
  }
  
  /**
   * 检查并执行轮转
   */
  async checkAndRotate() {
    const now = Date.now();
    
    // 检查是否到了检查时间
    if (now - this.lastRotationCheck < this.options.checkInterval) {
      return;
    }
    
    this.lastRotationCheck = now;
    
    try {
      logger.debug('Starting log rotation check');
      
      // 检查并轮转普通日志
      await this.rotateLogFiles(this.options.logDir, false);
      
      // 检查并轮转审计日志
      await this.rotateLogFiles(this.options.auditLogDir, true);
      
      // 清理旧文件
      await this.cleanupOldFiles();
      
      // 压缩文件（如果启用）
      if (this.options.enableCompression) {
        await this.compressOldFiles();
      }
      
      // 归档文件
      await this.archiveVeryOldFiles();
      
      logger.info('Log rotation completed', {
        rotations: this.rotationStats.totalRotations,
        cleanups: this.rotationStats.totalCleanups,
        spaceFreed: this.formatBytes(this.rotationStats.spaceFreed)
      });
      
    } catch (error) {
      logger.error('Log rotation check failed:', error);
    }
  }
  
  /**
   * 轮转日志文件
   */
  async rotateLogFiles(logDir, isAuditLog = false) {
    try {
      const files = await this.getLogFiles(logDir, isAuditLog);
      
      for (const file of files) {
        const needsRotation = await this.needsRotation(file, isAuditLog);
        
        if (needsRotation) {
          await this.performRotation(file, isAuditLog);
          this.rotationStats.totalRotations++;
        }
      }
    } catch (error) {
      logger.error(`Failed to rotate log files in ${logDir}:`, error);
    }
  }
  
  /**
   * 获取日志文件列表
   */
  async getLogFiles(logDir, isAuditLog = false) {
    try {
      const files = await fs.readdir(logDir);
      const logFiles = [];
      
      for (const file of files) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        
        // 跳过目录和非日志文件
        if (stats.isDirectory()) continue;
        if (!this.isLogFile(file, isAuditLog)) continue;
        
        logFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtimeMs,
          ctime: stats.ctimeMs
        });
      }
      
      // 按修改时间排序（最旧的在前面）
      return logFiles.sort((a, b) => a.mtime - b.mtime);
    } catch (error) {
      logger.error(`Failed to get log files from ${logDir}:`, error);
      return [];
    }
  }
  
  /**
   * 检查文件是否需要轮转
   */
  async needsRotation(fileInfo, isAuditLog = false) {
    const { size, mtime, name } = fileInfo;
    const now = Date.now();
    
    // 按大小检查
    const maxSize = isAuditLog ? this.options.auditMaxSize : this.options.rotationSize;
    if (size >= maxSize) {
      logger.debug(`File ${name} needs rotation due to size (${this.formatBytes(size)} >= ${this.formatBytes(maxSize)})`);
      return true;
    }
    
    // 按时间检查（仅对当前日志文件）
    if (this.isCurrentLogFile(name, isAuditLog)) {
      const fileDate = this.extractDateFromFilename(name);
      if (fileDate) {
        const fileTime = fileDate.getTime();
        const rotationInterval = this.getRotationIntervalMs();
        
        if (now - fileTime >= rotationInterval) {
          logger.debug(`Current log file ${name} needs rotation due to time`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * 执行轮转操作
   */
  async performRotation(fileInfo, isAuditLog = false) {
    const { path: filePath, name } = fileInfo;
    
    try {
      logger.info(`Rotating log file: ${name}`);
      
      // 生成轮转后的文件名
      const rotatedName = this.generateRotatedFilename(name);
      const rotatedPath = path.join(path.dirname(filePath), rotatedName);
      
      // 如果文件已存在，先删除
      if (await fs.pathExists(rotatedPath)) {
        await fs.unlink(rotatedPath);
      }
      
      // 重命名文件
      await fs.move(filePath, rotatedPath);
      
      // 如果是当前日志文件，创建一个新的空文件
      if (this.isCurrentLogFile(name, isAuditLog)) {
        await fs.writeFile(filePath, '', 'utf8');
      }
      
      logger.debug(`Log file rotated: ${name} -> ${rotatedName}`);
      
    } catch (error) {
      logger.error(`Failed to rotate file ${name}:`, error);
    }
  }
  
  /**
   * 清理旧文件
   */
  async cleanupOldFiles() {
    try {
      // 清理普通日志
      await this.cleanupDirectory(this.options.logDir, this.options.retentionDays, this.options.maxTotalSize);
      
      // 清理审计日志
      await this.cleanupDirectory(this.options.auditLogDir, this.options.auditRetentionDays, this.options.auditMaxSize * 5); // 审计日志保留更多空间
      
    } catch (error) {
      logger.error('Failed to cleanup old files:', error);
    }
  }
  
  /**
   * 清理目录中的旧文件
   */
  async cleanupDirectory(dirPath, retentionDays, maxTotalSize) {
    try {
      const files = await this.getLogFiles(dirPath, dirPath.includes('audit'));
      const now = Date.now();
      const cutoffTime = now - (retentionDays * 24 * 60 * 60 * 1000);
      
      let totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const maxSize = maxTotalSize;
      
      // 按时间删除
      for (const file of files) {
        if (file.mtime < cutoffTime) {
          const freed = await this.safeDeleteFile(file.path);
          if (freed > 0) {
            totalSize -= freed;
            this.rotationStats.spaceFreed += freed;
            this.rotationStats.totalCleanups++;
          }
        }
      }
      
      // 按大小删除（如果总大小超过限制）
      if (totalSize > maxSize) {
        for (const file of files) {
          if (totalSize <= maxSize) break;
          
          // 跳过当前日志文件
          if (this.isCurrentLogFile(file.name, dirPath.includes('audit'))) {
            continue;
          }
          
          const freed = await this.safeDeleteFile(file.path);
          if (freed > 0) {
            totalSize -= freed;
            this.rotationStats.spaceFreed += freed;
            this.rotationStats.totalCleanups++;
          }
        }
      }
      
    } catch (error) {
      logger.error(`Failed to cleanup directory ${dirPath}:`, error);
    }
  }
  
  /**
   * 压缩旧文件
   */
  async compressOldFiles() {
    try {
      const directories = [this.options.logDir, this.options.auditLogDir];
      
      for (const dir of directories) {
        const files = await this.getLogFiles(dir, dir.includes('audit'));
        const compressedDir = path.join(dir, 'compressed');
        
        // 压缩非当前日志文件
        for (const file of files) {
          // 跳过当前日志文件和已压缩文件
          if (this.isCurrentLogFile(file.name, dir.includes('audit')) || 
              file.name.endsWith('.gz') || 
              file.name.endsWith('.zip')) {
            continue;
          }
          
          // 跳过最近的文件（保留未压缩一段时间）
          if (Date.now() - file.mtime < 24 * 60 * 60 * 1000) {
            continue;
          }
          
          await this.compressFile(file, compressedDir);
        }
      }
    } catch (error) {
      logger.error('Failed to compress old files:', error);
    }
  }
  
  /**
   * 压缩单个文件
   */
  async compressFile(fileInfo, targetDir) {
    try {
      await fs.ensureDir(targetDir);
      
      const sourcePath = fileInfo.path;
      const compressedName = `${fileInfo.name}.gz`;
      const compressedPath = path.join(targetDir, compressedName);
      
      // 检查是否已存在压缩文件
      if (await fs.pathExists(compressedPath)) {
        return;
      }
      
      // 读取文件内容
      const content = await fs.readFile(sourcePath);
      
      // 使用gzip压缩
      const compressed = await gzip(content);
      
      // 写入压缩文件
      await fs.writeFile(compressedPath, compressed);
      
      // 删除原始文件（如果压缩成功）
      const originalStats = await fs.stat(sourcePath);
      const compressedStats = await fs.stat(compressedPath);
      
      if (compressedStats.size < originalStats.size) {
        await fs.unlink(sourcePath);
        this.rotationStats.totalCompressions++;
        
        logger.debug(`File compressed: ${fileInfo.name} (${this.formatBytes(originalStats.size)} -> ${this.formatBytes(compressedStats.size)})`);
      } else {
        // 如果压缩后更大，删除压缩文件
        await fs.unlink(compressedPath);
        logger.debug(`Compression not beneficial for: ${fileInfo.name}`);
      }
      
    } catch (error) {
      logger.error(`Failed to compress file ${fileInfo.name}:`, error);
    }
  }
  
  /**
   * 归档非常旧的文件
   */
  async archiveVeryOldFiles() {
    try {
      const cutoffTime = Date.now() - (365 * 24 * 60 * 60 * 1000); // 1年前
      
      const directories = [
        this.options.logDir,
        this.options.auditLogDir,
        path.join(this.options.logDir, 'compressed'),
        path.join(this.options.auditLogDir, 'compressed')
      ];
      
      for (const dir of directories) {
        const files = await this.getLogFiles(dir, dir.includes('audit'));
        const archiveDir = path.join(path.dirname(dir), 'archived');
        
        for (const file of files) {
          if (file.mtime < cutoffTime) {
            await this.archiveFile(file, archiveDir);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to archive old files:', error);
    }
  }
  
  /**
   * 归档文件
   */
  async archiveFile(fileInfo, archiveDir) {
    try {
      await fs.ensureDir(archiveDir);
      
      const archiveName = `${path.basename(fileInfo.name, '.gz')}.archive.gz`;
      const archivePath = path.join(archiveDir, archiveName);
      
      // 检查是否已存在归档文件
      if (await fs.pathExists(archivePath)) {
        return;
      }
      
      // 移动文件到归档目录
      await fs.move(fileInfo.path, archivePath);
      
      logger.debug(`File archived: ${fileInfo.name} -> ${archiveName}`);
      
    } catch (error) {
      logger.error(`Failed to archive file ${fileInfo.name}:`, error);
    }
  }
  
  /**
   * 安全删除文件
   */
  async safeDeleteFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      await fs.unlink(filePath);
      return stats.size;
    } catch (error) {
      logger.warn(`Failed to delete file ${filePath}:`, error.message);
      return 0;
    }
  }
  
  /**
   * 检查是否为日志文件
   */
  isLogFile(filename, isAuditLog = false) {
    if (isAuditLog) {
      return filename.endsWith('.json') || filename.endsWith('.json.gz') || filename.includes('audit');
    } else {
      return filename.endsWith('.log') || filename.endsWith('.log.gz') || filename.includes('error') || filename.includes('access');
    }
  }
  
  /**
   * 检查是否为当前日志文件
   */
  isCurrentLogFile(filename, isAuditLog = false) {
    if (isAuditLog) {
      return filename.startsWith('audit-') && filename.endsWith('.json') && !filename.includes('.rotated.');
    } else {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '-');
      return filename.includes(dateStr) && filename.endsWith('.log');
    }
  }
  
  /**
   * 从文件名中提取日期
   */
  extractDateFromFilename(filename) {
    // 匹配 YYYY-MM-DD 格式
    const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [_, year, month, day] = dateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  }
  
  /**
   * 获取轮转间隔（毫秒）
   */
  getRotationIntervalMs() {
    switch (this.options.rotationTime) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }
  
  /**
   * 生成轮转后的文件名
   */
  generateRotatedFilename(originalName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(originalName, path.extname(originalName));
    const extension = path.extname(originalName);
    
    // 如果是压缩文件，保持压缩扩展名
    if (originalName.endsWith('.gz')) {
      return `${baseName}.rotated.${timestamp}${extension}`;
    }
    
    return `${baseName}.rotated.${timestamp}${extension}`;
  }
  
  /**
   * 格式化字节大小
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * 获取轮转统计信息
   */
  getStats() {
    return {
      ...this.rotationStats,
      lastCheck: this.lastRotationCheck,
      nextCheck: this.lastRotationCheck + this.options.checkInterval,
      options: {
        rotationStrategy: this.options.rotationStrategy,
        rotationTime: this.options.rotationTime,
        retentionDays: this.options.retentionDays,
        auditRetentionDays: this.options.auditRetentionDays,
        enableCompression: this.options.enableCompression,
        enableEncryption: this.options.enableEncryption
      }
    };
  }
}

/**
 * 创建并初始化轮转器
 */
async function createLogRotator(options = {}) {
  const rotator = new EnhancedLogRotator(options);
  await rotator.initialize();
  return rotator;
}

module.exports = {
  EnhancedLogRotator,
  createLogRotator,
  ROTATION_STRATEGIES,
  COMPRESSION_ALGORITHMS
};
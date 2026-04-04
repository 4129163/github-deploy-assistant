/**
 * 部署前预检服务
 * 协调所有检测器，管理预检流程
 */

const path = require('path');
const fs = require('fs-extra');
const PortDetector = require('./detectors/PortDetector');
const DiskDetector = require('./detectors/DiskDetector');
const DependencyDetector = require('./detectors/DependencyDetector');
const { logger } = require('../utils/logger');

class DeployPrecheck {
  constructor() {
    this.detectors = [
      new PortDetector(),
      new DiskDetector(),
      new DependencyDetector()
    ];
    
    // 按优先级排序
    this.detectors.sort((a, b) => a.priority - b.priority);
    
    this.activeChecks = new Map(); // 存储进行中的检查
    this.resultsCache = new Map(); // 缓存检查结果
    this.cacheTTL = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 执行部署前预检
   * @param {Object} options 预检选项
   * @returns {Promise<Object>} 预检结果
   */
  async runPrecheck(options) {
    const {
      project,
      workspacePath = process.cwd(),
      checkId = `precheck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkItems = ['all'], // 'all' 或指定检测项 ['ports', 'disk', 'dependencies']
      forceRefresh = false
    } = options;

    // 检查缓存
    const cacheKey = this.getCacheKey(project, checkItems);
    if (!forceRefresh && this.resultsCache.has(cacheKey)) {
      const cached = this.resultsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        logger.info(`使用缓存的预检结果: ${cacheKey}`);
        return { ...cached.result, cached: true, checkId };
      }
    }

    logger.info(`开始部署前预检: ${checkId}, 项目: ${project.name || project.id}`);

    const result = {
      checkId,
      projectId: project.id,
      startTime: new Date().toISOString(),
      status: 'running',
      detectors: [],
      issues: [],
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        fixable: 0,
        autoFixable: 0
      }
    };

    // 存储到活动检查
    this.activeChecks.set(checkId, result);

    try {
      const context = {
        project,
        workspacePath,
        checkId
      };

      // 运行所有检测器
      for (const detector of this.detectors) {
        if (!this.shouldRunDetector(detector, checkItems)) {
          continue;
        }

        if (!detector.shouldRun(context)) {
          logger.debug(`跳过检测器: ${detector.name}`);
          continue;
        }

        logger.info(`运行检测器: ${detector.name}`);
        
        const detectorResult = {
          name: detector.name,
          description: detector.description,
          startTime: new Date().toISOString(),
          status: 'running'
        };

        result.detectors.push(detectorResult);

        try {
          const issues = await detector.detect(context);
          
          detectorResult.status = 'completed';
          detectorResult.endTime = new Date().toISOString();
          detectorResult.issuesCount = issues.length;
          detectorResult.issues = issues;
          
          result.issues.push(...issues);
          
          logger.info(`检测器 ${detector.name} 完成，发现 ${issues.length} 个问题`);
        } catch (error) {
          detectorResult.status = 'failed';
          detectorResult.endTime = new Date().toISOString();
          detectorResult.error = error.message;
          
          logger.error(`检测器 ${detector.name} 失败:`, error.message);
          
          // 添加检测器失败的问题
          result.issues.push({
            id: `detector_failed_${detector.name}_${Date.now()}`,
            type: 'detector_failed',
            detector: detector.name,
            title: `${detector.name} 检测失败`,
            description: `检测器运行失败: ${error.message}`,
            severity: 'low',
            fixable: false,
            fixType: 'manual',
            fixSteps: [],
            data: { error: error.message },
            detectedAt: new Date().toISOString()
          });
        }
      }

      // 生成摘要统计
      this.generateSummary(result);

      // 更新状态
      result.status = 'completed';
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - new Date(result.startTime).getTime();

      // 缓存结果
      this.resultsCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      logger.info(`预检完成: ${checkId}, 共发现 ${result.summary.totalIssues} 个问题`);

    } catch (error) {
      result.status = 'failed';
      result.endTime = new Date().toISOString();
      result.error = error.message;
      logger.error(`预检失败:`, error);
    } finally {
      // 从活动检查中移除
      setTimeout(() => {
        this.activeChecks.delete(checkId);
      }, 60000); // 1分钟后清理
    }

    return result;
  }

  /**
   * 获取预检结果
   * @param {string} checkId 检查ID
   * @returns {Object|null} 检查结果
   */
  getResult(checkId) {
    // 首先从活动检查中查找
    if (this.activeChecks.has(checkId)) {
      return this.activeChecks.get(checkId);
    }

    // 从缓存中查找
    for (const [cacheKey, cached] of this.resultsCache.entries()) {
      if (cached.result.checkId === checkId) {
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          return cached.result;
        }
        break;
      }
    }

    return null;
  }

  /**
   * 获取预检进度
   * @param {string} checkId 检查ID
   * @returns {Object} 进度信息
   */
  getProgress(checkId) {
    const result = this.activeChecks.get(checkId);
    if (!result) {
      return { status: 'not_found' };
    }

    const completed = result.detectors.filter(d => d.status === 'completed').length;
    const total = result.detectors.length;
    const running = result.detectors.filter(d => d.status === 'running').length;
    const failed = result.detectors.filter(d => d.status === 'failed').length;

    return {
      status: result.status,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
      running,
      failed,
      issuesCount: result.issues.length
    };
  }

  /**
   * 清理缓存
   * @param {number} maxAge 最大缓存时间（毫秒）
   */
  clearCache(maxAge = this.cacheTTL) {
    const now = Date.now();
    let cleared = 0;

    for (const [cacheKey, cached] of this.resultsCache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.resultsCache.delete(cacheKey);
        cleared++;
      }
    }

    logger.info(`清理了 ${cleared} 个过期的缓存项`);
    return cleared;
  }

  /**
   * 获取支持的检测项列表
   * @returns {Array} 检测项列表
   */
  getAvailableCheckItems() {
    return this.detectors.map(detector => ({
      id: detector.name.toLowerCase().replace('detector', '').trim(),
      name: detector.name,
      description: detector.description,
      priority: detector.priority
    }));
  }

  /**
   * 生成缓存键
   * @param {Object} project 项目信息
   * @param {Array} checkItems 检测项
   * @returns {string} 缓存键
   */
  getCacheKey(project, checkItems) {
    const projectKey = project.id || project.name || 'unknown';
    const itemsKey = Array.isArray(checkItems) ? checkItems.sort().join(',') : checkItems;
    return `${projectKey}_${itemsKey}`;
  }

  /**
   * 判断是否应该运行检测器
   * @param {Object} detector 检测器
   * @param {Array|string} checkItems 检测项
   * @returns {boolean}
   */
  shouldRunDetector(detector, checkItems) {
    if (checkItems === 'all' || checkItems.includes('all')) {
      return true;
    }

    const detectorId = detector.name.toLowerCase().replace('detector', '').trim();
    return checkItems.includes(detectorId);
  }

  /**
   * 生成摘要统计
   * @param {Object} result 预检结果
   */
  generateSummary(result) {
    const summary = {
      totalIssues: result.issues.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      fixable: 0,
      autoFixable: 0,
      byDetector: {},
      byType: {}
    };

    for (const issue of result.issues) {
      // 统计严重程度
      summary[issue.severity] = (summary[issue.severity] || 0) + 1;

      // 统计可修复性
      if (issue.fixable) {
        summary.fixable++;
        if (issue.fixType === 'auto') {
          summary.autoFixable++;
        }
      }

      // 按检测器统计
      const detector = issue.detector || 'unknown';
      summary.byDetector[detector] = (summary.byDetector[detector] || 0) + 1;

      // 按问题类型统计
      const type = issue.type || 'unknown';
      summary.byType[type] = (summary.byType[type] || 0) + 1;
    }

    result.summary = summary;

    // 计算总体状态
    if (summary.critical > 0) {
      result.overallStatus = 'critical';
    } else if (summary.high > 0) {
      result.overallStatus = 'warning';
    } else if (summary.medium > 0) {
      result.overallStatus = 'notice';
    } else {
      result.overallStatus = 'healthy';
    }
  }

  /**
   * 导出预检报告
   * @param {Object} result 预检结果
   * @param {string} format 报告格式 ('json', 'markdown', 'html')
   * @returns {Promise<string>} 报告内容
   */
  async exportReport(result, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'markdown':
        return this.generateMarkdownReport(result);

      case 'html':
        return this.generateHtmlReport(result);

      default:
        throw new Error(`不支持的报告格式: ${format}`);
    }
  }

  /**
   * 生成 Markdown 报告
   * @param {Object} result 预检结果
   * @returns {string} Markdown 报告
   */
  generateMarkdownReport(result) {
    let report = `# 部署前预检报告\n\n`;
    
    report += `## 基本信息\n`;
    report += `- **项目**: ${result.projectId}\n`;
    report += `- **检查ID**: ${result.checkId}\n`;
    report += `- **检查时间**: ${result.startTime}\n`;
    report += `- **状态**: ${result.overallStatus}\n\n`;

    report += `## 摘要统计\n`;
    report += `- **总问题数**: ${result.summary.totalIssues}\n`;
    report += `- **严重问题**: ${result.summary.critical}\n`;
    report += `- **高级问题**: ${result.summary.high}\n`;
    report += `- **中级问题**: ${result.summary.medium}\n`;
    report += `- **低级问题**: ${result.summary.low}\n`;
    report += `- **可修复问题**: ${result.summary.fixable}\n`;
    report += `- **自动可修复**: ${result.summary.autoFixable}\n\n`;

    if (result.issues.length > 0) {
      report += `## 问题详情\n\n`;
      
      // 按严重程度分组
      const severityGroups = {
        critical: [],
        high: [],
        medium: [],
        low: [],
        info: []
      };

      result.issues.forEach(issue => {
        severityGroups[issue.severity].push(issue);
      });

      for (const [severity, issues] of Object.entries(severityGroups)) {
        if (issues.length > 0) {
          report += `### ${this.getSeverityLabel(severity)} 问题 (${issues.length}个)\n\n`;
          
          issues.forEach((issue, index) => {
            report += `#### ${index + 1}. ${issue.title}\n`;
            report += `- **检测器**: ${issue.detector}\n`;
            report += `- **类型**: ${issue.type}\n`;
            report += `- **描述**: ${issue.description}\n`;
            report += `- **可修复**: ${issue.fixable ? '是' : '否'}\n`;
            report += `- **修复类型**: ${issue.fixType}\n`;
            
            if (issue.fixSteps && issue.fixSteps.length > 0) {
              report += `- **修复步骤**:\n`;
              issue.fixSteps.forEach((step, stepIndex) => {
                report += `  ${stepIndex + 1}. ${step.description}\n`;
                if (step.command) {
                  report += `    命令: \`${step.command}\`\n`;
                }
              });
            }
            
            report += `\n`;
          });
        }
      }
    } else {
      report += `## 检查结果\n\n✅ 未发现任何问题，可以开始部署！\n\n`;
    }

    report += `## 检测器执行情况\n\n`;
    result.detectors.forEach(detector => {
      report += `- **${detector.name}**: ${detector.status} (${detector.issuesCount || 0}个问题)\n`;
    });

    report += `\n---\n`;
    report += `*报告生成时间: ${new Date().toISOString()}*\n`;

    return report;
  }

  /**
   * 生成 HTML 报告
   * @param {Object} result 预检结果
   * @returns {string} HTML 报告
   */
  generateHtmlReport(result) {
    // 简化的 HTML 报告生成
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>部署前预检报告 - ${result.projectId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .severity-critical { color: #d32f2f; font-weight: bold; }
        .severity-high { color: #f57c00; }
        .severity-medium { color: #fbc02d; }
        .severity-low { color: #388e3c; }
        .severity-info { color: #1976d2; }
        .issue-card { border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .fixable { border-left: 4px solid #4caf50; }
        .not-fixable { border-left: 4px solid #9e9e9e; }
    </style>
</head>
<body>
    <h1>部署前预检报告</h1>
    <div>
        <p><strong>项目:</strong> ${result.projectId}</p>
        <p><strong>检查时间:</strong> ${result.startTime}</p>
        <p><strong>状态:</strong> <span class="severity-${result.overallStatus}">${result.overallStatus}</span></p>
    </div>
    <p>详细报告请查看 JSON 或 Markdown 格式</p>
</body>
</html>`;
  }

  /**
   * 获取严重程度标签
   * @param {string} severity 严重程度
   * @returns {string} 中文标签
   */
  getSeverityLabel(severity) {
    const labels = {
      critical: '严重',
      high: '高级',
      medium: '中级',
      low: '低级',
      info: '信息'
    };
    return labels[severity] || severity;
  }
}

module.exports = new DeployPrecheck();
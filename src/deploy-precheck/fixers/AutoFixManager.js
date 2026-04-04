/**
 * 一键修复管理器
 * 协调所有修复器，管理一键修复流程
 */

const PortFixer = require('./PortFixer');
const DependencyFixer = require('./DependencyFixer');
const { logger } = require('../../utils/logger');

class AutoFixManager {
  constructor() {
    this.fixers = [
      new PortFixer(),
      new DependencyFixer()
    ];
    
    this.activeFixes = new Map(); // 存储进行中的修复
    this.fixHistory = new Map(); // 修复历史记录
    this.maxHistorySize = 100; // 最大历史记录数
  }

  /**
   * 执行一键修复
   * @param {Object} options 修复选项
   * @returns {Promise<Object>} 修复结果
   */
  async runAutoFix(options) {
    const {
      checkId,
      issueIds = [], // 要修复的问题ID，空数组表示修复所有可修复问题
      project,
      userConfirmation = false, // 用户是否已确认
      fixId = `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } = options;

    if (!checkId) {
      throw new Error('缺少必要参数: checkId');
    }

    logger.info(`开始一键修复: ${fixId}, 检查ID: ${checkId}`);

    const result = {
      fixId,
      checkId,
      startTime: new Date().toISOString(),
      status: 'running',
      projectId: project?.id,
      totalIssues: 0,
      fixedIssues: 0,
      failedIssues: 0,
      skippedIssues: 0,
      requiresConfirmation: false,
      issues: [],
      summary: {
        byType: {},
        bySeverity: {},
        byFixer: {}
      }
    };

    // 存储到活动修复
    this.activeFixes.set(fixId, result);

    try {
      // 获取预检结果
      const DeployPrecheck = require('../index');
      const precheckResult = DeployPrecheck.getResult(checkId);
      
      if (!precheckResult) {
        throw new Error(`预检结果不存在或已过期: ${checkId}`);
      }

      // 过滤要修复的问题
      let issuesToFix = precheckResult.issues.filter(issue => issue.fixable);
      
      if (issueIds.length > 0) {
        issuesToFix = issuesToFix.filter(issue => issueIds.includes(issue.id));
      }

      result.totalIssues = issuesToFix.length;

      if (issuesToFix.length === 0) {
        result.status = 'completed';
        result.endTime = new Date().toISOString();
        result.message = '没有可修复的问题';
        return result;
      }

      // 检查是否需要用户确认
      const needsConfirmation = issuesToFix.some(issue => 
        this.getFixerForIssue(issue)?.requiresUserConfirmation?.(issue)
      );

      if (needsConfirmation && !userConfirmation) {
        result.status = 'requires_confirmation';
        result.requiresConfirmation = true;
        result.confirmationRequiredIssues = issuesToFix
          .filter(issue => this.getFixerForIssue(issue)?.requiresUserConfirmation?.(issue))
          .map(issue => ({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            severity: issue.severity,
            fixer: this.getFixerForIssue(issue)?.name
          }));
        
        result.message = '需要用户确认才能继续修复';
        return result;
      }

      // 按优先级排序：先修复严重问题
      issuesToFix.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      // 执行修复
      for (const issue of issuesToFix) {
        const issueResult = await this.fixSingleIssue(issue, { project });
        
        result.issues.push(issueResult);

        if (issueResult.success) {
          result.fixedIssues++;
        } else if (issueResult.skipped) {
          result.skippedIssues++;
        } else {
          result.failedIssues++;
        }

        // 更新统计
        this.updateSummary(result.summary, issue, issueResult);
      }

      // 生成最终结果
      result.status = 'completed';
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - new Date(result.startTime).getTime();
      result.message = this.generateResultMessage(result);

      // 保存到历史记录
      this.saveToHistory(result);

      logger.info(`一键修复完成: ${fixId}, 修复 ${result.fixedIssues}/${result.totalIssues} 个问题`);

    } catch (error) {
      result.status = 'failed';
      result.endTime = new Date().toISOString();
      result.error = error.message;
      logger.error(`一键修复失败:`, error);
    } finally {
      // 从活动修复中移除
      setTimeout(() => {
        this.activeFixes.delete(fixId);
      }, 300000); // 5分钟后清理
    }

    return result;
  }

  /**
   * 修复单个问题
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 修复结果
   */
  async fixSingleIssue(issue, context) {
    const fixer = this.getFixerForIssue(issue);
    
    if (!fixer) {
      return {
        issueId: issue.id,
        issueType: issue.type,
        title: issue.title,
        success: false,
        skipped: true,
        message: '找不到对应的修复器',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      };
    }

    if (!fixer.canFix(issue)) {
      return {
        issueId: issue.id,
        issueType: issue.type,
        title: issue.title,
        success: false,
        skipped: true,
        message: '修复器不支持此问题类型',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      };
    }

    try {
      logger.info(`修复问题: ${issue.id} (${issue.type}), 修复器: ${fixer.name}`);
      
      const fixResult = await fixer.fix(issue, context);
      
      return {
        issueId: issue.id,
        issueType: issue.type,
        title: issue.title,
        success: fixResult.success,
        skipped: false,
        message: fixResult.message,
        startTime: fixResult.startTime,
        endTime: fixResult.endTime,
        details: fixResult.details,
        warnings: fixResult.warnings || [],
        requiresRestart: fixResult.requiresRestart || false,
        fixer: fixer.name
      };

    } catch (error) {
      logger.error(`修复问题 ${issue.id} 失败:`, error);
      
      return {
        issueId: issue.id,
        issueType: issue.type,
        title: issue.title,
        success: false,
        skipped: false,
        message: `修复失败: ${error.message}`,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        error: error.message,
        fixer: fixer.name
      };
    }
  }

  /**
   * 获取适合问题的修复器
   * @param {Object} issue 问题对象
   * @returns {BaseFixer|null} 修复器实例
   */
  getFixerForIssue(issue) {
    return this.fixers.find(fixer => fixer.canFix(issue)) || null;
  }

  /**
   * 获取修复进度
   * @param {string} fixId 修复ID
   * @returns {Object} 进度信息
   */
  getProgress(fixId) {
    const result = this.activeFixes.get(fixId);
    if (!result) {
      return { status: 'not_found' };
    }

    const completed = result.issues.length;
    const success = result.issues.filter(i => i.success).length;
    const failed = result.issues.filter(i => !i.success && !i.skipped).length;
    const skipped = result.issues.filter(i => i.skipped).length;

    return {
      status: result.status,
      progress: result.totalIssues > 0 ? Math.round((completed / result.totalIssues) * 100) : 0,
      completed,
      total: result.totalIssues,
      success,
      failed,
      skipped,
      requiresConfirmation: result.requiresConfirmation
    };
  }

  /**
   * 获取修复结果
   * @param {string} fixId 修复ID
   * @returns {Object|null} 修复结果
   */
  getResult(fixId) {
    // 首先从活动修复中查找
    if (this.activeFixes.has(fixId)) {
      return this.activeFixes.get(fixId);
    }

    // 从历史记录中查找
    if (this.fixHistory.has(fixId)) {
      return this.fixHistory.get(fixId);
    }

    return null;
  }

  /**
   * 获取修复历史
   * @param {string} projectId 项目ID
   * @param {number} limit 限制数量
   * @returns {Array} 历史记录
   */
  getHistory(projectId, limit = 10) {
    const history = Array.from(this.fixHistory.values())
      .filter(record => !projectId || record.projectId === projectId)
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
      .slice(0, limit);

    return history;
  }

  /**
   * 清理历史记录
   * @param {number} maxAge 最大保存时间（毫秒）
   */
  clearHistory(maxAge = 7 * 24 * 60 * 60 * 1000) { // 默认7天
    const now = Date.now();
    let cleared = 0;

    for (const [fixId, record] of this.fixHistory.entries()) {
      const recordTime = new Date(record.endTime).getTime();
      if (now - recordTime > maxAge) {
        this.fixHistory.delete(fixId);
        cleared++;
      }
    }

    // 限制历史记录大小
    if (this.fixHistory.size > this.maxHistorySize) {
      const sorted = Array.from(this.fixHistory.entries())
        .sort((a, b) => new Date(a[1].endTime) - new Date(b[1].endTime));
      
      const toRemove = sorted.slice(0, this.fixHistory.size - this.maxHistorySize);
      toRemove.forEach(([fixId]) => {
        this.fixHistory.delete(fixId);
        cleared++;
      });
    }

    logger.info(`清理了 ${cleared} 条历史记录`);
    return cleared;
  }

  /**
   * 获取支持的修复类型
   * @returns {Array} 修复类型列表
   */
  getSupportedFixTypes() {
    const types = new Set();
    
    this.fixers.forEach(fixer => {
      fixer.supportedIssueTypes.forEach(type => {
        types.add(type);
      });
    });

    return Array.from(types).map(type => ({
      type,
      fixers: this.fixers.filter(f => f.supportedIssueTypes.includes(type)).map(f => f.name)
    }));
  }

  /**
   * 更新统计摘要
   * @param {Object} summary 摘要对象
   * @param {Object} issue 问题对象
   * @param {Object} issueResult 问题修复结果
   */
  updateSummary(summary, issue, issueResult) {
    // 按问题类型统计
    summary.byType[issue.type] = summary.byType[issue.type] || { total: 0, success: 0, failed: 0, skipped: 0 };
    summary.byType[issue.type].total++;
    if (issueResult.success) summary.byType[issue.type].success++;
    else if (issueResult.skipped) summary.byType[issue.type].skipped++;
    else summary.byType[issue.type].failed++;

    // 按严重程度统计
    summary.bySeverity[issue.severity] = summary.bySeverity[issue.severity] || { total: 0, success: 0, failed: 0, skipped: 0 };
    summary.bySeverity[issue.severity].total++;
    if (issueResult.success) summary.bySeverity[issue.severity].success++;
    else if (issueResult.skipped) summary.bySeverity[issue.severity].skipped++;
    else summary.bySeverity[issue.severity].failed++;

    // 按修复器统计
    if (issueResult.fixer) {
      summary.byFixer[issueResult.fixer] = summary.byFixer[issueResult.fixer] || { total: 0, success: 0, failed: 0, skipped: 0 };
      summary.byFixer[issueResult.fixer].total++;
      if (issueResult.success) summary.byFixer[issueResult.fixer].success++;
      else if (issueResult.skipped) summary.byFixer[issueResult.fixer].skipped++;
      else summary.byFixer[issueResult.fixer].failed++;
    }
  }

  /**
   * 生成结果消息
   * @param {Object} result 修复结果
   * @returns {string} 结果消息
   */
  generateResultMessage(result) {
    const { fixedIssues, totalIssues, failedIssues, skippedIssues } = result;
    
    if (totalIssues === 0) {
      return '没有需要修复的问题';
    }
    
    if (fixedIssues === totalIssues) {
      return `✅ 成功修复所有 ${totalIssues} 个问题`;
    }
    
    const parts = [];
    if (fixedIssues > 0) {
      parts.push(`成功修复 ${fixedIssues} 个问题`);
    }
    if (failedIssues > 0) {
      parts.push(`修复失败 ${failedIssues} 个问题`);
    }
    if (skippedIssues > 0) {
      parts.push(`跳过 ${skippedIssues} 个问题`);
    }
    
    return parts.join('，');
  }

  /**
   * 保存到历史记录
   * @param {Object} result 修复结果
   */
  saveToHistory(result) {
    this.fixHistory.set(result.fixId, result);
    
    // 限制历史记录大小
    if (this.fixHistory.size > this.maxHistorySize) {
      const sorted = Array.from(this.fixHistory.entries())
        .sort((a, b) => new Date(a[1].endTime) - new Date(b[1].endTime));
      
      const toRemove = sorted.slice(0, this.fixHistory.size - this.maxHistorySize);
      toRemove.forEach(([fixId]) => {
        this.fixHistory.delete(fixId);
      });
    }
  }

  /**
   * 导出修复报告
   * @param {Object} result 修复结果
   * @param {string} format 报告格式
   * @returns {Promise<string>} 报告内容
   */
  async exportReport(result, format = 'markdown') {
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
   * 生成Markdown报告
   * @param {Object} result 修复结果
   * @returns {string} Markdown报告
   */
  generateMarkdownReport(result) {
    let report = `# 一键修复报告\n\n`;
    
    report += `## 基本信息\n`;
    report += `- **修复ID**: ${result.fixId}\n`;
    report += `- **检查ID**: ${result.checkId}\n`;
    report += `- **项目ID**: ${result.projectId || 'N/A'}\n`;
    report += `- **开始时间**: ${result.startTime}\n`;
    report += `- **结束时间**: ${result.endTime}\n`;
    report += `- **状态**: ${result.status}\n`;
    report += `- **结果**: ${result.message}\n\n`;

    report += `## 修复统计\n`;
    report += `- **总问题数**: ${result.totalIssues}\n`;
    report += `- **成功修复**: ${result.fixedIssues}\n`;
    report += `- **修复失败**: ${result.failedIssues}\n`;
    report += `- **跳过修复**: ${result.skippedIssues}\n`;
    report += `- **需要重启**: ${result.issues.some(i => i.requiresRestart) ? '是' : '否'}\n\n`;

    if (result.summary.byType && Object.keys(result.summary.byType).length > 0) {
      report += `## 按问题类型统计\n\n`;
      report += `| 问题类型 | 总数 | 成功 | 失败 | 跳过 |\n`;
      report += `|----------|------|------|------|------|\n`;
      
      Object.entries(result.summary.byType).forEach(([type, stats]) => {
        report += `| ${type} | ${stats.total} | ${stats.success} | ${stats.failed} | ${stats.skipped} |\n`;
      });
      report += `\n`;
    }

    if (result.issues.length > 0) {
      report += `## 修复详情\n\n`;
      
      // 按成功/失败分组
      const successful = result.issues.filter(i => i.success);
      const failed = result.issues.filter(i => !i.success && !i.skipped);
      const skipped = result.issues.filter(i => i.skipped);

      if (successful.length > 0) {
        report += `### ✅ 成功修复 (${successful.length}个)\n\n`;
        successful.forEach((issue, index) => {
          report += `#### ${index + 1}. ${issue.title}\n`;
          report += `- **类型**: ${issue.issueType}\n`;
          report += `- **修复器**: ${issue.fixer || '未知'}\n`;
          report += `- **结果**: ${issue.message}\n`;
          report += `- **耗时**: ${new Date(issue.endTime) - new Date(issue.startTime)}ms\n`;
          if (issue.warnings && issue.warnings.length > 0) {
            report += `- **警告**: ${issue.warnings.join('; ')}\n`;
          }
          report += `\n`;
        });
      }

      if (failed.length > 0) {
        report += `### ❌ 修复失败 (${failed.length}个)\n\n`;
        failed.forEach((issue, index) => {
          report += `#### ${index + 1}. ${issue.title}\n`;
          report += `- **类型**: ${issue.issueType}\n`;
          report += `- **修复器**: ${issue.fixer || '未知'}\n`;
          report += `- **错误**: ${issue.message}\n`;
          report += `- **详情**: ${issue.error || '无详细错误信息'}\n`;
          report += `\n`;
        });
      }

      if (skipped.length > 0) {
        report += `### ⚠️ 跳过修复 (${skipped.length}个)\n\n`;
        skipped.forEach((issue, index) => {
          report += `#### ${index + 1}. ${issue.title}\n`;
          report += `- **类型**: ${issue.issueType}\n`;
          report += `- **原因**: ${issue.message}\n`;
          report += `\n`;
        });
      }
    }

    report += `## 建议\n\n`;
    if (result.issues.some(i => i.requiresRestart)) {
      report += `⚠️ **重要**: 某些修复需要重启相关服务才能生效\n\n`;
    }
    
    if (result.failedIssues > 0) {
      report += `🔧 **后续操作**: 请手动检查修复失败的问题\n\n`;
    }

    report += `---\n`;
    report += `*报告生成时间: ${new Date().toISOString()}*\n`;

    return report;
  }

  /**
   * 生成HTML报告
   * @param {Object} result 修复结果
   * @returns {string} HTML报告
   */
  generateHtmlReport(result) {
    // 简化的HTML报告
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>一键修复报告 - ${result.fixId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .success { color: #4caf50; }
        .failed { color: #f44336; }
        .skipped { color: #ff9800; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .success-card { border-left: 4px solid #4caf50; }
        .failed-card { border-left: 4px solid #f44336; }
        .skipped-card { border-left: 4px solid #ff9800; }
    </style>
</head>
<body>
    <h1>一键修复报告</h1>
    <div class="card">
        <h2>基本信息</h2>
        <p><strong>修复ID:</strong> ${result.fixId}</p>
        <p><strong>状态:</strong> ${result.status}</p>
        <p><strong>结果:</strong> ${result.message}</p>
        <p><strong>总问题数:</strong> ${result.totalIssues}</p>
        <p class="success"><strong>成功修复:</strong> ${result.fixedIssues}</p>
        <p class="failed"><strong>修复失败:</strong> ${result.failedIssues}</p>
        <p class="skipped"><strong>跳过修复:</strong> ${result.skippedIssues}</p>
    </div>
    <p>详细报告请查看 JSON 或 Markdown 格式</p>
</body>
</html>`;
  }
}

module.exports = new AutoFixManager();
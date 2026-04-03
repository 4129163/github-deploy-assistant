const RuntimeDetector = require('./detectors/RuntimeDetector');
const ConfigDetector = require('./detectors/ConfigDetector');
const RuntimeFixer = require('./fixers/RuntimeFixer');
const ConfigFixer = require('./fixers/ConfigFixer');
const { answerQuestion } = require('../services/ai');

class ProjectDoctor {
  constructor() {
    this.detectors = [
      new RuntimeDetector(),
      new ConfigDetector()
    ];
    this.fixers = {
      runtime: new RuntimeFixer(),
      config: new ConfigFixer()
    };
  }

  /**
   * 诊断项目所有问题
   * @param {Object} project 项目信息
   * @returns {Promise<Object>} 诊断结果
   */
  async diagnose(project) {
    const result = {
      project,
      diagnoseTime: new Date().toISOString(),
      issues: [],
      fixableCount: 0
    };

    // 运行所有检测器
    for (const detector of this.detectors) {
      try {
        const issues = await detector.detect(project);
        result.issues.push(...issues);
      } catch (e) {
        console.error(`检测器${detector.name}运行失败:`, e.message);
      }
    }

    // 统计可自动修复的问题数量
    result.fixableCount = result.issues.filter(i => i.fixable).length;

    return result;
  }

  /**
   * 自动修复所有可修复的问题
   * @param {Object} diagnoseResult 诊断结果
   * @returns {Promise<Object>} 修复结果
   */
  async autoFix(diagnoseResult) {
    const result = {
      successCount: 0,
      failedCount: 0,
      failedIssues: []
    };

    for (const issue of diagnoseResult.issues) {
      if (!issue.fixable) continue;

      try {
        let fixSuccess = false;
        // 根据问题类型选择对应的修复器
        if (['process_crashed', 'port_not_listening', 'service_unresponsive', 'high_cpu_usage', 'high_memory_usage'].includes(issue.type)) {
          fixSuccess = await this.fixers.runtime.fix(issue, diagnoseResult.project);
        } else if (issue.type.startsWith('missing_') || issue.type.startsWith('invalid_')) {
          fixSuccess = await this.fixers.config.fix(issue, diagnoseResult.project);
        }

        if (fixSuccess) {
          result.successCount++;
        } else {
          result.failedCount++;
          result.failedIssues.push(issue);
        }
      } catch (e) {
        result.failedCount++;
        result.failedIssues.push(issue);
      }
    }

    return result;
  }

  /**
   * 处理用户的自然语言对话请求
   * @param {Object} project 项目信息
   * @param {string} userMessage 用户的自然语言消息
   * @returns {Promise<string>} 回复内容
   */
  async chat(project, userMessage) {
    // 先判断是不是配置修改请求
    if (userMessage.includes('改成') || userMessage.includes('设置为') || userMessage.includes('修改') || userMessage.includes('开启') || userMessage.includes('关闭')) {
      const configResult = await this.fixers.config.updateConfigByNaturalLanguage(project, userMessage);
      return configResult.message;
    }

    // 其他问题调用AI回答
    try {
      const answer = await answerQuestion(project.id, userMessage);
      return answer;
    } catch (e) {
      return '抱歉，我现在没办法回答这个问题，你可以换个方式描述哦~';
    }
  }

  /**
   * 启动定时监控，自动检测并修复项目问题
   * @param {Object} project 项目信息
   * @param {number} interval 检测间隔（毫秒），默认5分钟
   */
  startMonitoring(project, interval = 5 * 60 * 1000) {
    setInterval(async () => {
      const diagnoseResult = await this.diagnose(project);
      if (diagnoseResult.issues.length > 0 && diagnoseResult.fixableCount > 0) {
        // 有可修复的问题，自动修复
        const fixResult = await this.autoFix(diagnoseResult);
        // 这里可以加通知逻辑，通过桌面精灵/邮件通知用户
        console.log(`项目${project.name}自动修复完成：成功${fixResult.successCount}个，失败${fixResult.failedCount}个`);
      }
    }, interval);
  }
}

module.exports = ProjectDoctor;

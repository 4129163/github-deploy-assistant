/**
 * 预检检测器基类
 * 所有检测器都应继承此类
 */

class BaseDetector {
  constructor() {
    this.name = 'BaseDetector';
    this.description = '基础检测器';
    this.priority = 0; // 优先级，数值越小优先级越高
  }

  /**
   * 执行检测
   * @param {Object} context 检测上下文
   * @returns {Promise<Array>} 检测结果数组
   */
  async detect(context) {
    throw new Error('子类必须实现 detect 方法');
  }

  /**
   * 格式化检测结果
   * @param {Object} issue 问题对象
   * @returns {Object} 格式化后的结果
   */
  formatIssue(issue) {
    return {
      id: `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: issue.type || 'unknown',
      detector: this.name,
      title: issue.title || '未命名问题',
      description: issue.description || '',
      severity: issue.severity || 'medium', // critical, high, medium, low, info
      fixable: issue.fixable !== undefined ? issue.fixable : false,
      fixType: issue.fixType || 'manual', // auto, semi-auto, manual
      fixSteps: issue.fixSteps || [],
      data: issue.data || {},
      detectedAt: new Date().toISOString()
    };
  }

  /**
   * 检查是否应该运行此检测器
   * @param {Object} context 检测上下文
   * @returns {boolean}
   */
  shouldRun(context) {
    return true;
  }

  /**
   * 验证检测结果
   * @param {Object} issue 问题对象
   * @returns {boolean}
   */
  validateIssue(issue) {
    const required = ['type', 'title', 'description', 'severity'];
    return required.every(field => issue[field] !== undefined);
  }

  /**
   * 生成修复建议
   * @param {Object} issue 问题对象
   * @returns {string}
   */
  generateFixSuggestion(issue) {
    if (issue.fixSteps && issue.fixSteps.length > 0) {
      return issue.fixSteps.map(step => step.description).join('；');
    }
    return '请手动检查并解决问题';
  }
}

module.exports = BaseDetector;
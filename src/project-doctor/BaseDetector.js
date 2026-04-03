class BaseDetector {
  constructor() {
    this.name = 'Base Detector';
    this.description = '基础运行时检测器';
  }

  /**
   * 检测项目运行状态
   * @param {Object} project 项目信息
   * @returns {Promise<Array>} 问题列表
   */
  async detect(project) {
    throw new Error('子类必须实现detect方法');
  }
}

module.exports = BaseDetector;

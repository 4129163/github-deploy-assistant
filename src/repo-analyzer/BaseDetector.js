class BaseDetector {
  constructor() {
    this.name = 'Base Detector';
    this.description = '基础检测器';
  }

  /**
   * 检测仓库问题
   * @param {string} repoPath 本地仓库路径
   * @param {Object} repoInfo 仓库基础信息
   * @returns {Promise<Array>} 问题列表
   */
  async detect(repoPath, repoInfo) {
    throw new Error('子类必须实现detect方法');
  }
}

module.exports = BaseDetector;

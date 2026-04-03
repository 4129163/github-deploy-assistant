class BaseFixer {
  constructor() {
    this.name = 'Base Fixer';
    this.description = '基础问题修复器';
  }

  /**
   * 修复指定问题
   * @param {Object} problem 问题对象
   * @param {Object} project 项目信息
   * @returns {Promise<boolean>} 是否修复成功
   */
  async fix(problem, project) {
    throw new Error('子类必须实现fix方法');
  }

  /**
   * 获取手动修复方案
   * @param {Object} problem 问题对象
   * @param {Object} project 项目信息
   * @returns {string} 手动修复步骤
   */
  getManualFixSteps(problem, project) {
    return '请参考官方文档排查问题';
  }
}

module.exports = BaseFixer;

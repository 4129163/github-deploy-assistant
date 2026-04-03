class BasePlatform {
  constructor(config) {
    this.config = config;
    this.token = config.token;
    this.username = config.username;
  }

  /**
   * 检查令牌有效性
   * @returns {Promise<boolean>} 是否有效
   */
  async checkToken() {
    throw new Error('子类必须实现checkToken方法');
  }

  /**
   * 创建新仓库
   * @param {Object} options 仓库选项
   * @param {string} options.name 仓库名称
   * @param {string} options.description 仓库描述
   * @param {boolean} options.isPrivate 是否私有
   * @returns {Promise<string>} 仓库git地址
   */
  async createRepo(options) {
    throw new Error('子类必须实现createRepo方法');
  }

  /**
   * 检查仓库是否存在
   * @param {string} repoName 仓库名称
   * @returns {Promise<boolean>} 是否存在
   */
  async isRepoExists(repoName) {
    throw new Error('子类必须实现isRepoExists方法');
  }
}

module.exports = BasePlatform;

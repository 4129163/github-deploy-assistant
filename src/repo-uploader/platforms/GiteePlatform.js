const BasePlatform = require('../BasePlatform');
const axios = require('axios');

class GiteePlatform extends BasePlatform {
  constructor(config) {
    super(config);
    this.apiBase = 'https://gitee.com/api/v5';
    this.client = axios.create({
      baseURL: this.apiBase,
      headers: {
        'Authorization': `token ${this.token}`
      },
      timeout: 15000
    });
  }

  async checkToken() {
    try {
      const res = await this.client.get('/user');
      this.username = res.data.login;
      return true;
    } catch (e) {
      return false;
    }
  }

  async isRepoExists(repoName) {
    try {
      await this.client.get(`/repos/${this.username}/${repoName}`);
      return true;
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return false;
      }
      throw e;
    }
  }

  async createRepo(options) {
    const res = await this.client.post('/user/repos', {
      name: options.name,
      description: options.description || '',
      private: options.isPrivate || false,
      auto_init: false,
      default_branch: 'main',
      has_issues: true,
      has_wiki: true
    });
    return res.data.clone_url;
  }
}

module.exports = GiteePlatform;

const BasePlatform = require('../BasePlatform');
const axios = require('axios');

class GitCodePlatform extends BasePlatform {
  constructor(config) {
    super(config);
    this.apiBase = 'https://gitcode.net/api/v4';
    this.client = axios.create({
      baseURL: this.apiBase,
      headers: {
        'PRIVATE-TOKEN': this.token
      },
      timeout: 15000
    });
  }

  async checkToken() {
    try {
      const res = await this.client.get('/user');
      this.username = res.data.username;
      return true;
    } catch (e) {
      return false;
    }
  }

  async isRepoExists(repoName) {
    try {
      await this.client.get(`/projects/${this.username}%2F${repoName}`);
      return true;
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return false;
      }
      throw e;
    }
  }

  async createRepo(options) {
    const res = await this.client.post('/projects', {
      name: options.name,
      description: options.description || '',
      visibility: options.isPrivate ? 'private' : 'public',
      default_branch: 'main',
      auto_devops_enabled: false,
      initialize_with_readme: false
    });
    return res.data.http_url_to_repo;
  }
}

module.exports = GitCodePlatform;

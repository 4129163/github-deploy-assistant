const GitHubPlatform = require('./platforms/GitHubPlatform');
const GiteePlatform = require('./platforms/GiteePlatform');
const GitCodePlatform = require('./platforms/GitCodePlatform');

const platformMap = {
  github: GitHubPlatform,
  gitee: GiteePlatform,
  gitcode: GitCodePlatform,
  gitlab: GitCodePlatform // GitLab API和GitCode兼容，复用实现
};

class PlatformFactory {
  static getPlatform(type, config) {
    const PlatformClass = platformMap[type.toLowerCase()];
    if (!PlatformClass) {
      throw new Error(`不支持的平台类型: ${type}，目前支持的平台：GitHub/Gitee/GitCode/GitLab`);
    }
    return new PlatformClass(config);
  }

  static getSupportedPlatforms() {
    return [
      { value: 'github', label: 'GitHub', home: 'https://github.com', tokenHelp: 'https://github.com/settings/tokens' },
      { value: 'gitee', label: 'Gitee(码云)', home: 'https://gitee.com', tokenHelp: 'https://gitee.com/profile/personal_access_tokens' },
      { value: 'gitcode', label: 'GitCode', home: 'https://gitcode.net', tokenHelp: 'https://gitcode.net/-/profile/personal_access_tokens' },
      { value: 'gitlab', label: 'GitLab', home: 'https://gitlab.com', tokenHelp: 'https://gitlab.com/-/profile/personal_access_tokens' }
    ];
  }
}

module.exports = PlatformFactory;

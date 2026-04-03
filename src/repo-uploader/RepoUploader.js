const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const PlatformFactory = require('./PlatformFactory');
const gitignoreTemplates = require('./templates/gitignoreTemplates');
const licenseTemplates = require('./templates/licenseTemplates');
const READMEGenerator = require('./templates/READMEGenerator');

class RepoUploader {
  constructor(options) {
    this.options = options;
    this.platform = PlatformFactory.getPlatform(options.platformType, {
      token: options.token,
      username: options.username
    });
    this.git = simpleGit();
  }

  /**
   * 检查平台令牌有效性
   */
  async validateToken() {
    return this.platform.checkToken();
  }

  /**
   * 生成标准仓库配置文件
   */
  async generateRepoConfig(projectPath, config) {
    const {
      projectType = 'default',
      licenseType = 'MIT',
      author = 'user',
      projectName,
      description,
      repoUrl
    } = config;

    // 生成.gitignore
    const gitignoreContent = gitignoreTemplates[projectType] || gitignoreTemplates.default;
    await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent.trim());

    // 生成LICENSE
    if (licenseType !== 'none') {
      const licenseContent = licenseTemplates[licenseType](new Date().getFullYear(), author);
      await fs.writeFile(path.join(projectPath, 'LICENSE'), licenseContent.trim());
    }

    // 生成README.md
    const readmeContent = READMEGenerator.generate({
      projectName,
      projectType,
      description,
      author,
      repoUrl,
      license: licenseType
    });
    await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent.trim());

    // 生成CONTRIBUTING.md
    const contributingContent = `# 贡献指南
欢迎提交Issue和Pull Request来改进这个项目！

## 提交规范
- 提交信息格式：feat: 新增xx功能 / fix: 修复xx问题 / docs: 更新文档
- 代码提交前请先运行测试确保没有问题
`;
    await fs.writeFile(path.join(projectPath, 'CONTRIBUTING.md'), contributingContent.trim());

    return true;
  }

  /**
   * 上传本地源码到仓库
   * @param {string} projectPath 本地项目路径
   * @param {Object} options 上传选项
   * @param {string} options.repoUrl 可选，指定已有仓库地址，不填则自动创建新仓库
   * @param {string} options.repoName 仓库名称
   * @param {string} options.description 仓库描述
   * @param {boolean} options.isPrivate 是否私有
   * @param {string} options.licenseType 协议类型
   * @param {string} options.projectType 项目类型
   * @param {string} options.author 作者名称
   * @param {boolean} options.generateConfig 是否自动生成配置文件
   * @param {boolean} options.forcePush 是否强制覆盖
   * @returns {Promise<string>} 仓库地址
   */
  async upload(projectPath, options) {
    // 检查项目路径是否存在
    if (!await fs.pathExists(projectPath)) {
      throw new Error('本地项目路径不存在');
    }

    let repoUrl = options.repoUrl;

    // 如果没有指定仓库地址，自动创建新仓库
    if (!repoUrl) {
      // 检查仓库是否已存在
      const exists = await this.platform.isRepoExists(options.repoName);
      if (exists && !options.forcePush) {
        throw new Error(`仓库 ${options.repoName} 已存在，可以开启强制覆盖选项`);
      }

      if (exists && options.forcePush) {
        // 仓库已存在，获取地址
        const user = (await this.platform.client.get('/user')).data;
        repoUrl = `${this.platform.apiBase.replace('api/v5', '').replace('api/v3', '').replace('api/v4', '')}/${user.login}/${options.repoName}.git`;
      } else {
        // 创建新仓库
        repoUrl = await this.platform.createRepo({
          name: options.repoName,
          description: options.description,
          isPrivate: options.isPrivate
        });
      }
    }

    // 自动生成配置文件
    if (options.generateConfig) {
      await this.generateRepoConfig(projectPath, {
        ...options,
        repoUrl
      });
    }

    // Git操作上传代码
    const git = simpleGit(projectPath);
    
    // 初始化仓库（如果还不是git仓库）
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
      await git.addRemote('origin', repoUrl);
    } else {
      // 已经是git仓库，更新remote
      try {
        await git.removeRemote('origin');
      } catch (e) {}
      await git.addRemote('origin', repoUrl);
    }

    // 添加所有文件
    await git.add('.');
    await git.commit(options.commitMessage || 'Initial commit');
    await git.branch(['-M', 'main']);
    
    // 推送代码
    await git.push(['-u', 'origin', 'main', options.forcePush ? '-f' : '']);

    return repoUrl;
  }
}

module.exports = RepoUploader;

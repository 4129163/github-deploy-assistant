/**
 * 依赖修复器
 * 修复缺失或版本过低的依赖
 */

const BaseFixer = require('./BaseFixer');
const semver = require('semver');

class DependencyFixer extends BaseFixer {
  constructor() {
    super();
    this.name = 'DependencyFixer';
    this.description = '依赖修复器';
    this.supportedIssueTypes = ['dependency_missing', 'dependency_version_low'];
  }

  /**
   * 修复依赖问题
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 修复结果
   */
  async fix(issue, context) {
    const startTime = new Date().toISOString();
    const { dependency, requiredVersion, currentVersion, installGuide } = issue.data;

    try {
      let fixResult;
      
      if (issue.type === 'dependency_missing') {
        // 安装缺失的依赖
        fixResult = await this.installDependency(dependency, requiredVersion, installGuide);
      } else if (issue.type === 'dependency_version_low') {
        // 升级依赖版本
        fixResult = await this.upgradeDependency(dependency, requiredVersion, currentVersion, installGuide);
      } else {
        throw new Error(`不支持的依赖问题类型: ${issue.type}`);
      }

      // 验证修复
      const isFixed = await this.verifyFix(issue, context);
      
      return {
        success: isFixed,
        startTime,
        endTime: new Date().toISOString(),
        message: isFixed ? 
          `${dependency} 依赖问题已修复` : 
          `修复 ${dependency} 依赖问题失败`,
        details: {
          dependency,
          issueType: issue.type,
          requiredVersion,
          currentVersion: currentVersion || '未安装',
          fixResult,
          verificationResult: isFixed
        },
        warnings: fixResult.warnings || [],
        requiresRestart: fixResult.requiresRestart || false,
        requiresConfirmation: true // 安装软件需要用户确认
      };

    } catch (error) {
      return {
        success: false,
        startTime,
        endTime: new Date().toISOString(),
        message: `修复依赖 ${dependency} 失败: ${error.message}`,
        details: { error: error.message },
        requiresConfirmation: false
      };
    }
  }

  /**
   * 安装缺失的依赖
   * @param {string} dependency 依赖名称
   * @param {string} requiredVersion 需要的版本
   * @param {Object} installGuide 安装指南
   * @returns {Promise<Object>} 安装结果
   */
  async installDependency(dependency, requiredVersion, installGuide) {
    const platform = process.platform;
    let installCommand;

    // 根据平台选择安装命令
    if (installGuide) {
      if (platform === 'linux' && installGuide.linux) {
        installCommand = installGuide.linux;
      } else if (platform === 'darwin' && installGuide.macos) {
        installCommand = installGuide.macos;
      } else if (platform === 'win32' && installGuide.windows) {
        installCommand = installGuide.windows;
      }
    }

    // 如果没有安装指南，使用默认命令
    if (!installCommand) {
      installCommand = this.getDefaultInstallCommand(dependency, platform);
    }

    if (!installCommand) {
      throw new Error(`找不到 ${dependency} 的安装命令，请手动安装`);
    }

    // 执行安装命令
    const result = await this.safeExec(installCommand, { timeout: 180000 }); // 3分钟超时

    if (!result.success) {
      throw new Error(`安装命令执行失败: ${result.error || result.stderr}`);
    }

    return {
      success: true,
      command: installCommand,
      output: result.stdout,
      warnings: this.extractWarningsFromOutput(result.stdout, result.stderr)
    };
  }

  /**
   * 升级依赖版本
   * @param {string} dependency 依赖名称
   * @param {string} requiredVersion 需要的版本
   * @param {string} currentVersion 当前版本
   * @param {Object} installGuide 安装指南
   * @returns {Promise<Object>} 升级结果
   */
  async upgradeDependency(dependency, requiredVersion, currentVersion, installGuide) {
    const platform = process.platform;
    let upgradeCommand;

    // 根据依赖类型选择升级策略
    switch (dependency.toLowerCase()) {
      case 'node':
        upgradeCommand = this.getNodeUpgradeCommand(platform);
        break;
      case 'python':
        upgradeCommand = this.getPythonUpgradeCommand(platform, requiredVersion);
        break;
      case 'docker':
        upgradeCommand = this.getDockerUpgradeCommand(platform);
        break;
      case 'git':
        upgradeCommand = this.getGitUpgradeCommand(platform);
        break;
      default:
        // 对于其他依赖，重新安装
        return await this.installDependency(dependency, requiredVersion, installGuide);
    }

    if (!upgradeCommand) {
      throw new Error(`找不到 ${dependency} 的升级命令，请手动升级`);
    }

    // 执行升级命令
    const result = await this.safeExec(upgradeCommand, { timeout: 180000 });

    if (!result.success) {
      throw new Error(`升级命令执行失败: ${result.error || result.stderr}`);
    }

    return {
      success: true,
      command: upgradeCommand,
      output: result.stdout,
      warnings: this.extractWarningsFromOutput(result.stdout, result.stderr),
      requiresRestart: true // 升级依赖后通常需要重启
    };
  }

  /**
   * 获取默认安装命令
   * @param {string} dependency 依赖名称
   * @param {string} platform 平台
   * @returns {string} 安装命令
   */
  getDefaultInstallCommand(dependency, platform) {
    const commands = {
      git: {
        linux: 'sudo apt-get update && sudo apt-get install -y git',
        macos: 'brew install git',
        windows: 'choco install git -y'
      },
      node: {
        linux: 'curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs',
        macos: 'brew install node',
        windows: 'choco install nodejs-lts -y'
      },
      python: {
        linux: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip',
        macos: 'brew install python',
        windows: 'choco install python -y'
      },
      docker: {
        linux: 'curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh',
        macos: 'brew install --cask docker',
        windows: 'choco install docker-desktop -y'
      },
      java: {
        linux: 'sudo apt-get update && sudo apt-get install -y openjdk-11-jdk',
        macos: 'brew install openjdk@11',
        windows: 'choco install openjdk -y'
      },
      go: {
        linux: 'sudo apt-get update && sudo apt-get install -y golang-go',
        macos: 'brew install go',
        windows: 'choco install golang -y'
      },
      rust: {
        linux: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
        macos: 'brew install rust',
        windows: 'choco install rust -y'
      }
    };

    const depCommands = commands[dependency.toLowerCase()];
    if (!depCommands) {
      return null;
    }

    if (platform === 'linux' && depCommands.linux) {
      return depCommands.linux;
    } else if (platform === 'darwin' && depCommands.macos) {
      return depCommands.macos;
    } else if (platform === 'win32' && depCommands.windows) {
      return depCommands.windows;
    }

    return null;
  }

  /**
   * 获取Node.js升级命令
   * @param {string} platform 平台
   * @returns {string} 升级命令
   */
  getNodeUpgradeCommand(platform) {
    if (platform === 'linux') {
      return 'sudo npm install -g n && sudo n stable && sudo apt-get update && sudo apt-get install -y nodejs';
    } else if (platform === 'darwin') {
      return 'brew upgrade node';
    } else if (platform === 'win32') {
      return 'choco upgrade nodejs-lts -y';
    }
    return null;
  }

  /**
   * 获取Python升级命令
   * @param {string} platform 平台
   * @param {string} requiredVersion 需要的版本
   * @returns {string} 升级命令
   */
  getPythonUpgradeCommand(platform, requiredVersion) {
    if (platform === 'linux') {
      return `sudo apt-get update && sudo apt-get install -y python${requiredVersion?.split('.')[0] || '3'} python3-pip`;
    } else if (platform === 'darwin') {
      return 'brew upgrade python';
    } else if (platform === 'win32') {
      return 'choco upgrade python -y';
    }
    return null;
  }

  /**
   * 获取Docker升级命令
   * @param {string} platform 平台
   * @returns {string} 升级命令
   */
  getDockerUpgradeCommand(platform) {
    if (platform === 'linux') {
      return 'sudo apt-get update && sudo apt-get upgrade -y docker-ce docker-ce-cli containerd.io';
    } else if (platform === 'darwin') {
      return 'brew upgrade --cask docker';
    } else if (platform === 'win32') {
      return 'choco upgrade docker-desktop -y';
    }
    return null;
  }

  /**
   * 获取Git升级命令
   * @param {string} platform 平台
   * @returns {string} 升级命令
   */
  getGitUpgradeCommand(platform) {
    if (platform === 'linux') {
      return 'sudo add-apt-repository ppa:git-core/ppa -y && sudo apt-get update && sudo apt-get install -y git';
    } else if (platform === 'darmain') {
      return 'brew upgrade git';
    } else if (platform === 'win32') {
      return 'choco upgrade git -y';
    }
    return null;
  }

  /**
   * 从输出中提取警告信息
   * @param {string} stdout 标准输出
   * @param {string} stderr 错误输出
   * @returns {Array} 警告列表
   */
  extractWarningsFromOutput(stdout, stderr) {
    const warnings = [];
    const allOutput = (stdout + '\n' + stderr).toLowerCase();

    const warningPatterns = [
      { pattern: /warning:/i, message: '安装过程中出现警告' },
      { pattern: /deprecated/i, message: '使用了已弃用的功能' },
      { pattern: /experimental/i, message: '使用了实验性功能' },
      { pattern: /not found/i, message: '某些组件未找到' },
      { pattern: /failed to load/i, message: '加载某些组件失败' },
      { pattern: /out of date/i, message: '某些组件已过期' }
    ];

    warningPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(allOutput)) {
        warnings.push(message);
      }
    });

    return warnings;
  }

  /**
   * 验证修复结果
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<boolean>} 是否修复成功
   */
  async verifyFix(issue, context) {
    const { dependency, requiredVersion } = issue.data;
    
    try {
      // 重新检查依赖是否安装
      const checkResult = await this.checkDependency(dependency, requiredVersion);
      
      if (!checkResult.installed) {
        return false;
      }

      // 如果指定了版本要求，检查版本是否满足
      if (requiredVersion && checkResult.version) {
        return semver.satisfies(checkResult.version, requiredVersion);
      }

      return true;

    } catch (error) {
      console.error(`验证依赖 ${dependency} 失败:`, error);
      return false;
    }
  }

  /**
   * 检查依赖是否安装
   * @param {string} dependency 依赖名称
   * @param {string} requiredVersion 需要的版本
   * @returns {Promise<Object>} 检查结果
   */
  async checkDependency(dependency, requiredVersion) {
    // 这里复用了检测器的检查逻辑
    // 实际项目中应该复用已有的检查逻辑
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // 根据依赖类型确定检查命令
    const checkCommands = {
      git: 'git --version',
      node: 'node --version',
      npm: 'npm --version',
      python: 'python3 --version || python --version',
      pip: 'pip3 --version || pip --version',
      docker: 'docker --version',
      'docker-compose': 'docker-compose --version',
      java: 'java -version',
      maven: 'mvn --version',
      go: 'go version',
      rust: 'rustc --version',
      cargo: 'cargo --version'
    };

    const command = checkCommands[dependency.toLowerCase()];
    if (!command) {
      return { installed: false, version: null, error: '不支持的依赖检查' };
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
      const output = stdout || stderr;

      // 提取版本号
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        installed: true,
        version,
        output
      };
    } catch (error) {
      return {
        installed: false,
        version: null,
        error: error.message
      };
    }
  }

  /**
   * 创建回滚信息
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 回滚信息
   */
  async createRollbackInfo(issue, context) {
    const { dependency, currentVersion } = issue.data;
    
    if (!currentVersion) {
      // 如果是新安装的依赖，卸载即可
      return {
        canRollback: true,
        rollbackSteps: [
          {
            type: 'command',
            description: `卸载 ${dependency}`,
            command: this.getUninstallCommand(dependency)
          }
        ]
      };
    } else {
      // 如果是升级，降级到之前的版本
      return {
        canRollback: true,
        rollbackSteps: [
          {
            type: 'command',
            description: `将 ${dependency} 降级到版本 ${currentVersion}`,
            command: this.getDowngradeCommand(dependency, currentVersion)
          }
        ]
      };
    }
  }

  /**
   * 获取卸载命令
   * @param {string} dependency 依赖名称
   * @returns {string} 卸载命令
   */
  getUninstallCommand(dependency) {
    const platform = process.platform;
    
    if (platform === 'linux') {
      return `sudo apt-get remove -y ${dependency}`;
    } else if (platform === 'darwin') {
      return `brew uninstall ${dependency}`;
    } else if (platform === 'win32') {
      return `choco uninstall ${dependency} -y`;
    }
    
    return null;
  }

  /**
   * 获取降级命令
   * @param {string} dependency 依赖名称
   * @param {string} version 目标版本
   * @returns {string} 降级命令
   */
  getDowngradeCommand(dependency, version) {
    const platform = process.platform;
    
    if (dependency.toLowerCase() === 'node') {
      if (platform === 'linux') {
        return `sudo n ${version}`;
      } else if (platform === 'darwin') {
        return `brew unlink node && brew install node@${version.split('.')[0]} && brew link --force node@${version.split('.')[0]}`;
      }
    }
    
    // 对于其他依赖，回滚比较困难
    return `# 请手动将 ${dependency} 降级到版本 ${version}`;
  }
}

module.exports = DependencyFixer;
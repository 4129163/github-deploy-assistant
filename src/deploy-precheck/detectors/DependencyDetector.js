/**
 * 依赖检测器
 * 检测 Git/Node.js/Python/Docker/Java 等依赖是否安装
 */

const BaseDetector = require('./BaseDetector');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const semver = require('semver');

class DependencyDetector extends BaseDetector {
  constructor() {
    super();
    this.name = 'DependencyDetector';
    this.description = '检测系统依赖是否安装';
    this.priority = 30; // 中优先级
  }

  /**
   * 执行依赖检测
   * @param {Object} context 检测上下文
   * @returns {Promise<Array>} 检测结果
   */
  async detect(context) {
    const issues = [];
    const { project } = context;
    
    if (!project) {
      return issues;
    }

    // 确定需要检测的依赖
    const requiredDeps = this.determineRequiredDependencies(project);
    
    for (const dep of requiredDeps) {
      try {
        const checkResult = await this.checkDependency(dep);
        
        if (!checkResult.installed) {
          issues.push(this.formatIssue({
            type: 'dependency_missing',
            title: `缺少依赖: ${dep.name}`,
            description: `项目需要 ${dep.name} ${dep.minVersion || ''}，但系统中未安装`,
            severity: dep.required ? 'high' : 'medium',
            fixable: true,
            fixType: 'semi-auto',
            fixSteps: this.generateFixSteps(dep),
            data: {
              dependency: dep.name,
              requiredVersion: dep.minVersion,
              description: dep.description,
              required: dep.required,
              installGuide: dep.installGuide
            }
          }));
        } else if (dep.minVersion && !semver.satisfies(checkResult.version, dep.minVersion)) {
          // 版本不满足要求
          issues.push(this.formatIssue({
            type: 'dependency_version_low',
            title: `${dep.name} 版本过低`,
            description: `需要 ${dep.name} >= ${dep.minVersion}，当前版本: ${checkResult.version}`,
            severity: dep.required ? 'high' : 'low',
            fixable: true,
            fixType: 'semi-auto',
            fixSteps: this.generateFixSteps(dep, checkResult.version),
            data: {
              dependency: dep.name,
              requiredVersion: dep.minVersion,
              currentVersion: checkResult.version,
              description: dep.description,
              required: dep.required,
              installGuide: dep.installGuide
            }
          }));
        }
      } catch (error) {
        console.error(`检测依赖 ${dep.name} 时出错:`, error.message);
      }
    }

    return issues;
  }

  /**
   * 根据项目类型确定需要的依赖
   * @param {Object} project 项目信息
   * @returns {Array} 依赖列表
   */
  determineRequiredDependencies(project) {
    const deps = [
      // Git - 所有项目都需要
      {
        name: 'git',
        description: '版本控制工具',
        required: true,
        minVersion: '2.0.0',
        checkCommand: 'git --version',
        versionPattern: /git version (\d+\.\d+\.\d+)/,
        installGuide: {
          linux: 'sudo apt-get install git',
          macos: 'brew install git',
          windows: '下载 Git for Windows: https://git-scm.com/download/win'
        }
      }
    ];

    // 根据项目类型添加特定依赖
    if (project.types) {
      project.types.forEach(type => {
        const typeLower = type.toLowerCase();
        
        switch (typeLower) {
          case 'node':
          case 'react':
          case 'vue':
          case 'next':
          case 'nestjs':
            deps.push({
              name: 'node',
              description: 'Node.js 运行时',
              required: true,
              minVersion: '14.0.0',
              checkCommand: 'node --version',
              versionPattern: /v(\d+\.\d+\.\d+)/,
              installGuide: {
                linux: '使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
                macos: 'brew install node',
                windows: '下载 Node.js: https://nodejs.org/'
              }
            });
            deps.push({
              name: 'npm',
              description: 'Node.js 包管理器',
              required: true,
              minVersion: '6.0.0',
              checkCommand: 'npm --version',
              versionPattern: /(\d+\.\d+\.\d+)/,
              installGuide: {
                linux: '通常随 Node.js 一起安装',
                macos: '通常随 Node.js 一起安装',
                windows: '通常随 Node.js 一起安装'
              }
            });
            break;

          case 'python':
          case 'flask':
          case 'django':
          case 'fastapi':
            deps.push({
              name: 'python',
              description: 'Python 解释器',
              required: true,
              minVersion: '3.7.0',
              checkCommand: 'python3 --version || python --version',
              versionPattern: /Python (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install python3 python3-pip',
                macos: 'brew install python',
                windows: '下载 Python: https://www.python.org/downloads/'
              }
            });
            deps.push({
              name: 'pip',
              description: 'Python 包管理器',
              required: true,
              minVersion: '19.0.0',
              checkCommand: 'pip3 --version || pip --version',
              versionPattern: /pip (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install python3-pip',
                macos: '通常随 Python 一起安装',
                windows: '通常随 Python 一起安装'
              }
            });
            break;

          case 'docker':
            deps.push({
              name: 'docker',
              description: 'Docker 容器运行时',
              required: true,
              minVersion: '20.10.0',
              checkCommand: 'docker --version',
              versionPattern: /Docker version (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh',
                macos: 'brew install --cask docker',
                windows: '下载 Docker Desktop: https://www.docker.com/products/docker-desktop'
              }
            });
            deps.push({
              name: 'docker-compose',
              description: 'Docker Compose',
              required: true,
              minVersion: '2.0.0',
              checkCommand: 'docker-compose --version',
              versionPattern: /docker-compose version (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install docker-compose',
                macos: 'brew install docker-compose',
                windows: '通常随 Docker Desktop 一起安装'
              }
            });
            break;

          case 'java':
          case 'spring':
            deps.push({
              name: 'java',
              description: 'Java 运行时',
              required: true,
              minVersion: '11.0.0',
              checkCommand: 'java -version',
              versionPattern: /version "(\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install openjdk-11-jdk',
                macos: 'brew install openjdk@11',
                windows: '下载 JDK: https://www.oracle.com/java/technologies/downloads/'
              }
            });
            deps.push({
              name: 'maven',
              description: 'Maven 构建工具',
              required: false,
              minVersion: '3.6.0',
              checkCommand: 'mvn --version',
              versionPattern: /Apache Maven (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install maven',
                macos: 'brew install maven',
                windows: '下载 Maven: https://maven.apache.org/download.cgi'
              }
            });
            break;

          case 'go':
            deps.push({
              name: 'go',
              description: 'Go 语言工具链',
              required: true,
              minVersion: '1.17.0',
              checkCommand: 'go version',
              versionPattern: /go version go(\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'sudo apt-get install golang',
                macos: 'brew install go',
                windows: '下载 Go: https://golang.org/dl/'
              }
            });
            break;

          case 'rust':
            deps.push({
              name: 'rust',
              description: 'Rust 工具链',
              required: true,
              minVersion: '1.56.0',
              checkCommand: 'rustc --version',
              versionPattern: /rustc (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
                macos: 'brew install rust',
                windows: '下载 Rust: https://www.rust-lang.org/tools/install'
              }
            });
            deps.push({
              name: 'cargo',
              description: 'Rust 包管理器',
              required: true,
              minVersion: '1.56.0',
              checkCommand: 'cargo --version',
              versionPattern: /cargo (\d+\.\d+\.\d+)/,
              installGuide: {
                linux: '通常随 Rust 一起安装',
                macos: '通常随 Rust 一起安装',
                windows: '通常随 Rust 一起安装'
              }
            });
            break;
        }
      });
    }

    return deps;
  }

  /**
   * 检查依赖是否安装
   * @param {Object} dep 依赖配置
   * @returns {Promise<Object>} 检查结果
   */
  async checkDependency(dep) {
    try {
      const { stdout, stderr } = await execAsync(dep.checkCommand, { timeout: 5000 });
      
      if (stderr && !stdout) {
        return { installed: false, version: null, error: stderr };
      }
      
      const output = stdout || stderr;
      const versionMatch = output.match(dep.versionPattern);
      
      if (versionMatch && versionMatch[1]) {
        return { installed: true, version: versionMatch[1], output };
      } else {
        // 命令执行成功但没有版本信息
        return { installed: true, version: 'unknown', output };
      }
    } catch (error) {
      // 命令执行失败，依赖未安装
      return { installed: false, version: null, error: error.message };
    }
  }

  /**
   * 生成修复步骤
   * @param {Object} dep 依赖配置
   * @param {string} currentVersion 当前版本
   * @returns {Array} 修复步骤
   */
  generateFixSteps(dep, currentVersion = null) {
    const steps = [];
    const platform = process.platform;
    
    // 添加安装指南
    if (dep.installGuide) {
      let installCommand = '';
      
      if (platform === 'linux' && dep.installGuide.linux) {
        installCommand = dep.installGuide.linux;
      } else if (platform === 'darwin' && dep.installGuide.macos) {
        installCommand = dep.installGuide.macos;
      } else if (platform === 'win32' && dep.installGuide.windows) {
        installCommand = dep.installGuide.windows;
      } else if (dep.installGuide.linux) {
        installCommand = dep.installGuide.linux; // 默认使用 Linux 指南
      }
      
      if (installCommand) {
        steps.push({
          type: 'command',
          description: `安装 ${dep.name}`,
          command: installCommand
        });
      }
    }
    
    // 如果是版本问题，添加升级建议
    if (currentVersion) {
      steps.push({
        type: 'suggestion',
        description: `当前版本 ${currentVersion} 不满足要求，需要升级到 ${dep.minVersion} 或更高版本`
      });
    }
    
    // 添加验证步骤
    steps.push({
      type: 'command',
      description: `验证 ${dep.name} 是否安装成功`,
      command: dep.checkCommand
    });
    
    return steps;
  }

  /**
   * 检查是否应该运行此检测器
   * @param {Object} context 检测上下文
   * @returns {boolean}
   */
  shouldRun(context) {
    const { project } = context;
    return project && project.types && project.types.length > 0;
  }
}

module.exports = DependencyDetector;
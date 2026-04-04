#!/usr/bin/env node

/**
 * GADA 安装命令
 * 支持系统服务自动注册
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ServiceManager = require('../../services/service-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class InstallCommand {
  constructor() {
    // 不再使用commander.js，因为我们集成到现有CLI中
  }
  
  /**
   * 安装GADA系统服务
   */
  async execute(options = {}) {
    try {
      console.log(chalk.cyan.bold('🚀 GitHub Deploy Assistant 安装程序\n'));
      
      // 如果没有提供选项，从用户输入获取
      if (Object.keys(options).length === 0) {
        options = await this.promptOptions();
      }
      
      // 检查系统要求
      await this.checkRequirements();
      
      // 检查管理员权限
      if (options.registerService && !await this.hasAdminPrivileges()) {
        console.error(chalk.red('❌ 需要管理员权限注册系统服务'));
        console.log(chalk.yellow('请使用sudo或管理员权限运行此命令'));
        console.log(chalk.yellow('或选择不注册系统服务'));
        return false;
      }
      
      // 安装依赖
      if (!options.skipDeps) {
        await this.installDependencies();
      }
      
      // 创建必要目录
      this.createDirectories(options.installDir);
      
      // 注册系统服务
      if (options.registerService) {
        await this.registerService(options);
      }
      
      // 配置AI
      if (!options.skipAi) {
        await this.configureAI(options.installDir);
      }
      
      // 保存安装信息
      this.saveInstallInfo(options);
      
      // 显示完成信息
      this.showCompletion(options);
      
      return true;
      
    } catch (error) {
      console.error(chalk.red(`❌ 安装失败: ${error.message}`));
      console.error(error.stack);
      return false;
    }
  }
  
  /**
   * 提示用户输入安装选项
   */
  async promptOptions() {
    console.log(chalk.gray('========================================'));
    
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'registerService',
        message: '是否注册为系统服务（支持开机自启和崩溃重启）？',
        default: true
      },
      {
        type: 'input',
        name: 'serviceName',
        message: '服务名称（默认: gada）',
        default: 'gada',
        when: (answers) => answers.registerService
      },
      {
        type: 'input',
        name: 'displayName',
        message: '显示名称（默认: GitHub Deploy Assistant）',
        default: 'GitHub Deploy Assistant',
        when: (answers) => answers.registerService
      },
      {
        type: 'input',
        name: 'installDir',
        message: '安装目录（默认: 当前目录）',
        default: process.cwd()
      },
      {
        type: 'confirm',
        name: 'skipDeps',
        message: '是否跳过依赖安装？',
        default: false
      },
      {
        type: 'confirm',
        name: 'skipAi',
        message: '是否跳过AI配置？',
        default: false
      }
    ]);
    
    return answers;
  }
  
  async execute(options) {
    try {
      console.log('🚀 GitHub Deploy Assistant 安装程序\n');
      
      // 检查系统要求
      await this.checkRequirements();
      
      // 检查管理员权限
      if (!options.noService && !await this.hasAdminPrivileges()) {
        console.error('❌ 需要管理员权限注册系统服务');
        console.log('请使用sudo或管理员权限运行此命令');
        console.log('或使用 --no-service 选项跳过服务注册');
        process.exit(1);
      }
      
      // 安装依赖
      if (!options.skipDeps) {
        await this.installDependencies();
      }
      
      // 创建必要目录
      this.createDirectories(options.installDir);
      
      // 注册系统服务
      if (!options.noService) {
        await this.registerService(options);
      }
      
      // 配置AI
      if (!options.skipAi) {
        await this.configureAI(options.installDir);
      }
      
      // 保存安装信息
      this.saveInstallInfo(options);
      
      // 显示完成信息
      this.showCompletion(options);
      
    } catch (error) {
      console.error(`❌ 安装失败: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
  
  async checkRequirements() {
    console.log('🔍 检查系统环境...');
    
    // 检查Node.js
    try {
      const nodeVersion = execSync('node --version').toString().trim();
      console.log(`✅ Node.js: ${nodeVersion}`);
      
      // 检查版本
      const version = nodeVersion.replace('v', '');
      const majorVersion = parseInt(version.split('.')[0]);
      
      if (majorVersion < 18) {
        throw new Error(`Node.js版本过低 (需要 >= 18.0.0，当前: ${nodeVersion})`);
      }
    } catch (error) {
      throw new Error(`未检测到Node.js: ${error.message}`);
    }
    
    // 检查npm
    try {
      const npmVersion = execSync('npm --version').toString().trim();
      console.log(`✅ npm: ${npmVersion}`);
    } catch (error) {
      throw new Error(`未检测到npm: ${error.message}`);
    }
    
    // 检查Git（可选）
    try {
      const gitVersion = execSync('git --version').toString().trim();
      console.log(`✅ Git: ${gitVersion}`);
    } catch (error) {
      console.log('⚠️  未检测到Git (可选)');
    }
    
    console.log('');
  }
  
  async hasAdminPrivileges() {
    if (os.platform() === 'win32') {
      try {
        const result = execSync(
          'powershell -Command "(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"'
        ).toString().trim();
        return result === 'True';
      } catch {
        return false;
      }
    } else {
      return process.getuid() === 0;
    }
  }
  
  async installDependencies() {
    console.log('📦 安装依赖...');
    
    return new Promise((resolve, reject) => {
      const npm = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
      
      const child = spawn(npm, ['install', '--production'], {
        stdio: 'inherit',
        shell: true
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 依赖安装完成\n');
          resolve();
        } else {
          reject(new Error(`npm install 失败，退出码: ${code}`));
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`启动npm失败: ${error.message}`));
      });
    });
  }
  
  createDirectories(installDir) {
    console.log('📁 创建目录...');
    
    const dirs = [
      'workspace',
      'logs',
      'database',
      'backups'
    ];
    
    dirs.forEach(dir => {
      const dirPath = path.join(installDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  ✅ 创建: ${dir}`);
      }
    });
    
    console.log('');
  }
  
  async registerService(options) {
    console.log('📦 注册系统服务...');
    
    const serviceManager = new ServiceManager({
      serviceName: options.serviceName,
      displayName: options.displayName,
      description: 'GitHub项目自动部署助手，支持多项目类型识别、一键部署、进程守护',
      user: options.user || process.env.USER || process.env.USERNAME,
      workingDir: options.installDir,
      logDir: path.join(options.installDir, 'logs')
    });
    
    try {
      const result = await serviceManager.install();
      console.log(`✅ ${result.message}`);
      
      // 显示平台特定信息
      if (result.commands) {
        console.log('\n🔧 管理命令:');
        Object.entries(result.commands).forEach(([action, cmd]) => {
          console.log(`  • ${action}: ${cmd}`);
        });
      }
      
      console.log('');
      return result;
    } catch (error) {
      throw new Error(`注册服务失败: ${error.message}`);
    }
  }
  
  async configureAI(installDir) {
    console.log('🤖 AI配置（可选）\n');
    
    console.log('GADA支持以下AI提供商:');
    console.log('  1) OpenAI (ChatGPT)');
    console.log('  2) DeepSeek (推荐国内使用)');
    console.log('  3) Google Gemini');
    console.log('  4) Anthropic Claude');
    console.log('  5) 跳过配置\n');
    
    // 在实际实现中，这里会有交互式配置
    // 现在我们先跳过，让用户在.env文件中配置
    
    const envExample = path.join(installDir, '.env.example');
    const envFile = path.join(installDir, '.env');
    
    if (fs.existsSync(envExample) && !fs.existsSync(envFile)) {
      fs.copyFileSync(envExample, envFile);
      console.log('✅ 已创建配置文件: .env');
      console.log('   请在 .env 文件中配置AI密钥\n');
    }
  }
  
  saveInstallInfo(options) {
    const installInfo = {
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      options: options,
      installedAt: new Date().toISOString(),
      serviceRegistered: !options.noService
    };
    
    const infoFile = path.join(options.installDir, '.gada-install.json');
    fs.writeFileSync(infoFile, JSON.stringify(installInfo, null, 2));
    
    console.log(`📝 安装信息已保存: ${infoFile}\n`);
  }
  
  showCompletion(options) {
    console.log('🎉 安装完成！\n');
    
    console.log('📂 安装目录:');
    console.log(`  ${options.installDir}\n`);
    
    console.log('🌐 访问地址:');
    console.log('  http://localhost:3456\n');
    
    if (!options.noService) {
      console.log('📊 服务状态:');
      console.log(`  gada status\n`);
    }
    
    console.log('🔧 常用命令:');
    console.log('  • gada start     - 启动服务');
    console.log('  • gada stop      - 停止服务');
    console.log('  • gada restart   - 重启服务');
    console.log('  • gada status    - 查看状态');
    console.log('  • gada uninstall - 卸载服务\n');
    
    console.log('📚 文档和帮助:');
    console.log('  • 官方文档: https://github.com/4129163/github-deploy-assistant');
    console.log('  • 常见问题: https://github.com/4129163/github-deploy-assistant#常见问题');
    console.log('  • Issues: https://github.com/4129163/github-deploy-assistant/issues\n');
    
    console.log('💡 提示:');
    console.log('  • 配置文件: .env (配置AI密钥等)');
    console.log('  • 日志目录: logs/');
    console.log('  • 项目目录: workspace/\n');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const command = new InstallCommand();
  command.program.parse(process.argv);
}

module.exports = InstallCommand;
#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// 导入服务管理器
const ServiceManager = require('../../services/service-manager').ServiceManager;

/**
 * gada uninstall 命令
 * 用于卸载GADA系统服务
 */
class UninstallCommand {
  constructor() {
    this.program = new Command();
    this.setupCommand();
  }

  setupCommand() {
    this.program
      .name('gada uninstall')
      .description('卸载GADA系统服务')
      .option('-s, --service-name <name>', '服务名称', 'gada')
      .option('-u, --user <user>', '服务运行用户', os.userInfo().username)
      .option('-f, --force', '强制卸载，不询问确认')
      .option('-p, --purge', '同时删除所有配置文件和日志')
      .action(async (options) => {
        await this.execute(options);
      });
  }

  /**
   * 执行卸载操作
   * @param {Object} options 命令行选项
   */
  async execute(options) {
    try {
      console.log(chalk.blue('🔧 开始卸载GADA系统服务...'));
      console.log(chalk.gray(`服务名称: ${options.serviceName}`));
      console.log(chalk.gray(`运行用户: ${options.user}`));

      // 检查权限
      if (os.platform() !== 'win32' && process.getuid() !== 0) {
        console.log(chalk.yellow('⚠️  警告：需要管理员权限来卸载系统服务'));
        console.log(chalk.gray('请使用sudo运行此命令'));
        process.exit(1);
      }

      // 确认操作（除非使用--force）
      if (!options.force) {
        const confirm = await this.promptConfirm('确认要卸载GADA系统服务吗？');
        if (!confirm) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }
      }

      // 创建服务管理器
      const serviceManager = new ServiceManager({
        serviceName: options.serviceName,
        user: options.user
      });

      // 停止服务
      console.log(chalk.blue('🛑 停止服务...'));
      try {
        await serviceManager.stop();
        console.log(chalk.green('✅ 服务已停止'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  停止服务失败，继续卸载'));
      }

      // 卸载服务
      console.log(chalk.blue('🗑️  卸载服务...'));
      await serviceManager.uninstall();
      console.log(chalk.green('✅ 服务已卸载'));

      // 如果指定了--purge，删除相关文件和配置
      if (options.purge) {
        await this.purgeFiles(options);
      }

      console.log(chalk.green.bold('🎉 GADA系统服务卸载完成！'));
      console.log(chalk.gray('如果后续需要重新安装，请运行: gada install'));

    } catch (error) {
      console.error(chalk.red('❌ 卸载失败:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  }

  /**
   * 清理相关文件和配置
   * @param {Object} options 命令行选项
   */
  async purgeFiles(options) {
    console.log(chalk.blue('🧹 清理相关文件和配置...'));

    const platform = os.platform();
    const serviceName = options.serviceName;
    const configDir = path.join(os.homedir(), '.gada');
    const logDir = '/var/log/gada';

    try {
      // 删除配置文件目录
      if (fs.existsSync(configDir)) {
        await fs.remove(configDir);
        console.log(chalk.green(`✅ 已删除配置文件目录: ${configDir}`));
      }

      // 删除日志目录
      if (fs.existsSync(logDir)) {
        await fs.remove(logDir);
        console.log(chalk.green(`✅ 已删除日志目录: ${logDir}`));
      }

      // 平台特定的清理
      switch (platform) {
        case 'linux':
          // 删除systemd服务文件
          const systemdServiceFile = `/etc/systemd/system/${serviceName}.service`;
          if (fs.existsSync(systemdServiceFile)) {
            await fs.remove(systemdServiceFile);
            console.log(chalk.green(`✅ 已删除systemd服务文件: ${systemdServiceFile}`));
          }
          break;

        case 'darwin':
          // 删除launchd plist文件
          const launchdPlistFile = `/Library/LaunchDaemons/com.${serviceName}.plist`;
          if (fs.existsSync(launchdPlistFile)) {
            await fs.remove(launchdPlistFile);
            console.log(chalk.green(`✅ 已删除launchd plist文件: ${launchdPlistFile}`));
          }
          break;

        case 'win32':
          // Windows服务已通过uninstall删除，这里只清理配置文件
          break;
      }

      console.log(chalk.green('✅ 所有相关文件和配置已清理'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  清理文件时出错:'), error.message);
    }
  }

  /**
   * 提示用户确认操作
   * @param {string} message 确认消息
   * @returns {Promise<boolean>} 用户是否确认
   */
  async promptConfirm(message) {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question(`${message} (y/N): `, (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * 运行命令
   */
  run() {
    this.program.parse(process.argv);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const command = new UninstallCommand();
  command.run();
}

module.exports = UninstallCommand;
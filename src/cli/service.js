#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const os = require('os');

// 导入服务管理器
const ServiceManager = require('../../services/service-manager').ServiceManager;

/**
 * gada service 命令
 * 用于管理GADA系统服务（启动、停止、重启、状态）
 */
class ServiceCommand {
  constructor() {
    this.program = new Command();
    this.setupCommand();
  }

  setupCommand() {
    this.program
      .name('gada service')
      .description('管理GADA系统服务')
      .option('-s, --service-name <name>', '服务名称', 'gada')
      .option('-u, --user <user>', '服务运行用户', os.userInfo().username);

    // 子命令：start
    this.program
      .command('start')
      .description('启动GADA服务')
      .action(async () => {
        await this.executeStart(this.program.opts());
      });

    // 子命令：stop
    this.program
      .command('stop')
      .description('停止GADA服务')
      .action(async () => {
        await this.executeStop(this.program.opts());
      });

    // 子命令：restart
    this.program
      .command('restart')
      .description('重启GADA服务')
      .action(async () => {
        await this.executeRestart(this.program.opts());
      });

    // 子命令：status
    this.program
      .command('status')
      .description('查看GADA服务状态')
      .action(async () => {
        await this.executeStatus(this.program.opts());
      });

    // 子命令：enable
    this.program
      .command('enable')
      .description('启用开机自启')
      .action(async () => {
        await this.executeEnable(this.program.opts());
      });

    // 子命令：disable
    this.program
      .command('disable')
      .description('禁用开机自启')
      .action(async () => {
        await this.executeDisable(this.program.opts());
      });

    // 子命令：logs
    this.program
      .command('logs')
      .description('查看服务日志')
      .option('-f, --follow', '实时跟踪日志')
      .option('-n, --lines <number>', '显示最近的行数', '50')
      .action(async (cmdOptions) => {
        await this.executeLogs(this.program.opts(), cmdOptions);
      });
  }

  /**
   * 创建服务管理器实例
   * @param {Object} options 选项
   * @returns {ServiceManager} 服务管理器实例
   */
  createServiceManager(options) {
    return new ServiceManager({
      serviceName: options.serviceName,
      user: options.user
    });
  }

  /**
   * 执行启动命令
   * @param {Object} options 选项
   */
  async executeStart(options) {
    try {
      console.log(chalk.blue('🚀 正在启动GADA服务...'));
      
      const serviceManager = this.createServiceManager(options);
      await serviceManager.start();
      
      console.log(chalk.green('✅ GADA服务启动成功！'));
    } catch (error) {
      console.error(chalk.red('❌ 启动失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行停止命令
   * @param {Object} options 选项
   */
  async executeStop(options) {
    try {
      console.log(chalk.blue('🛑 正在停止GADA服务...'));
      
      const serviceManager = this.createServiceManager(options);
      await serviceManager.stop();
      
      console.log(chalk.green('✅ GADA服务已停止'));
    } catch (error) {
      console.error(chalk.red('❌ 停止失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行重启命令
   * @param {Object} options 选项
   */
  async executeRestart(options) {
    try {
      console.log(chalk.blue('🔄 正在重启GADA服务...'));
      
      const serviceManager = this.createServiceManager(options);
      await serviceManager.restart();
      
      console.log(chalk.green('✅ GADA服务重启成功！'));
    } catch (error) {
      console.error(chalk.red('❌ 重启失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行状态查看命令
   * @param {Object} options 选项
   */
  async executeStatus(options) {
    try {
      console.log(chalk.blue('📊 正在检查GADA服务状态...'));
      
      const serviceManager = this.createServiceManager(options);
      const status = await serviceManager.status();
      
      this.displayStatus(status, options.serviceName);
    } catch (error) {
      console.error(chalk.red('❌ 获取状态失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 显示服务状态
   * @param {Object} status 状态信息
   * @param {string} serviceName 服务名称
   */
  displayStatus(status, serviceName) {
    console.log('\n' + chalk.bold('📋 GADA服务状态报告'));
    console.log(chalk.gray('='.repeat(50)));
    
    // 服务基本信息
    console.log(chalk.bold('服务名称:'), chalk.cyan(serviceName));
    console.log(chalk.bold('平台:'), chalk.cyan(status.platform));
    console.log(chalk.bold('服务类型:'), chalk.cyan(status.serviceType));
    
    // 运行状态
    if (status.isRunning) {
      console.log(chalk.bold('运行状态:'), chalk.green('✅ 运行中'));
      if (status.pid) {
        console.log(chalk.bold('进程ID:'), chalk.cyan(status.pid));
      }
      if (status.uptime) {
        console.log(chalk.bold('运行时间:'), chalk.cyan(status.uptime));
      }
    } else {
      console.log(chalk.bold('运行状态:'), chalk.red('❌ 未运行'));
    }
    
    // 自启状态
    if (status.isEnabled) {
      console.log(chalk.bold('开机自启:'), chalk.green('✅ 已启用'));
    } else {
      console.log(chalk.bold('开机自启:'), chalk.yellow('⚠️  未启用'));
    }
    
    // 守护状态
    if (status.isDaemon) {
      console.log(chalk.bold('进程守护:'), chalk.green('✅ 已启用'));
      console.log(chalk.bold('重启策略:'), chalk.cyan(status.restartPolicy || 'always'));
    } else {
      console.log(chalk.bold('进程守护:'), chalk.yellow('⚠️  未启用'));
    }
    
    // 错误信息
    if (status.error) {
      console.log(chalk.bold('错误信息:'), chalk.red(status.error));
    }
    
    // 最后检查时间
    if (status.lastCheck) {
      console.log(chalk.bold('最后检查:'), chalk.gray(status.lastCheck));
    }
    
    console.log(chalk.gray('='.repeat(50)));
    
    // 建议
    if (!status.isRunning) {
      console.log(chalk.yellow('\n💡 建议: 运行 `gada service start` 启动服务'));
    }
    if (!status.isEnabled) {
      console.log(chalk.yellow('💡 建议: 运行 `gada service enable` 启用开机自启'));
    }
  }

  /**
   * 执行启用开机自启命令
   * @param {Object} options 选项
   */
  async executeEnable(options) {
    try {
      console.log(chalk.blue('🔧 正在启用开机自启...'));
      
      const serviceManager = this.createServiceManager(options);
      await serviceManager.enable();
      
      console.log(chalk.green('✅ 开机自启已启用'));
    } catch (error) {
      console.error(chalk.red('❌ 启用失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行禁用开机自启命令
   * @param {Object} options 选项
   */
  async executeDisable(options) {
    try {
      console.log(chalk.blue('🔧 正在禁用开机自启...'));
      
      const serviceManager = this.createServiceManager(options);
      await serviceManager.disable();
      
      console.log(chalk.green('✅ 开机自启已禁用'));
    } catch (error) {
      console.error(chalk.red('❌ 禁用失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行查看日志命令
   * @param {Object} options 选项
   * @param {Object} cmdOptions 命令选项
   */
  async executeLogs(options, cmdOptions) {
    try {
      console.log(chalk.blue('📝 正在获取服务日志...'));
      
      const serviceManager = this.createServiceManager(options);
      const logs = await serviceManager.getLogs(cmdOptions);
      
      if (logs) {
        console.log('\n' + chalk.bold('📋 GADA服务日志'));
        console.log(chalk.gray('='.repeat(50)));
        console.log(logs);
        console.log(chalk.gray('='.repeat(50)));
      } else {
        console.log(chalk.yellow('⚠️  暂无日志内容'));
      }
    } catch (error) {
      console.error(chalk.red('❌ 获取日志失败:'), error.message);
      process.exit(1);
    }
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
  const command = new ServiceCommand();
  command.run();
}

module.exports = ServiceCommand;
#!/usr/bin/env node
/**
 * 支持容器运行时的部署 CLI
 * 提供完全资源隔离的部署选项
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { deployWithRuntime, getRuntimeOptions } = require('../services/deploy-with-runtime');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

class DeployWithRuntimeCommand {
  constructor() {
    this.program = new Command('deploy');
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .description('部署项目，支持容器运行时')
      .argument('[project-id]', '项目ID（可选）')
      .option('-r, --runtime <type>', '运行时类型：default 或 docker', 'default')
      .option('-p, --port <port>', '项目端口', '3000')
      .option('-e, --env <env>', '环境变量，格式：KEY=VALUE（可多次使用）')
      .option('--list-runtimes', '列出可用的运行时选项')
      .action(async (projectId, options) => {
        await this.execute(projectId, options);
      });
  }

  async execute(projectId, options) {
    try {
      // 如果指定了 --list-runtimes，列出可用选项
      if (options.listRuntimes) {
        await this.listAvailableRuntimes();
        return;
      }

      // 获取项目信息
      const project = await this.getProject(projectId);
      if (!project) {
        console.log(chalk.red('❌ 未找到项目'));
        return;
      }

      // 解析环境变量
      const env = this.parseEnvVariables(options.env);

      // 执行部署
      await this.deployProject(project, {
        runtime: options.runtime,
        port: parseInt(options.port, 10),
        env
      });

    } catch (error) {
      console.log(chalk.red(`❌ 错误: ${error.message}`));
      logger.error('Deploy command error:', error);
      process.exit(1);
    }
  }

  /**
   * 获取项目
   */
  async getProject(projectId) {
    if (projectId) {
      // 通过 ID 查找项目
      return await ProjectDB.get(projectId);
    } else {
      // 如果没有提供 ID，列出项目让用户选择
      const projects = await ProjectDB.getAll();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('⚠️  没有找到项目'));
        return null;
      }

      const { selectedProject } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedProject',
        message: '选择要部署的项目:',
        choices: projects.map(p => ({
          name: `${p.name} (${p.id})`,
          value: p
        }))
      }]);

      return selectedProject;
    }
  }

  /**
   * 解析环境变量
   */
  parseEnvVariables(envInput) {
    const env = {};
    
    if (!envInput) return env;

    // 支持多种输入格式
    const envVars = Array.isArray(envInput) ? envInput : [envInput];
    
    envVars.forEach(envVar => {
      if (envVar && typeof envVar === 'string') {
        const [key, ...valueParts] = envVar.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return env;
  }

  /**
   * 列出可用的运行时选项
   */
  async listAvailableRuntimes() {
    const spinner = ora('检测可用运行时...').start();
    
    try {
      const options = await getRuntimeOptions();
      
      spinner.succeed('可用运行时选项:');
      console.log();
      
      options.forEach(option => {
        console.log(chalk.cyan(`  ${option.value}`));
        console.log(chalk.gray(`    ${option.label}`));
        console.log(chalk.gray(`    ${option.description}`));
        console.log();
      });
      
      console.log(chalk.yellow('使用示例:'));
      console.log(chalk.gray('  gada deploy --runtime=docker --port=3000'));
      console.log(chalk.gray('  gada deploy --runtime=default'));
      
    } catch (error) {
      spinner.fail(`检测运行时失败: ${error.message}`);
    }
  }

  /**
   * 部署项目
   */
  async deployProject(project, options) {
    const spinner = ora(`部署项目: ${project.name}...`).start();
    
    try {
      const result = await deployWithRuntime(project, (progress) => {
        if (spinner.isSpinning) {
          spinner.text = `${progress.message}`;
        }
      }, options);

      if (result.success) {
        spinner.succeed(chalk.green(`✅ 项目部署成功!`));
        
        if (result.runtime === 'docker') {
          console.log();
          console.log(chalk.cyan('📦 容器信息:'));
          console.log(chalk.gray(`  - 容器名称: ${result.containerInfo.name}`));
          console.log(chalk.gray(`  - 镜像标签: ${result.containerInfo.image}`));
          console.log(chalk.gray(`  - 网络: ${result.containerInfo.network}`));
          console.log(chalk.gray(`  - 端口: ${result.containerInfo.port}`));
          console.log(chalk.gray(`  - 状态: ${result.containerInfo.status.status}`));
          
          if (result.containerInfo.status.ports) {
            console.log(chalk.gray(`  - 端口映射: ${result.containerInfo.status.ports}`));
          }
          
          console.log();
          console.log(chalk.yellow('📋 管理命令:'));
          console.log(chalk.gray(`  # 查看容器日志`));
          console.log(chalk.gray(`  docker logs -f ${result.containerInfo.name}`));
          console.log(chalk.gray(`  # 进入容器`));
          console.log(chalk.gray(`  docker exec -it ${result.containerInfo.name} sh`));
          console.log(chalk.gray(`  # 停止容器`));
          console.log(chalk.gray(`  docker stop ${result.containerInfo.name}`));
        }
        
        // 更新项目状态
        await ProjectDB.update(project.id, { 
          status: 'deployed',
          runtime: options.runtime,
          port: options.port,
          containerInfo: result.runtime === 'docker' ? result.containerInfo : null
        });
        
      } else {
        spinner.fail(chalk.red(`❌ 项目部署失败: ${result.error}`));
        
        // 更新项目状态
        await ProjectDB.update(project.id, { 
          status: 'failed',
          error: result.error
        });
      }
      
    } catch (error) {
      spinner.fail(chalk.red(`❌ 部署过程出错: ${error.message}`));
      logger.error('Deploy project error:', error);
      
      // 更新项目状态
      await ProjectDB.update(project.id, { 
        status: 'failed',
        error: error.message
      });
    }
  }

  /**
   * 运行命令
   */
  async run() {
    this.program.parse(process.argv);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const command = new DeployWithRuntimeCommand();
  command.run().catch(error => {
    console.error(chalk.red(`命令执行失败: ${error.message}`));
    process.exit(1);
  });
}

module.exports = DeployWithRuntimeCommand;
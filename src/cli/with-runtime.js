#!/usr/bin/env node
/**
 * GitHub Deploy Assistant (GADA) - 支持容器运行时的 CLI 版本
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const boxen = require('boxen');
const fs = require('fs-extra');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DeployWithRuntimeCommand = require('./deploy-with-runtime');
const { getRuntimeOptions } = require('../services/deploy-with-runtime');
const { analyzeRepository, cloneRepository } = require('../services/github');
const { analyzeRepo, generateDeployScript } = require('../services/ai');
const { initDatabase, ProjectDB } = require('../services/database');
const { RepoAnalyzer } = require('../repo-analyzer');
const { ProjectDoctor } = require('../project-doctor');

const { getWorkspaceDir } = require('../utils/platform-paths');
const WORK_DIR = process.env.WORK_DIR || getWorkspaceDir();

// 打印欢迎信息
function printWelcome() {
  console.log(boxen(
    chalk.cyan.bold('GitHub Deploy Assistant (GADA)') + '\n' +
    chalk.white('智能项目部署助手 v2.0 - 支持容器运行时'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
}

class GadaWithRuntimeCLI {
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('gada')
      .description('GitHub Deploy Assistant - 支持容器运行时的智能部署工具')
      .version('2.0.0-runtime');

    // 部署命令
    const deployCommand = new Command('deploy')
      .description('部署项目，支持容器运行时')
      .argument('[project-id]', '项目ID（可选）')
      .option('-r, --runtime <type>', '运行时类型：default 或 docker', 'default')
      .option('-p, --port <port>', '项目端口', '3000')
      .option('-e, --env <env>', '环境变量，格式：KEY=VALUE（可多次使用）')
      .action(this.handleDeploy.bind(this));

    // 分析命令
    const analyzeCommand = new Command('analyze')
      .description('分析 GitHub 仓库')
      .argument('<url>', 'GitHub 仓库 URL')
      .option('-r, --runtime <type>', '预设运行时类型')
      .action(this.handleAnalyze.bind(this));

    // 运行时命令
    const runtimeCommand = new Command('runtime')
      .description('管理容器运行时')
      .addCommand(new Command('list')
        .description('列出可用的运行时选项')
        .action(this.handleRuntimeList.bind(this)))
      .addCommand(new Command('check')
        .description('检查运行时环境')
        .action(this.handleRuntimeCheck.bind(this)));

    // 项目命令
    const projectCommand = new Command('project')
      .description('项目管理')
      .addCommand(new Command('list')
        .description('列出所有项目')
        .action(this.handleProjectList.bind(this)))
      .addCommand(new Command('info')
        .description('查看项目详情')
        .argument('<id>', '项目ID')
        .action(this.handleProjectInfo.bind(this)));

    // 添加子命令
    this.program
      .addCommand(deployCommand)
      .addCommand(analyzeCommand)
      .addCommand(runtimeCommand)
      .addCommand(projectCommand);

    // 交互模式
    this.program
      .option('-i, --interactive', '进入交互模式')
      .action(this.handleInteractive.bind(this));
  }

  /**
   * 处理部署命令
   */
  async handleDeploy(projectId, options) {
    const deployCommand = new DeployWithRuntimeCommand();
    await deployCommand.execute(projectId, options);
  }

  /**
   * 处理分析命令
   */
  async handleAnalyze(url, options) {
    console.log(chalk.cyan(`🔍 分析仓库: ${url}`));
    
    try {
      // 初始化数据库
      await initDatabase();
      
      // 分析仓库
      const analyzer = new RepoAnalyzer();
      const analysis = await analyzer.analyze(url);
      
      console.log(chalk.green('✅ 分析完成'));
      console.log();
      console.log(chalk.cyan('📊 分析结果:'));
      console.log(chalk.gray(`  - 项目类型: ${analysis.types.join(', ')}`));
      console.log(chalk.gray(`  - 主要文件: ${analysis.mainFiles.join(', ')}`));
      
      if (analysis.dependencies) {
        console.log(chalk.gray(`  - 依赖: ${Object.keys(analysis.dependencies).join(', ')}`));
      }
      
      // 询问是否立即部署
      const { shouldDeploy } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldDeploy',
        message: '是否立即部署此项目?',
        default: true
      }]);
      
      if (shouldDeploy) {
        // 克隆仓库
        console.log(chalk.cyan('📥 克隆仓库...'));
        const { local_path, name } = await cloneRepository(url);
        
        // 创建项目记录
        const project = {
          name,
          url,
          local_path,
          project_type: analysis.types.join(','),
          status: 'analyzed'
        };
        
        const projectId = await ProjectDB.create(project);
        project.id = projectId;
        
        // 选择运行时
        const runtimeOptions = await getRuntimeOptions();
        const { runtime } = await inquirer.prompt([{
          type: 'list',
          name: 'runtime',
          message: '选择运行时:',
          choices: runtimeOptions.map(opt => ({
            name: `${opt.label} - ${opt.description}`,
            value: opt.value
          }))
        }]);
        
        // 部署项目
        const deployCommand = new DeployWithRuntimeCommand();
        await deployCommand.execute(projectId, { runtime, ...options });
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ 分析失败: ${error.message}`));
    }
  }

  /**
   * 处理运行时列表
   */
  async handleRuntimeList() {
    try {
      const options = await getRuntimeOptions();
      
      console.log(chalk.cyan('📦 可用运行时选项:'));
      console.log();
      
      options.forEach(option => {
        console.log(chalk.yellow(`  ${option.value}`));
        console.log(chalk.gray(`    ${option.label}`));
        console.log(chalk.gray(`    ${option.description}`));
        console.log();
      });
      
    } catch (error) {
      console.log(chalk.red(`❌ 获取运行时选项失败: ${error.message}`));
    }
  }

  /**
   * 处理运行时检查
   */
  async handleRuntimeCheck() {
    console.log(chalk.cyan('🔧 检查运行时环境...'));
    
    try {
      const { ContainerRuntimeFactory } = require('../services/deploy-with-runtime');
      const dockerRuntime = ContainerRuntimeFactory.createRuntime({ runtime: 'docker' });
      const status = await dockerRuntime.checkAvailability();
      
      if (status.available) {
        console.log(chalk.green(`✅ Docker: ${status.version}`));
      } else {
        console.log(chalk.red(`❌ Docker: ${status.error}`));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ 检查失败: ${error.message}`));
    }
  }

  /**
   * 处理项目列表
   */
  async handleProjectList() {
    try {
      await initDatabase();
      const projects = await ProjectDB.getAll();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 没有找到项目'));
        return;
      }
      
      console.log(chalk.cyan('📋 项目列表:'));
      console.log();
      
      projects.forEach(project => {
        console.log(chalk.yellow(`  ${project.name}`));
        console.log(chalk.gray(`    ID: ${project.id}`));
        console.log(chalk.gray(`    状态: ${project.status}`));
        console.log(chalk.gray(`    类型: ${project.project_type || '未知'}`));
        
        if (project.runtime) {
          console.log(chalk.gray(`    运行时: ${project.runtime}`));
        }
        
        if (project.port) {
          console.log(chalk.gray(`    端口: ${project.port}`));
        }
        
        console.log();
      });
      
    } catch (error) {
      console.log(chalk.red(`❌ 获取项目列表失败: ${error.message}`));
    }
  }

  /**
   * 处理项目详情
   */
  async handleProjectInfo(id) {
    try {
      await initDatabase();
      const project = await ProjectDB.get(id);
      
      if (!project) {
        console.log(chalk.red('❌ 未找到项目'));
        return;
      }
      
      console.log(chalk.cyan(`📄 项目详情: ${project.name}`));
      console.log();
      console.log(chalk.gray(`  ID: ${project.id}`));
      console.log(chalk.gray(`  名称: ${project.name}`));
      console.log(chalk.gray(`  URL: ${project.url || 'N/A'}`));
      console.log(chalk.gray(`  路径: ${project.local_path}`));
      console.log(chalk.gray(`  类型: ${project.project_type || '未知'}`));
      console.log(chalk.gray(`  状态: ${project.status}`));
      console.log(chalk.gray(`  创建时间: ${project.created_at}`));
      
      if (project.runtime) {
        console.log(chalk.gray(`  运行时: ${project.runtime}`));
      }
      
      if (project.port) {
        console.log(chalk.gray(`  端口: ${project.port}`));
      }
      
      if (project.containerInfo) {
        console.log();
        console.log(chalk.cyan('📦 容器信息:'));
        console.log(chalk.gray(`  - 容器名称: ${project.containerInfo.name}`));
        console.log(chalk.gray(`  - 镜像标签: ${project.containerInfo.image}`));
        console.log(chalk.gray(`  - 网络: ${project.containerInfo.network}`));
        console.log(chalk.gray(`  - 端口: ${project.containerInfo.port}`));
        console.log(chalk.gray(`  - 状态: ${project.containerInfo.status}`));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ 获取项目详情失败: ${error.message}`));
    }
  }

  /**
   * 处理交互模式
   */
  async handleInteractive() {
    printWelcome();
    
    while (true) {
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: '🔗 分析并部署新项目', value: 'analyze' },
          { name: '🚀 部署现有项目', value: 'deploy' },
          { name: '📦 管理容器运行时', value: 'runtime' },
          { name: '📋 查看项目列表', value: 'projects' },
          { name: '👨‍⚕️ 项目医生（问题诊断）', value: 'doctor' },
          { name: '⚙️  配置', value: 'config' },
          { name: '❌ 退出', value: 'exit' }
        ]
      }]);
      
      switch (action) {
        case 'analyze':
          await this.interactiveAnalyze();
          break;
        case 'deploy':
          await this.interactiveDeploy();
          break;
        case 'runtime':
          await this.interactiveRuntime();
          break;
        case 'projects':
          await this.handleProjectList();
          break;
        case 'doctor':
          await this.interactiveDoctor();
          break;
        case 'config':
          await this.interactiveConfig();
          break;
        case 'exit':
          console.log(chalk.green('再见！'));
          return;
      }
      
      console.log();
    }
  }

  /**
   * 交互式分析
   */
  async interactiveAnalyze() {
    const { url } = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: '输入 GitHub 仓库 URL:',
      validate: input => input.trim() ? true : 'URL 不能为空'
    }]);
    
    await this.handleAnalyze(url, {});
  }

  /**
   * 交互式部署
   */
  async interactiveDeploy() {
    try {
      await initDatabase();
      const projects = await ProjectDB.getAll();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 没有找到项目，请先分析一个仓库'));
        return;
      }
      
      const { selectedProject } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedProject',
        message: '选择要部署的项目:',
        choices: projects.map(p => ({
          name: `${p.name} (${p.id}) - ${p.status}`,
          value: p
        }))
      }]);
      
      const runtimeOptions = await getRuntimeOptions();
      const { runtime } = await inquirer.prompt([{
        type: 'list',
        name: 'runtime',
        message: '选择运行时:',
        choices: runtimeOptions.map(opt => ({
          name: `${opt.label}`,
          value: opt.value
        }))
      }]);
      
      const { port } = await inquirer.prompt([{
        type: 'input',
        name: 'port',
        message: '输入端口号:',
        default: '3000'
      }]);
      
      const deployCommand = new DeployWithRuntimeCommand();
      await deployCommand.execute(selectedProject.id, { 
        runtime, 
        port: parseInt(port, 10) 
      });
      
    } catch (error) {
      console.log(chalk.red(`❌ 部署失败: ${error.message}`));
    }
  }

  /**
   * 交互式运行时管理
   */
  async interactiveRuntime() {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '运行时管理:',
      choices: [
        { name: '📋 列出可用运行时', value: 'list' },
        { name: '🔧 检查环境', value: 'check' },
        { name: '↩️  返回', value: 'back' }
      ]
    }]);
    
    switch (action) {
      case 'list':
        await this.handleRuntimeList();
        break;
      case 'check':
        await this.handleRuntimeCheck();
        break;
    }
  }

  /**
   * 交互式项目医生
   */
  async interactiveDoctor() {
    console.log(chalk.yellow('👨‍⚕️ 项目医生功能正在开发中...'));
  }

  /**
   * 交互式配置
   */
  async interactiveConfig() {
    console.log(chalk.yellow('⚙️  配置功能正在开发中...'));
  }

  /**
   * 运行 CLI
   */
  async run() {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cli = new GadaWithRuntimeCLI();
  cli.run().catch(error => {
    console.error(chalk.red(`CLI 执行失败: ${error.message}`));
    process.exit(1);
  });
}

module.exports = GadaWithRuntimeCLI;
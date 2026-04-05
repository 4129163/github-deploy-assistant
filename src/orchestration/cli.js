#!/usr/bin/env node
/**
 * 项目编排CLI命令
 * 提供编排功能的命令行接口
 */

const { program } = require('commander');
const chalk = require('chalk');
const boxen = require('boxen');
const { OrchestrationService } = require('./index');
const path = require('path');
const fs = require('fs-extra');

const service = new OrchestrationService();

// 设置命令行程序
program
  .name('gada orchestrate')
  .description('项目编排功能 - 一键部署组合应用')
  .version('1.0.0');

// deploy命令：执行编排部署
program
  .command('deploy')
  .description('执行编排部署')
  .argument('<config>', '编排配置文件路径或配置内容')
  .option('-o, --output <dir>', '输出目录', './orchestration-output')
  .option('-p, --parallel', '启用并行部署', false)
  .option('-t, --timeout <ms>', '部署超时时间(毫秒)', '300000')
  .option('--dry-run', '模拟运行，不实际部署', false)
  .action(async (config, options) => {
    try {
      console.log(chalk.blue('🚀 开始项目编排部署...'));
      
      if (options.dryRun) {
        console.log(chalk.yellow('🔍 模拟运行模式，不会实际部署'));
      }

      // 解析配置
      console.log(chalk.cyan('📋 解析编排配置...'));
      const parseResult = await service.parseConfig(config);
      
      if (!parseResult.success) {
        console.error(chalk.red('❌ 配置解析失败:'), parseResult.error);
        process.exit(1);
      }

      console.log(chalk.green('✅ 配置解析成功'));
      console.log(chalk.cyan(`📊 应用数量: ${parseResult.config.applications.length}`));
      console.log(chalk.cyan(`🔗 启动顺序: ${parseResult.startupOrder.join(' → ')}`));

      if (parseResult.parallelGroups && parseResult.parallelGroups.length > 0) {
        console.log(chalk.cyan('🔄 可并行启动组:'));
        parseResult.parallelGroups.forEach((group, index) => {
          console.log(chalk.cyan(`   组${index + 1}: ${group.join(', ')}`));
        });
      }

      if (options.dryRun) {
        console.log(chalk.yellow('🏁 模拟运行完成'));
        process.exit(0);
      }

      // 执行部署
      console.log(chalk.blue('🚀 开始部署...'));
      const deployResult = await service.deploy(config, {
        parallel: options.parallel,
        timeout: parseInt(options.timeout, 10)
      });

      if (!deployResult.success) {
        console.error(chalk.red('❌ 部署失败:'), deployResult.error);
        process.exit(1);
      }

      console.log(chalk.green('✅ 部署完成!'));
      console.log(chalk.cyan(`📌 部署ID: ${deployResult.deploymentId}`));
      
      // 显示部署状态
      const state = deployResult.state;
      console.log(chalk.cyan('\n📊 部署状态:'));
      console.log(chalk.cyan(`   状态: ${state.status}`));
      console.log(chalk.cyan(`   开始时间: ${state.startTime}`));
      console.log(chalk.cyan(`   结束时间: ${state.endTime || '进行中'}`));
      
      console.log(chalk.cyan('\n📦 应用状态:'));
      Object.entries(state.applications).forEach(([appName, appState]) => {
        const statusIcon = appState.status === 'running' ? '✅' : 
                          appState.status === 'deployed' ? '✅' : 
                          appState.status === 'failed' ? '❌' : '🔄';
        console.log(chalk.cyan(`   ${statusIcon} ${appName}: ${appState.status}`));
      });

      // 保存部署信息
      const outputDir = path.resolve(options.output);
      await fs.ensureDir(outputDir);
      
      const deployInfo = {
        deploymentId: deployResult.deploymentId,
        config: parseResult.config,
        state: state,
        timestamp: new Date().toISOString()
      };
      
      const infoPath = path.join(outputDir, `${deployResult.deploymentId}.json`);
      await fs.writeJson(infoPath, deployInfo, { spaces: 2 });
      
      console.log(chalk.green(`📁 部署信息已保存到: ${infoPath}`));

      // 显示访问信息
      console.log(chalk.cyan('\n🌐 访问信息:'));
      parseResult.config.applications.forEach(app => {
        if (app.ports && app.ports.length > 0) {
          const port = app.ports[0].split(':')[0];
          console.log(chalk.cyan(`   ${app.name}: http://localhost:${port}`));
        }
      });

    } catch (error) {
      console.error(chalk.red('❌ 部署过程出错:'), error.message);
      process.exit(1);
    }
  });

// status命令：查看部署状态
program
  .command('status')
  .description('查看部署状态')
  .argument('[deploymentId]', '部署ID（不提供则列出所有部署）')
  .action(async (deploymentId) => {
    try {
      if (deploymentId) {
        // 查看单个部署状态
        const statusResult = service.getDeploymentStatus(deploymentId);
        
        if (!statusResult.success) {
          console.error(chalk.red('❌ 获取状态失败:'), statusResult.error);
          process.exit(1);
        }

        const state = statusResult.state;
        
        console.log(boxen(
          chalk.blue(`📊 部署状态: ${deploymentId}`) + '\n\n' +
          chalk.cyan(`名称: ${state.name}`) + '\n' +
          chalk.cyan(`状态: ${state.status}`) + '\n' +
          chalk.cyan(`开始时间: ${state.startTime}`) + '\n' +
          chalk.cyan(`结束时间: ${state.endTime || '进行中'}`) + '\n\n' +
          chalk.yellow('📦 应用状态:'),
          { padding: 1, borderColor: 'blue' }
        ));

        Object.entries(state.applications).forEach(([appName, appState]) => {
          const statusIcon = appState.status === 'running' ? '✅' : 
                            appState.status === 'deployed' ? '✅' : 
                            appState.status === 'failed' ? '❌' : '🔄';
          console.log(chalk.cyan(`   ${statusIcon} ${appName}: ${appState.status}`));
          
          if (appState.error) {
            console.log(chalk.red(`     错误: ${appState.error}`));
          }
        });

      } else {
        // 列出所有部署
        const deployments = service.listDeployments();
        
        if (deployments.length === 0) {
          console.log(chalk.yellow('📭 没有活跃的部署'));
          return;
        }

        console.log(boxen(
          chalk.blue('📋 活跃部署列表'),
          { padding: 1, borderColor: 'blue' }
        ));

        deployments.forEach(deploy => {
          const statusColor = deploy.status === 'completed' ? 'green' : 
                            deploy.status === 'failed' ? 'red' : 'yellow';
          
          console.log(chalk.cyan(`📌 ${deploy.deploymentId}`));
          console.log(chalk[statusColor](`   状态: ${deploy.status}`));
          console.log(chalk.cyan(`   名称: ${deploy.name}`));
          console.log(chalk.cyan(`   开始时间: ${deploy.startTime}`));
          console.log(chalk.cyan(`   应用数量: ${deploy.applications}`));
          console.log('');
        });
      }

    } catch (error) {
      console.error(chalk.red('❌ 获取状态失败:'), error.message);
      process.exit(1);
    }
  });

// logs命令：查看部署日志
program
  .command('logs')
  .description('查看部署日志')
  .argument('<deploymentId>', '部署ID')
  .argument('[appName]', '应用名称（可选）')
  .option('-f, --follow', '实时跟踪日志', false)
  .option('-n, --lines <number>', '显示行数', '50')
  .action(async (deploymentId, appName, options) => {
    try {
      console.log(chalk.blue(`📝 获取部署日志: ${deploymentId}`));
      
      if (appName) {
        console.log(chalk.cyan(`📦 应用: ${appName}`));
      }

      const logsResult = await service.getDeploymentLogs(deploymentId, appName);
      
      if (!logsResult.success) {
        console.error(chalk.red('❌ 获取日志失败:'), logsResult.error);
        process.exit(1);
      }

      if (appName) {
        console.log(boxen(
          chalk.blue(`📝 ${appName} 日志`) + '\n\n' +
          logsResult.logs,
          { padding: 1, borderColor: 'blue' }
        ));
      } else {
        console.log(boxen(
          chalk.blue(`📝 部署日志: ${deploymentId}`),
          { padding: 1, borderColor: 'blue' }
        ));
        
        Object.entries(logsResult.logs).forEach(([appName, log]) => {
          console.log(chalk.cyan(`\n📦 ${appName}:`));
          console.log(log || '无日志');
        });
      }

    } catch (error) {
      console.error(chalk.red('❌ 获取日志失败:'), error.message);
      process.exit(1);
    }
  });

// stop命令：停止部署
program
  .command('stop')
  .description('停止部署')
  .argument('<deploymentId>', '部署ID')
  .action(async (deploymentId) => {
    try {
      console.log(chalk.yellow(`🛑 停止部署: ${deploymentId}`));
      
      const confirm = require('inquirer').createPromptModule();
      const answers = await confirm([
        {
          type: 'confirm',
          name: 'sure',
          message: '确定要停止此部署吗？',
          default: false
        }
      ]);

      if (!answers.sure) {
        console.log(chalk.yellow('⏹️ 已取消停止操作'));
        return;
      }

      const stopResult = await service.stopDeployment(deploymentId);
      
      if (!stopResult.success) {
        console.error(chalk.red('❌ 停止部署失败:'), stopResult.error);
        process.exit(1);
      }

      console.log(chalk.green('✅ 部署已停止'));

    } catch (error) {
      console.error(chalk.red('❌ 停止部署失败:'), error.message);
      process.exit(1);
    }
  });

// validate命令：验证配置文件
program
  .command('validate')
  .description('验证编排配置文件')
  .argument('<config>', '配置文件路径')
  .action(async (configPath) => {
    try {
      console.log(chalk.blue(`🔍 验证配置文件: ${configPath}`));
      
      const validateResult = await service.validateConfigFile(configPath);
      
      if (!validateResult.success) {
        console.error(chalk.red('❌ 验证失败:'), validateResult.error);
        process.exit(1);
      }

      const validation = validateResult.validation;
      
      console.log(boxen(
        chalk.green('✅ 配置文件验证通过') + '\n\n' +
        chalk.cyan(`配置名称: ${validateResult.config.name}`) + '\n' +
        chalk.cyan(`应用数量: ${validateResult.config.applications?.length || 0}`) + '\n' +
        chalk.cyan(`依赖数量: ${validateResult.config.dependencies?.length || 0}`) + '\n\n' +
        chalk.yellow('📊 验证结果:') + '\n' +
        chalk.cyan(`   语法检查: ${validation.syntax}`) + '\n' +
        chalk.cyan(`   依赖检查: ${validation.dependencies}`) + '\n' +
        chalk.cyan(`   启动顺序: ${validation.startupOrder}`) + '\n' +
        chalk.cyan(`   端口冲突: ${validation.portConflicts}`),
        { padding: 1, borderColor: 'green' }
      ));

      if (validation.conflicts && validation.conflicts.length > 0) {
        console.log(chalk.red('\n⚠️  发现端口冲突:'));
        validation.conflicts.forEach(conflict => {
          console.log(chalk.red(`   端口 ${conflict.port} 被多个应用使用: ${conflict.apps.join(', ')}`));
        });
      }

    } catch (error) {
      console.error(chalk.red('❌ 验证失败:'), error.message);
      process.exit(1);
    }
  });

// generate命令：生成示例配置
program
  .command('generate')
  .description('生成示例编排配置')
  .argument('[template]', '模板名称 (lobe-chat-minio, node-redis-postgres)', 'lobe-chat-minio')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (template, options) => {
    try {
      console.log(chalk.blue(`📝 生成示例配置: ${template}`));
      
      const generateResult = await service.generateExample(template, options.output);
      
      if (!generateResult.success) {
        console.error(chalk.red('❌ 生成失败:'), generateResult.error);
        process.exit(1);
      }

      if (options.output) {
        console.log(chalk.green(`✅ 示例配置已保存到: ${options.output}`));
      } else {
        const yaml = require('yaml');
        const content = yaml.stringify(generateResult.config);
        
        console.log(boxen(
          chalk.blue(`📝 示例配置: ${template}`) + '\n\n' +
          content,
          { padding: 1, borderColor: 'blue' }
        ));
      }

    } catch (error) {
      console.error(chalk.red('❌ 生成失败:'), error.message);
      process.exit(1);
    }
  });

// analyze命令：分析依赖关系
program
  .command('analyze')
  .description('分析配置文件的依赖关系')
  .argument('<config>', '配置文件路径')
  .option('-v, --visualize', '生成可视化图表', false)
  .action(async (configPath, options) => {
    try {
      console.log(chalk.blue(`🔬 分析依赖关系: ${configPath}`));
      
      const parseResult = await service.parseConfig(configPath);
      
      if (!parseResult.success) {
        console.error(chalk.red('❌ 分析失败:'), parseResult.error);
        process.exit(1);
      }

      const analysisResult = service.analyzeDependencies(parseResult.config);
      
      if (!analysisResult.success) {
        console.error(chalk.red('❌ 分析失败:'), analysisResult.error);
        process.exit(1);
      }

      const analysis = analysisResult.analysis;
      
      console.log(boxen(
        chalk.green('🔬 依赖关系分析结果') + '\n\n' +
        chalk.cyan(`总节点数: ${analysis.totalNodes}`) + '\n' +
        chalk.cyan(`总边数: ${analysis.totalEdges}`) + '\n' +
        chalk.cyan(`循环依赖: ${analysis.cycles.hasCycles ? '是' : '否'}`) + '\n\n' +
        chalk.yellow('📊 拓扑排序结果:'),
        { padding: 1, borderColor: 'green' }
      ));

      console.log(chalk.cyan(`   ${analysis.topologicalOrder.join(' → ')}`));
      
      if (analysis.parallelGroups && analysis.parallelGroups.length > 0) {
        console.log(chalk.yellow('\n🔄 可并行启动组:'));
        analysis.parallelGroups.forEach((group, index) => {
          console.log(chalk.cyan(`   组${index + 1}: ${group.join(', ')}`));
        });
      }

      if (analysis.cycles.hasCycles) {
        console.log(chalk.red('\n⚠️  发现循环依赖:'));
        analysis.cycles.cycles.forEach((cycle, index) => {
          console.log(chalk.red(`   循环${index + 1}: ${cycle.join(' → ')}`));
        });
      }

      if (options.visualize) {
        console.log(chalk.yellow('\n📈 生成可视化图表...'));
        await generateVisualization(analysis.visualization, parseResult.config.name);
      }

    } catch (error) {
      console.error(chalk.red('❌ 分析失败:'), error.message);
      process.exit(1);
    }
  });

// 生成可视化图表
async function generateVisualization(visualization, name) {
  try {
    const mermaidContent = generateMermaidDiagram(visualization);
    const outputPath = path.join(process.cwd(), `${name}-dependency-graph.mmd`);
    
    await fs.writeFile(outputPath, mermaidContent);
    
    console.log(chalk.green(`✅ 可视化图表已生成: ${outputPath}`));
    console.log(chalk.cyan('   可以使用 Mermaid Live Editor (https://mermaid.live/) 查看图表'));
    
  } catch (error) {
    console.log(chalk.yellow('⚠️  生成可视化图表失败:'), error.message);
  }
}

// 生成Mermaid图表
function generateMermaidDiagram(visualization) {
  let mermaid = 'graph TD\n';
  
  // 添加节点样式
  visualization.nodes.forEach(node => {
    const shape = node.type === 'dependency' ? '((dependency))' : '[(application)]';
    mermaid += `    ${node.id}${shape}\n`;
  });
  
  // 添加边
  visualization.edges.forEach(edge => {
    mermaid += `    ${edge.from} --> ${edge.to}\n`;
  });
  
  return mermaid;
}

// 帮助命令
program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(boxen(
      chalk.blue('🚀 项目编排功能帮助') + '\n\n' +
      chalk.cyan('可用命令:') + '\n' +
      chalk.yellow('  deploy') + '     执行编排部署\n' +
      chalk.yellow('  status') + '    查看部署状态\n' +
      chalk.yellow('  logs') + '     查看部署日志\n' +
      chalk.yellow('  stop') + '     停止部署\n' +
      chalk.yellow('  validate') + '  验证配置文件\n' +
      chalk.yellow('  generate') + '  生成示例配置\n' +
      chalk.yellow('  analyze') + '   分析依赖关系\n' +
      chalk.yellow('  help') + '     显示帮助信息\n\n' +
      chalk.cyan('示例:') + '\n' +
      chalk.gray('  gada orchestrate deploy lobe-chat-minio.yaml\n') +
      chalk.gray('  gada orchestrate status\n') +
      chalk.gray('  gada orchestrate generate -o my-config.yaml\n') +
      chalk.gray('  gada orchestrate analyze my-config.yaml --visualize'),
      { padding: 1, borderColor: 'blue' }
    ));
  });

// 错误处理
program.on('command:*', () => {
  console.error(chalk.red('❌ 错误: 未知命令'));
  console.log(chalk.cyan('使用 gada orchestrate help 查看可用命令'));
  process.exit(1);
});

// 解析命令行参数
if (require.main === module) {
  program.parse(process.argv);
}

module.exports = { program };
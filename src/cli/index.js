#!/usr/bin/env node
/**
 * GitHub Deploy Assistant (GADA) - CLI 版本
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const fs = require('fs-extra');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { analyzeRepository, cloneRepository } = require('../services/github');
const { analyzeRepo, generateDeployScript, answerQuestion, getAvailableProviders } = require('../services/ai');
const { autoDeploy, generateManualGuide, checkEnvironment } = require('../services/deploy');
const { initDatabase, ProjectDB, ConversationDB } = require('../services/database');
const { RepoUploader, PlatformFactory } = require('../repo-uploader');

const WORK_DIR = process.env.WORK_DIR || path.join(__dirname, '../../workspace');

// 打印欢迎信息
function printWelcome() {
  console.log(boxen(
    chalk.cyan.bold('GitHub Deploy Assistant (GADA)') + '\n' +
    chalk.white('智能项目部署助手 v1.0.0'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
}

// 主菜单
async function mainMenu() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '请选择操作:',
    choices: [
      { name: '🔗 分析并部署新项目', value: 'analyze' },
      { name: '📤 本地源码一键上传到托管平台', value: 'upload' },
      { name: '📂 查看已管理项目', value: 'projects' },
      { name: '⚙️  配置 AI 模型', value: 'config' },
      { name: '📋 检查系统环境', value: 'env' },
      { name: '❌ 退出', value: 'exit' }
    ]
  }]);
  
  switch (action) {
    case 'analyze':
      await analyzeNewProject();
      break;
    case 'upload':
      await uploadLocalRepo();
      break;
    case 'projects':
      await viewProjects();
      break;
    case 'config':
      await configAI();
      break;
    case 'env':
      await checkSystemEnv();
      break;
    case 'exit':
      console.log(chalk.green('再见！'));
      process.exit(0);
  }
  
  // 返回主菜单
  console.log('');
  await mainMenu();
}

// 分析新项目
async function analyzeNewProject() {
  const { url } = await inquirer.prompt([{
    type: 'input',
    name: 'url',
    message: '请输入 GitHub 仓库地址:',
    validate: (input) => {
      if (!input) return '地址不能为空';
      if (!input.includes('github.com')) return '请输入有效的 GitHub 地址';
      return true;
    }
  }]);
  
  const spinner = ora('正在分析仓库...').start();
  
  try {
    const analysis = await analyzeRepository(url);
    spinner.succeed('仓库分析完成！');
    
    // 显示分析结果
    console.log('\n' + chalk.cyan.bold('📊 仓库信息:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`📛 名称: ${chalk.white(analysis.info.name)}`);
    console.log(`📝 描述: ${chalk.white(analysis.info.description || '无')}`);
    console.log(`🔧 类型: ${chalk.yellow(analysis.types.join(', '))}`);
    console.log(`⭐ Stars: ${chalk.yellow(analysis.info.stars)}`);
    console.log(`🍴 Forks: ${chalk.yellow(analysis.info.forks)}`);
    console.log(chalk.gray('─'.repeat(50)));
    
    // AI 分析
    const availableProviders = getAvailableProviders();
    if (availableProviders.length > 0) {
      const aiSpinner = ora('正在进行 AI 智能分析...').start();
      try {
        const aiAnalysis = await analyzeRepo(analysis, availableProviders[0].key);
        aiSpinner.succeed('AI 分析完成！');
        console.log('\n' + chalk.cyan.bold('🤖 AI 智能分析:'));
        console.log(aiAnalysis);
      } catch (e) {
        aiSpinner.fail('AI 分析失败: ' + e.message);
      }
    }
    
    // 选择部署模式
    const { mode } = await inquirer.prompt([{
      type: 'list',
      name: 'mode',
      message: '选择部署模式:',
      choices: [
        { name: '📖 手动模式 - 查看详细安装教程', value: 'manual' },
        { name: '🤖 自动模式 - 一键自动部署', value: 'auto' }
      ]
    }]);
    
    // 克隆仓库
    const cloneSpinner = ora('正在克隆仓库...').start();
    
    const projectName = analysis.info.name;
    const localPath = path.join(WORK_DIR, projectName);
    
    await cloneRepository(url, localPath);
    
    // 保存到数据库
    const project = await ProjectDB.create({
      name: projectName,
      repo_url: url,
      local_path: localPath,
      status: 'cloned',
      project_type: analysis.types.join(','),
      config: {
        packageJson: analysis.packageJson,
        envExample: analysis.envExample
      }
    });
    
    cloneSpinner.succeed('仓库克隆完成！');
    
    if (mode === 'manual') {
      await manualDeploy(project, analysis);
    } else {
      await autoDeployProject(project, analysis);
    }
    
  } catch (error) {
    spinner.fail('分析失败: ' + error.message);
  }
}

// 手动部署模式
async function manualDeploy(project, analysis) {
  console.log('\n' + chalk.cyan.bold('📖 正在生成部署指南...'));
  
  project.types = analysis.types;
  
  const guide = await generateManualGuide(project);
  
  console.log('\n' + chalk.green('═'.repeat(60)));
  console.log(chalk.white.bold('  手动部署指南'));
  console.log(chalk.green('═'.repeat(60)));
  console.log(guide);
  console.log(chalk.green('═'.repeat(60)));
  
  // 询问是否需要帮助
  const { needHelp } = await inquirer.prompt([{
    type: 'confirm',
    name: 'needHelp',
    message: '是否需要 AI 助手解答问题?',
    default: false
  }]);
  
  if (needHelp) {
    await chatWithAI(project);
  }
}

// 自动部署模式
async function autoDeployProject(project, analysis) {
  console.log('\n' + chalk.cyan.bold('🤖 开始自动部署...'));
  
  project.types = analysis.types;
  
  try {
    const result = await autoDeploy(project, (progress) => {
      if (progress.type === 'info') {
        console.log(chalk.blue('ℹ '), progress.data.trim());
      } else if (progress.type === 'stdout') {
        process.stdout.write(chalk.gray(progress.data));
      } else if (progress.type === 'stderr') {
        process.stdout.write(chalk.yellow(progress.data));
      }
    });
    
    if (result.success) {
      console.log('\n' + chalk.green('✅ 自动部署成功！'));
    }
    
    await ProjectDB.update(project.id, { status: 'deployed' });
    
  } catch (error) {
    console.log('\n' + chalk.red('❌ 部署失败: ' + error.message));
    await ProjectDB.update(project.id, { status: 'failed' });
    
    // 询问是否需要帮助
    const { needHelp } = await inquirer.prompt([{
      type: 'confirm',
      name: 'needHelp',
      message: '是否需要 AI 助手帮助解决问题?',
      default: true
    }]);
    
    if (needHelp) {
      await chatWithAI(project);
    }
  }
}

// AI 对话
async function chatWithAI(project) {
  console.log('\n' + chalk.cyan.bold('💬 AI 助手 - 输入 "exit" 退出'));
  console.log(chalk.gray('你可以描述遇到的问题，AI 会帮你解答\n'));
  
  while (true) {
    const { question } = await inquirer.prompt([{
      type: 'input',
      name: 'question',
      message: chalk.cyan('你:')
    }]);
    
    if (question.toLowerCase() === 'exit') {
      break;
    }
    
    if (!question.trim()) continue;
    
    const spinner = ora('AI 思考中...').start();
    
    try {
      // 获取历史对话
      const history = await ConversationDB.getByProjectId(project.id);
      const formattedHistory = history.map(h => ({
        role: h.role,
        content: h.content
      }));
      
      const answer = await answerQuestion(project, question, formattedHistory);
      
      spinner.stop();
      console.log(chalk.green('AI: ') + answer + '\n');
      
      // 保存对话
      await ConversationDB.create({
        project_id: project.id,
        role: 'user',
        content: question
      });
      
      await ConversationDB.create({
        project_id: project.id,
        role: 'assistant',
        content: answer
      });
      
    } catch (error) {
      spinner.fail('回答失败: ' + error.message);
    }
  }
}

// 查看项目列表
async function viewProjects() {
  const projects = await ProjectDB.getAll();
  
  if (projects.length === 0) {
    console.log(chalk.yellow('\n暂无管理中的项目\n'));
    return;
  }
  
  console.log('\n' + chalk.cyan.bold('📂 已管理项目:'));
  console.log(chalk.gray('─'.repeat(60)));
  
  const choices = projects.map(p => ({
    name: `${p.name} [${p.status}] - ${p.repo_url}`,
    value: p
  }));
  
  choices.push({ name: '↩  返回', value: null });
  
  const { project } = await inquirer.prompt([{
    type: 'list',
    name: 'project',
    message: '选择项目:',
    choices
  }]);
  
  if (project) {
    await projectDetail(project);
  }
}

// 项目详情
async function projectDetail(project) {
  console.log('\n' + chalk.cyan.bold(`📂 ${project.name}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`仓库: ${chalk.white(project.repo_url)}`);
  console.log(`本地路径: ${chalk.white(project.local_path)}`);
  console.log(`状态: ${chalk.yellow(project.status)}`);
  console.log(`创建时间: ${chalk.white(project.created_at)}`);
  console.log(chalk.gray('─'.repeat(60)));
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '选择操作:',
    choices: [
      { name: '📖 查看部署指南', value: 'guide' },
      { name: '🤖 重新部署', value: 'deploy' },
      { name: '💬 咨询 AI 助手', value: 'chat' },
      { name: '🗑  删除项目', value: 'delete' },
      { name: '↩  返回', value: 'back' }
    ]
  }]);
  
  switch (action) {
    case 'guide':
      project.types = project.project_type ? project.project_type.split(',') : [];
      const guide = await generateManualGuide(project);
      console.log('\n' + guide);
      break;
    case 'deploy':
      project.types = project.project_type ? project.project_type.split(',') : [];
      await autoDeployProject(project, { types: project.types });
      break;
    case 'chat':
      await chatWithAI(project);
      break;
    case 'delete':
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('确定要删除这个项目吗?'),
        default: false
      }]);
      
      if (confirm) {
        await ProjectDB.delete(project.id);
        console.log(chalk.green('项目已删除'));
      }
      break;
  }
}

// 配置 AI
async function configAI() {
  console.log('\n' + chalk.cyan.bold('⚙️  AI 模型配置'));
  console.log(chalk.gray('─'.repeat(60)));
  
  const availableProviders = getAvailableProviders();
  
  if (availableProviders.length > 0) {
    console.log(chalk.green('✅ 已配置的模型:'));
    availableProviders.forEach(p => {
      console.log(`  • ${p.name}`);
    });
  } else {
    console.log(chalk.yellow('⚠️  尚未配置任何 AI 模型'));
  }
  
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.blue('配置说明:'));
  console.log('1. 编辑 .env 文件');
  console.log('2. 添加你的 API Key');
  console.log('3. 重启程序\n');
  
  console.log(chalk.white('需要配置的变量:'));
  console.log('  • OPENAI_API_KEY=sk-...');
  console.log('  • DEEPSEEK_API_KEY=sk-...');
  console.log('  • GEMINI_API_KEY=...');
  console.log('  • CLAUDE_API_KEY=sk-ant-...\n');
}

// 检查系统环境
async function checkSystemEnv() {
  console.log('\n' + chalk.cyan.bold('📋 系统环境检查'));
  console.log(chalk.gray('─'.repeat(60)));
  
  const spinner = ora('检查中...').start();
  const env = await checkEnvironment();
  spinner.succeed('检查完成');
  
  console.log('\n环境信息:');
  console.log(`  平台: ${chalk.white(env.platform)}`);
  console.log(`  架构: ${chalk.white(env.arch)}`);
  console.log();
  
  console.log('依赖检查:');
  console.log(`  Node.js: ${env.node.installed 
    ? chalk.green(`✅ ${env.node.version}`) 
    : chalk.red('❌ 未安装')}`);
  console.log(`  Python: ${env.python.installed 
    ? chalk.green(`✅ ${env.python.version}`) 
    : chalk.red('❌ 未安装')}`);
  console.log(`  Docker: ${env.docker.installed 
    ? chalk.green(`✅ ${env.docker.version}`) 
    : chalk.red('❌ 未安装')}`);
  console.log(`  Git: ${env.git.installed 
    ? chalk.green(`✅ ${env.git.version}`) 
    : chalk.red('❌ 未安装')}`);
  console.log();
  
  if (!env.node.installed) {
    console.log(chalk.yellow('提示: 请先安装 Node.js https://nodejs.org'));
  }
  if (!env.git.installed) {
    console.log(chalk.yellow('提示: 请先安装 Git https://git-scm.com'));
  }
}

// 主函数
async function main() {
  try {
    // 初始化数据库
    await initDatabase();
    
    printWelcome();
    await mainMenu();
    
  } catch (error) {
    console.error(chalk.red('错误:'), error.message);
    process.exit(1);
  }
}

// 运行
main();


// 本地源码一键上传到托管平台
async function uploadLocalRepo() {
  console.log(chalk.cyan.bold('\\n📤 本地源码一键托管上传'));
  console.log(chalk.gray('支持 GitHub/Gitee/GitCode/GitLab 所有主流平台\\n'));

  // 1. 选择平台
  const platforms = PlatformFactory.getSupportedPlatforms();
  const { platformType } = await inquirer.prompt([{
    type: 'list',
    name: 'platformType',
    message: '请选择要上传的托管平台:',
    choices: platforms.map(p => ({ name: `${p.label} (${p.home})`, value: p.value }))
  }]);

  // 2. 输入平台token
  const platformInfo = platforms.find(p => p.value === platformType);
  const { token } = await inquirer.prompt([{
    type: 'input',
    name: 'token',
    message: `请输入${platformInfo.label}的私人令牌(Token):`,
    validate: input => input ? true : 'Token不能为空',
    suffix: chalk.gray(`\\n获取地址: ${platformInfo.tokenHelp}`)
  }]);

  // 3. 验证token
  const spinner = ora('正在验证令牌有效性...').start();
  const uploader = new RepoUploader({
    platformType,
    token
  });

  const isValid = await uploader.validateToken();
  if (!isValid) {
    spinner.fail('令牌无效，请检查后重试');
    return;
  }
  spinner.succeed('令牌验证通过');

  // 4. 选择上传模式
  const { uploadMode } = await inquirer.prompt([{
    type: 'list',
    name: 'uploadMode',
    message: '请选择上传模式:',
    choices: [
      { name: '🔄 上传到已有仓库（指定仓库地址）', value: 'existing' },
      { name: '🆕 自动创建新仓库', value: 'new' }
    ]
  }]);

  let repoUrl = null;
  if (uploadMode === 'existing') {
    const { inputUrl } = await inquirer.prompt([{
      type: 'input',
      name: 'inputUrl',
      message: '请输入已有仓库的Git地址:',
      validate: input => input.startsWith('http') || input.startsWith('git@') ? true : '请输入有效的Git地址'
    }]);
    repoUrl = inputUrl;
  }

  // 5. 输入本地项目路径
  const { projectPath } = await inquirer.prompt([{
    type: 'input',
    name: 'projectPath',
    message: '请输入本地项目文件夹路径:',
    default: process.cwd(),
    validate: async input => {
      if (!await fs.pathExists(input)) return '路径不存在';
      if (!await fs.stat(input).isDirectory()) return '请输入文件夹路径';
      return true;
    }
  }]);

  // 6. 仓库配置
  const repoConfig = await inquirer.prompt([
    ...(uploadMode === 'new' ? [
      {
        type: 'input',
        name: 'repoName',
        message: '请输入仓库名称:',
        default: path.basename(projectPath),
        validate: input => input ? true : '仓库名称不能为空'
      },
      {
        type: 'input',
        name: 'description',
        message: '请输入仓库描述（可选）:'
      },
      {
        type: 'confirm',
        name: 'isPrivate',
        message: '是否设置为私有仓库?',
        default: true
      }
    ] : []),
    {
      type: 'confirm',
      name: 'generateConfig',
      message: '是否自动生成标准仓库配置文件(.gitignore/LICENSE/README.md等)?',
      default: true
    },
    ...(uploadMode === 'new' ? [
      {
        type: 'list',
        name: 'licenseType',
        message: '请选择开源协议:',
        choices: [
          { name: 'MIT (最宽松，商业友好)', value: 'MIT' },
          { name: 'Apache-2.0', value: 'Apache-2.0' },
          { name: 'GPL-3.0', value: 'GPL-3.0' },
          { name: '不选择协议', value: 'none' }
        ],
        when: answers => answers.generateConfig
      }
    ] : []),
    {
      type: 'input',
      name: 'author',
      message: '请输入作者名称:',
      default: 'open-source',
      when: answers => answers.generateConfig
    },
    {
      type: 'confirm',
      name: 'forcePush',
      message: '是否强制覆盖已有仓库内容?',
      default: false
    }
  ]);

  // 7. 开始上传
  spinner.start('正在上传代码到仓库...');
  try {
    const finalRepoUrl = await uploader.upload(projectPath, {
      repoUrl,
      repoName: repoConfig.repoName,
      description: repoConfig.description,
      isPrivate: repoConfig.isPrivate,
      licenseType: repoConfig.licenseType || 'MIT',
      projectType: 'default',
      author: repoConfig.author,
      generateConfig: repoConfig.generateConfig,
      forcePush: repoConfig.forcePush,
      commitMessage: 'Initial commit by GitHub Deploy Assistant'
    });
    spinner.succeed('代码上传成功！');
    console.log(chalk.green.bold('\\n✅ 仓库地址: ' + finalRepoUrl));
    console.log(chalk.cyan('现在你可以直接访问上面的地址查看你的仓库了，所有配置都已经自动生成好了~'));
  } catch (e) {
    spinner.fail('上传失败: ' + e.message);
  }
}

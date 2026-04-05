#!/usr/bin/env node
/**
 * 规则管理器命令行工具
 * 让用户能够轻松管理检测规则
 */

const PluginManager = require('./plugin-manager');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const inquirer = require('inquirer');

// 创建插件管理器实例
const pluginManager = new PluginManager();

// 设置命令行参数
program
  .name('gada-rule-manager')
  .description('GitHub部署助手 - 规则管理工具')
  .version('1.0.0')
  .option('-v, --verbose', '显示详细输出')
  .option('-q, --quiet', '安静模式')
  .option('--plugin-dir <dir>', '指定插件目录');

// 子命令：初始化
program
  .command('init')
  .description('初始化规则管理系统')
  .action(async () => {
    await initializeSystem();
  });

// 子命令：列出规则
program
  .command('list')
  .description('列出所有检测规则')
  .option('-c, --category <category>', '按类别过滤')
  .option('-s, --search <query>', '搜索规则')
  .option('-j, --json', '输出JSON格式')
  .action(async (options) => {
    await listRules(options);
  });

// 子命令：查看规则详情
program
  .command('view <ruleName>')
  .description('查看规则详细信息')
  .action(async (ruleName) => {
    await viewRule(ruleName);
  });

// 子命令：添加规则
program
  .command('add')
  .description('添加新规则（交互式）')
  .action(async () => {
    await addRuleInteractive();
  });

// 子命令：从文件添加规则
program
  .command('add-file <filePath>')
  .description('从JSON文件添加规则')
  .action(async (filePath) => {
    await addRuleFromFile(filePath);
  });

// 子命令：更新规则
program
  .command('update <ruleName>')
  .description('更新现有规则')
  .action(async (ruleName) => {
    await updateRuleInteractive(ruleName);
  });

// 子命令：删除规则
program
  .command('delete <ruleName>')
  .description('删除规则')
  .action(async (ruleName) => {
    await deleteRule(ruleName);
  });

// 子命令：搜索规则
program
  .command('search <query>')
  .description('搜索规则')
  .action(async (query) => {
    await searchRules(query);
  });

// 子命令：导出规则
program
  .command('export <filePath>')
  .description('导出所有规则到文件')
  .action(async (filePath) => {
    await exportRules(filePath);
  });

// 子命令：导入规则
program
  .command('import <filePath>')
  .description('从文件导入规则')
  .action(async (filePath) => {
    await importRules(filePath);
  });

// 子命令：创建模板
program
  .command('template')
  .description('创建规则模板文件')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (options) => {
    await createTemplate(options);
  });

// 子命令：系统信息
program
  .command('info')
  .description('显示规则系统信息')
  .action(async () => {
    await showSystemInfo();
  });

// 如果没有提供子命令，显示帮助
if (process.argv.length <= 2) {
  program.help();
}

// 解析命令行参数
program.parse(process.argv);

/**
 * 初始化系统
 */
async function initializeSystem() {
  console.log('🚀 GitHub部署助手 - 规则管理系统');
  console.log('='.repeat(50));
  
  try {
    await pluginManager.initialize();
    
    const info = pluginManager.getSystemInfo();
    
    console.log('\n✅ 规则管理系统初始化完成！');
    console.log('\n📊 系统信息:');
    console.log(`  • 📁 插件目录: ${info.pluginDir}`);
    console.log(`  • 📋 规则数量: ${info.ruleCount}个`);
    console.log(`  • 🔧 插件数量: ${info.pluginCount}个`);
    console.log(`  • 💻 操作系统: ${info.platform}`);
    console.log(`  • 🟢 Node版本: ${info.nodeVersion}`);
    
    console.log('\n💡 可用命令:');
    console.log('  gada-rule-manager list     列出所有规则');
    console.log('  gada-rule-manager add      添加新规则');
    console.log('  gada-rule-manager search   搜索规则');
    console.log('  gada-rule-manager export   导出规则');
    
    console.log('\n🎯 现在可以开始管理您的检测规则了！');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

/**
 * 列出规则
 */
async function listRules(options) {
  await pluginManager.initialize();
  
  const rules = pluginManager.getRules();
  const ruleNames = Object.keys(rules);
  
  if (options.json) {
    // JSON输出
    console.log(JSON.stringify(rules, null, 2));
    return;
  }
  
  console.log('📜 检测规则列表');
  console.log('='.repeat(60));
  console.log(`总计: ${ruleNames.length} 个规则\n`);
  
  // 按类别分组
  const categories = {};
  ruleNames.forEach(name => {
    const rule = rules[name];
    const category = rule.category || '未分类';
    
    if (!categories[category]) {
      categories[category] = [];
    }
    
    categories[category].push({
      name,
      description: rule.description || '无描述',
      processCount: rule.processNames?.length || 0,
      portCount: rule.defaultPorts?.length || 0
    });
  });
  
  // 显示每个类别的规则
  Object.entries(categories).forEach(([category, items]) => {
    console.log(`📂 ${category} (${items.length}个):`);
    console.log('-'.repeat(40));
    
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}`);
      console.log(`     描述: ${item.description}`);
      console.log(`     进程名: ${item.processCount}个, 端口: ${item.portCount}个`);
    });
    
    console.log('');
  });
  
  // 搜索过滤
  if (options.search) {
    const results = pluginManager.searchRules(options.search);
    if (results.length > 0) {
      console.log(`\n🔍 搜索 "${options.search}" 结果 (${results.length}个):`);
      results.forEach(result => {
        console.log(`  • ${result.name} - ${result.description}`);
      });
    }
  }
}

/**
 * 查看规则详情
 */
async function viewRule(ruleName) {
  await pluginManager.initialize();
  
  const rule = pluginManager.getRule(ruleName);
  
  if (!rule) {
    console.error(`❌ 规则 "${ruleName}" 不存在`);
    process.exit(1);
  }
  
  console.log(`🔍 规则详情: ${ruleName}`);
  console.log('='.repeat(60));
  
  console.log(`📝 描述: ${rule.description || '无描述'}`);
  console.log(`🏷️ 类别: ${rule.category || '未分类'}`);
  console.log(`📊 风险等级: ${rule.riskLevel || '未指定'}`);
  console.log(`🏠 官网: ${rule.website || '未指定'}`);
  console.log(`🔖 标签: ${rule.tags?.join(', ') || '无标签'}`);
  
  console.log('\n🔧 检测特征:');
  console.log(`  • 进程名称: ${rule.processNames?.join(', ') || '无'}`);
  console.log(`  • 命令行参数: ${rule.cmdlinePatterns?.join(', ') || '无'}`);
  console.log(`  • 默认端口: ${rule.defaultPorts?.join(', ') || '无'}`);
  
  console.log('\n📁 目录特征:');
  if (rule.directoryPatterns?.length > 0) {
    rule.directoryPatterns.forEach(dir => {
      console.log(`  • ${dir}`);
    });
  } else {
    console.log('  无');
  }
  
  console.log('\n📄 文件指纹:');
  if (rule.fileFingerprints?.length > 0) {
    rule.fileFingerprints.forEach(fp => {
      console.log(`  • 文件: ${fp.name}`);
      if (fp.contains?.length > 0) {
        console.log(`    包含关键词: ${fp.contains.join(', ')}`);
      }
    });
  } else {
    console.log('  无');
  }
  
  console.log('\n💾 安装命令:');
  if (rule.installationCommands?.length > 0) {
    rule.installationCommands.forEach(cmd => {
      console.log(`  • ${cmd}`);
    });
  } else {
    console.log('  无');
  }
  
  // 显示元数据
  console.log('\n📊 元数据:');
  if (rule.source) console.log(`  • 来源: ${rule.source}`);
  if (rule.created) console.log(`  • 创建时间: ${rule.created}`);
  if (rule.updated) console.log(`  • 更新时间: ${rule.updated}`);
  if (rule.importedAt) console.log(`  • 导入时间: ${rule.importedAt}`);
}

/**
 * 交互式添加规则
 */
async function addRuleInteractive() {
  console.log('➕ 添加新规则（交互式）');
  console.log('='.repeat(50));
  console.log('💡 请按提示输入规则信息，按Ctrl+C取消\n');
  
  await pluginManager.initialize();
  
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '规则名称:',
        validate: input => input.length > 0 || '规则名称不能为空'
      },
      {
        type: 'input',
        name: 'description',
        message: '规则描述:',
        default: '用户自定义规则'
      },
      {
        type: 'input',
        name: 'category',
        message: '规则类别:',
        default: 'custom'
      },
      {
        type: 'input',
        name: 'processNames',
        message: '进程名称（用逗号分隔）:',
        filter: input => input.split(',').map(s => s.trim()).filter(s => s)
      },
      {
        type: 'input',
        name: 'cmdlinePatterns',
        message: '命令行参数（用逗号分隔）:',
        filter: input => input.split(',').map(s => s.trim()).filter(s => s)
      },
      {
        type: 'input',
        name: 'defaultPorts',
        message: '默认端口（用逗号分隔）:',
        filter: input => input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      },
      {
        type: 'input',
        name: 'directoryPatterns',
        message: '目录特征（用逗号分隔）:',
        filter: input => input.split(',').map(s => s.trim()).filter(s => s)
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认添加此规则？',
        default: true
      }
    ]);
    
    if (!answers.confirm) {
      console.log('❌ 添加取消');
      return;
    }
    
    // 创建规则对象
    const ruleData = {
      name: answers.name,
      description: answers.description,
      category: answers.category,
      processNames: answers.processNames,
      cmdlinePatterns: answers.cmdlinePatterns,
      defaultPorts: answers.defaultPorts,
      directoryPatterns: answers.directoryPatterns,
      source: 'user',
      created: new Date().toISOString()
    };
    
    // 验证规则
    const validation = pluginManager.validateRule(ruleData);
    if (!validation.valid) {
      console.error('❌ 规则验证失败:');
      validation.errors.forEach(error => console.error(`  • ${error}`));
      return;
    }
    
    // 添加规则
    const rule = await pluginManager.addRule(answers.name, ruleData);
    
    console.log(`\n✅ 规则 "${answers.name}" 添加成功！`);
    console.log(`📋 规则ID: ${answers.name}`);
    console.log(`📝 描述: ${answers.description}`);
    console.log(`🏷️ 类别: ${answers.category}`);
    console.log(`🔧 特征: ${answers.processNames.length}个进程名, ${answers.defaultPorts.length}个端口`);
    
  } catch (error) {
    if (error.isTtyError) {
      console.error('❌ 交互式界面不可用，请使用命令行参数');
    } else {
      console.error('❌ 添加规则失败:', error.message);
    }
  }
}

/**
 * 从文件添加规则
 */
async function addRuleFromFile(filePath) {
  console.log(`📄 从文件添加规则: ${filePath}`);
  
  try {
    const ruleData = await fs.readJson(filePath);
    
    if (!ruleData.name) {
      console.error('❌ 规则文件必须包含"name"字段');
      process.exit(1);
    }
    
    await pluginManager.initialize();
    
    // 验证规则
    const validation = pluginManager.validateRule(ruleData);
    if (!validation.valid) {
      console.error('❌ 规则验证失败:');
      validation.errors.forEach(error => console.error(`  • ${error}`));
      process.exit(1);
    }
    
    // 添加规则
    const rule = await pluginManager.addRule(ruleData.name, ruleData);
    
    console.log(`✅ 规则 "${ruleData.name}" 从文件添加成功！`);
    console.log(`📝 描述: ${rule.description || '无描述'}`);
    
  } catch (error) {
    console.error('❌ 从文件添加规则失败:', error.message);
    process.exit(1);
  }
}

/**
 * 交互式更新规则
 */
async function updateRuleInteractive(ruleName) {
  console.log(`✏️ 更新规则: ${ruleName}`);
  
  await pluginManager.initialize();
  
  const existingRule = pluginManager.getRule(ruleName);
  if (!existingRule) {
    console.error(`❌ 规则 "${ruleName}" 不存在`);
    process.exit(1);
  }
  
  console.log('💡 当前规则信息:');
  console.log(`  描述: ${existingRule.description}`);
  console.log(`  类别: ${existingRule.category}`);
  console.log(`  进程名: ${existingRule.processNames?.join(', ') || '无'}`);
  console.log('');
  
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: '新描述（留空保持不变）:',
        default: existingRule.description
      },
      {
        type: 'input',
        name: 'category',
        message: '新类别（留空保持不变）:',
        default: existingRule.category
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认更新此规则？',
        default: true
      }
    ]);
    
    if (!answers.confirm) {
      console.log('❌ 更新取消');
      return;
    }
    
    // 准备更新数据
    const updates = {};
    if (answers.description !== existingRule.description) {
      updates.description = answers.description;
    }
    if (answers.category !== existingRule.category) {
      updates.category = answers.category;
    }
    
    if (Object.keys(updates).length === 0) {
      console.log('⚠️ 没有需要更新的内容');
      return;
    }
    
    // 更新规则
    const updatedRule = await pluginManager.updateRule(ruleName, updates);
    
    console.log(`\n✅ 规则 "${ruleName}" 更新成功！`);
    console.log(`📝 新描述: ${updatedRule.description}`);
    console.log(`🏷️ 新类别: ${updatedRule.category}`);
    
  } catch (error) {
    console.error('❌ 更新规则失败:', error.message);
  }
}

/**
 * 删除规则
 */
async function deleteRule(ruleName) {
  console.log(`🗑️ 删除规则: ${ruleName}`);
  
  await pluginManager.initialize();
  
  try {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除规则 "${ruleName}"？`,
        default: false
      }
    ]);
    
    if (!answers.confirm) {
      console.log('❌ 删除取消');
      return;
    }
    
    await pluginManager.deleteRule(ruleName);
    console.log(`✅ 规则 "${ruleName}" 删除成功！`);
    
  } catch (error) {
    console.error('❌ 删除规则失败:', error.message);
  }
}

/**
 * 搜索规则
 */
async function searchRules(query) {
  await pluginManager.initialize();
  
  console.log(`🔍 搜索规则: "${query}"`);
  console.log('='.repeat(50));
  
  const results = pluginManager.searchRules(query);
  
  if (results.length === 0) {
    console.log('❌ 没有找到匹配的规则');
    return;
  }
  
  console.log(`找到 ${results.length} 个匹配的规则:\n`);
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   描述: ${result.description}`);
    console.log(`   类别: ${result.category}`);
    console.log(`   匹配度: ${result.matchScore}分`);
    console.log('');
  });
}

/**
 * 导出规则
 */
async function exportRules(filePath) {
  await pluginManager.initialize();
  
  console.log(`💾 导出规则到: ${filePath}`);
  
  try {
    const success = await pluginManager.exportRules(filePath);
    
    if (success) {
      const stats = await fs.stat(filePath);
      console.log(`✅ 导出成功！文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`📁 文件路径: ${path.resolve(filePath)}`);
    }
    
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
  }
}

/**
 * 导入规则
 */
async function importRules(filePath) {
  console.log(`📥 从文件导入规则: ${filePath}`);
  
  try {
    if (!(await fs.pathExists(filePath))) {
      console.error(`❌ 文件不存在: ${filePath}`);
      process.exit(1);
    }
    
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      console.error('❌ 文件为空');
      process.exit(1);
    }
    
    await pluginManager.initialize();
    
    try {
      const importedCount = await pluginManager.importRules(filePath);
      console.log(`✅ 导入成功！新增 ${importedCount} 个规则`);
    } catch (error) {
      console.error('❌ 导入失败:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 导入失败:', error.message);
  }
}

/**
 * 创建模板文件
 */
async function createTemplate(options) {
  const template = pluginManager.createRuleTemplate();
  const outputPath = options.output || './rule-template.json';
  
  try {
    await fs.writeJson(outputPath, template, { spaces: 2 });
    
    console.log(`✅ 规则模板已创建: ${outputPath}`);
    console.log('\n💡 模板字段说明:');
    console.log('  • name: 规则名称（必填）');
    console.log('  • description: 规则描述');
    console.log('  • category: 规则类别');
    console.log('  • processNames: 进程名称数组');
    console.log('  • cmdlinePatterns: 命令行参数数组');
    console.log('  • defaultPorts: 默认端口数组');
    console.log('  • directoryPatterns: 目录特征数组');
    console.log('  • fileFingerprints: 文件指纹数组');
    console.log('  • tags: 标签数组');
    
    console.log('\n📝 编辑模板后使用以下命令添加规则:');
    console.log(`  gada-rule-manager add-file ${outputPath}`);
    
  } catch (error) {
    console.error('❌ 创建模板失败:', error.message);
  }
}

/**
 * 显示系统信息
 */
async function showSystemInfo() {
  await pluginManager.initialize();
  
  const info = pluginManager.getSystemInfo();
  const rules = pluginManager.getRules();
  
  // 统计信息
  const categories = {};
  Object.values(rules).forEach(rule => {
    const category = rule.category || '未分类';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  console.log('📊 规则管理系统信息');
  console.log('='.repeat(50));
  
  console.log('\n🏠 目录信息:');
  console.log(`  • 插件目录: ${info.pluginDir}`);
  console.log(`  • 规则目录: ${info.rulesDir}`);
  console.log(`  • 初始化状态: ${info.initialized ? '✅ 已初始化' : '❌ 未初始化'}`);
  
  console.log('\n📈 统计信息:');
  console.log(`  • 规则总数: ${info.ruleCount}个`);
  console.log(`  • 插件总数: ${info.pluginCount}个`);
  
  console.log('\n📂 规则分类:');
  Object.entries(categories).forEach(([category, count]) => {
    console.log(`  • ${category}: ${count}个`);
  });
  
  console.log('\n💻 系统信息:');
  console.log(`  • 操作系统: ${info.platform}`);
  console.log(`  • Node版本: ${info.nodeVersion}`);
  
  console.log('\n🚀 可用命令:');
  console.log('  查看所有命令: gada-rule-manager --help');
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\n❌ 发生未预期的错误:');
  console.error(`   错误信息: ${error.message}`);
  console.error('\n💡 建议:');
  console.error('   1. 检查命令参数是否正确');
  console.error('   2. 确保有足够的权限');
  console.error('   3. 查看详细错误日志');
  process.exit(1);
});
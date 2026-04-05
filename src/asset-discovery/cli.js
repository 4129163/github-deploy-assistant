#!/usr/bin/env node
/**
 * 资产发现命令行工具
 * 让编程小白也能轻松使用的系统检测工具
 */

const AssetDiscovery = require('./index');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');

// 设置命令行参数
program
  .name('gada-asset-discovery')
  .description('GitHub部署助手 - 资产发现工具')
  .version('1.0.0')
  .option('-v, --verbose', '显示详细输出')
  .option('-q, --quiet', '安静模式，只输出关键信息')
  .option('-j, --json <file>', '将结果保存为JSON文件')
  .option('-s, --scan-depth <number>', '扫描深度 (1-5)', '3')
  .option('--no-process', '不扫描进程')
  .option('--no-directory', '不扫描目录')
  .option('--no-package', '不扫描包管理器')
  .option('--no-startup', '不扫描启动项')
  .option('--no-system', '不收集系统信息')
  .option('--all', '执行完整扫描（默认）')
  .option('--quick', '快速扫描（只检查关键项目）');

// 添加子命令
program
  .command('scan')
  .description('执行资产发现扫描')
  .action(async (options) => {
    await runScan(program.opts());
  });

program
  .command('health')
  .description('检查系统健康状态')
  .action(async () => {
    await runHealthCheck();
  });

program
  .command('list')
  .description('列出当前运行的非安装式程序')
  .action(async () => {
    await listNonInstalledPrograms();
  });

program
  .command('rules')
  .description('管理检测规则')
  .option('--list', '列出所有规则')
  .option('--add <name>', '添加新规则')
  .option('--remove <name>', '删除规则')
  .action(async (options) => {
    await manageRules(options);
  });

// 如果没有提供子命令，默认执行scan
if (process.argv.length <= 2) {
  process.argv.push('scan');
}

// 解析命令行参数
program.parse(process.argv);

/**
 * 执行资产发现扫描
 */
async function runScan(options) {
  console.log('🚀 GitHub部署助手 - 资产发现工具');
  console.log('='.repeat(50));
  console.log('🤖 正在扫描您的系统...');
  console.log('📝 这个工具会帮助您发现：');
  console.log('  1. ✅ 运行中的智能体程序（如OpenClaw）');
  console.log('  2. ✅ 系统硬件和软件信息');
  console.log('  3. ✅ 环境健康状态');
  console.log('  4. ✅ 潜在问题和建议');
  console.log('');
  console.log('💡 提示：对于编程小白，请仔细阅读每个部分');
  console.log('='.repeat(50) + '\n');

  // 创建资产发现实例
  const discovery = new AssetDiscovery({
    verbose: options.verbose || false,
    scanDepth: parseInt(options.scanDepth),
    includeSystemInfo: options.system !== false,
    includeProcessScan: options.process !== false,
    includeDirectoryScan: options.directory !== false,
    includePackageManagerScan: options.package !== false,
    includeStartupScan: options.startup !== false
  });

  try {
    // 执行扫描
    const results = await discovery.discover();

    // 保存JSON文件
    if (options.json) {
      const filePath = path.resolve(options.json);
      await discovery.saveResults(filePath);
      
      if (!options.quiet) {
        console.log(`\n💾 详细报告已保存到: ${filePath}`);
        console.log('📄 您可以用任何文本编辑器打开这个文件查看详细信息');
      }
    }

    // 生成友好的总结
    generateFriendlySummary(results, options);

  } catch (error) {
    console.error('❌ 扫描失败:', error.message);
    console.log('\n💡 可能的原因：');
    console.log('  1. 权限不足 - 尝试使用管理员/root权限运行');
    console.log('  2. 系统命令不可用 - 请确保系统工具正常');
    console.log('  3. 网络问题 - 检查网络连接');
    process.exit(1);
  }
}

/**
 * 生成友好的总结
 */
function generateFriendlySummary(results, options) {
  if (options.quiet) return;

  console.log('\n' + '✨'.repeat(25));
  console.log('🎯 扫描结果总结');
  console.log('✨'.repeat(25));
  
  // 系统概况
  console.log('\n🏠 您的系统概况:');
  console.log(`  • 💻 电脑类型: ${results.systemInfo.platform === 'win32' ? 'Windows电脑' : 
    results.systemInfo.platform === 'darwin' ? '苹果Mac电脑' : 'Linux电脑'}`);
  console.log(`  • 🧠 处理器: ${results.systemInfo.cpus}个核心`);
  console.log(`  • 💾 内存大小: ${results.systemInfo.totalMemory}`);
  console.log(`  • 📡 网络地址: ${Object.values(results.systemInfo.networkInterfaces || {})[0]?.address || '未知'}`);
  
  // 发现的项目
  const foundPrograms = results.nonInstalledPrograms || [];
  if (foundPrograms.length > 0) {
    console.log('\n🔍 发现了以下智能程序:');
    foundPrograms.forEach((prog, index) => {
      const emoji = prog.confidence === '高' ? '🚨' : '⚠️';
      console.log(`  ${index + 1}. ${emoji} ${prog.program}`);
      console.log(`     检测方式: ${prog.detectedBy.join('、')}`);
      
      // 给小白用户的简单解释
      if (prog.program.includes('OpenClaw') || prog.program.includes('Claw')) {
        console.log(`     💡 这是什么: 一个AI智能体程序，类似机器人助手`);
      } else if (prog.program.includes('AI') || prog.program.includes('Agent')) {
        console.log(`     💡 这是什么: 人工智能程序，可以聊天或执行任务`);
      }
    });
  } else {
    console.log('\n✅ 好消息！没有发现可疑的未知程序');
    console.log('   💡 您的系统看起来干净整洁');
  }
  
  // 给新手的建议
  console.log('\n📚 给新手朋友的提示:');
  console.log('  1. 🌟 发现的"程序"不是病毒，是智能工具');
  console.log('  2. 🔒 如果不知道是什么程序，最好不要删除');
  console.log('  3. 📖 想知道更多？可以搜索程序名称了解');
  console.log('  4. 🆘 需要帮助？截图保存这份报告给懂的朋友看');
  
  // 后续步骤
  console.log('\n🚀 接下来可以做什么:');
  console.log('  1. 运行 "gada-asset-discovery health" 检查系统健康');
  console.log('  2. 运行 "gada-asset-discovery list" 查看运行的程序');
  console.log('  3. 使用 --json 参数保存详细报告');
  
  console.log('\n' + '🎉'.repeat(25));
  console.log('✅ 资产发现完成！希望这个工具对您有帮助！');
  console.log('🎉'.repeat(25));
}

/**
 * 执行健康检查
 */
async function runHealthCheck() {
  console.log('🏥 系统健康检查');
  console.log('='.repeat(40));
  
  const discovery = new AssetDiscovery({
    includeSystemInfo: true,
    includeProcessScan: false,
    includeDirectoryScan: false,
    includePackageManagerScan: false,
    includeStartupScan: false
  });
  
  await discovery.collectSystemInfo();
  const systemInfo = discovery.results.systemInfo;
  
  // 检查CPU负载
  const loadAvg = systemInfo.loadAverage || [0, 0, 0];
  const cpuLoad = (loadAvg[0] / systemInfo.cpus) * 100;
  
  console.log('\n📊 健康检查结果:');
  console.log(`  • 💻 CPU负载: ${cpuLoad.toFixed(1)}% ${cpuLoad > 80 ? '🚨(偏高)' : cpuLoad > 50 ? '⚠️(正常)' : '✅(良好)'}`);
  console.log(`  • 💾 可用内存: ${systemInfo.freeMemory} ${parseFloat(systemInfo.freeMemory) < 1 ? '🚨(偏低)' : '✅(充足)'}`);
  console.log(`  • 🕒 系统运行: ${systemInfo.uptime} ${parseInt(systemInfo.uptime) > 30 ? '⚠️(建议重启)' : '✅(正常)'}`);
  console.log(`  • 🌐 网络连接: ${Object.keys(systemInfo.networkInterfaces || {}).length > 0 ? '✅(正常)' : '🚨(异常)'}`);
  
  // 建议
  console.log('\n💡 健康建议:');
  if (cpuLoad > 80) {
    console.log('  • 关闭不需要的程序，减轻CPU负担');
  }
  if (parseFloat(systemInfo.freeMemory) < 1) {
    console.log('  • 内存不足，考虑关闭浏览器标签页或大程序');
  }
  if (parseInt(systemInfo.uptime) > 30) {
    console.log('  • 系统运行时间较长，建议重启一次');
  }
  
  console.log('\n✅ 健康检查完成！');
}

/**
 * 列出非安装式程序
 */
async function listNonInstalledPrograms() {
  console.log('📋 当前运行的非安装式程序');
  console.log('='.repeat(40));
  
  const discovery = new AssetDiscovery({
    includeSystemInfo: false,
    includeProcessScan: true,
    includeDirectoryScan: true,
    includePackageManagerScan: true,
    includeStartupScan: true
  });
  
  await discovery.scanProcesses();
  await discovery.scanDirectories();
  await discovery.scanPackageManagers();
  await discovery.scanStartupItems();
  
  const programs = discovery.results.nonInstalledPrograms;
  
  if (programs.length === 0) {
    console.log('\n✅ 没有发现非安装式程序');
    console.log('💡 您的系统很干净！');
    return;
  }
  
  // 按程序类型分组
  const grouped = {};
  programs.forEach(prog => {
    if (!grouped[prog.program]) {
      grouped[prog.program] = [];
    }
    grouped[prog.program].push(prog);
  });
  
  console.log('\n🔍 发现以下程序:');
  Object.entries(grouped).forEach(([name, instances], index) => {
    console.log(`\n${index + 1}. ${name}`);
    instances.forEach((instance, i) => {
      console.log(`   ${i + 1}) 检测方式: ${instance.detectedBy.join(', ')}`);
      if (instance.details.pid) {
        console.log(`      进程ID: ${instance.details.pid}, 用户: ${instance.details.user}`);
      }
      if (instance.details.path) {
        console.log(`      路径: ${instance.details.path}`);
      }
    });
  });
  
  console.log('\n📝 总计:');
  console.log(`  • 发现 ${Object.keys(grouped).length} 种不同程序`);
  console.log(`  • 共 ${programs.length} 个检测实例`);
}

/**
 * 管理检测规则
 */
async function manageRules(options) {
  const rulesPath = path.join(__dirname, 'rules/custom-rules.json');
  
  if (options.list) {
    console.log('📜 当前检测规则:');
    
    const discovery = new AssetDiscovery();
    const defaultRules = discovery.programFingerprints;
    
    console.log('\n🔧 内置规则:');
    Object.keys(defaultRules).forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
      console.log(`     进程名: ${defaultRules[name].processNames?.join(', ') || '无'}`);
      console.log(`     默认端口: ${defaultRules[name].defaultPorts?.join(', ') || '无'}`);
    });
    
    // 检查自定义规则
    try {
      if (await fs.pathExists(rulesPath)) {
        const customRules = await fs.readJson(rulesPath);
        console.log('\n🎨 自定义规则:');
        Object.keys(customRules).forEach((name, index) => {
          console.log(`  ${index + 1}. ${name} (自定义)`);
        });
      }
    } catch (error) {
      // 忽略错误
    }
    
  } else if (options.add) {
    console.log('🛠️ 添加自定义规则功能尚未实现');
    console.log('💡 提示: 您可以手动编辑规则文件');
    
  } else if (options.remove) {
    console.log('🗑️ 删除规则功能尚未实现');
    console.log('💡 提示: 您可以手动编辑规则文件');
    
  } else {
    console.log('📖 规则管理命令:');
    console.log('  --list     列出所有规则');
    console.log('  --add      添加新规则（开发中）');
    console.log('  --remove   删除规则（开发中）');
    console.log('\n💡 高级用户可以直接编辑规则文件:');
    console.log(`  文件位置: ${rulesPath}`);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\n❌ 发生未预期的错误:');
  console.error(`   错误信息: ${error.message}`);
  console.error('\n💡 建议:');
  console.error('   1. 检查网络连接');
  console.error('   2. 使用管理员权限运行');
  console.error('   3. 联系技术支持');
  process.exit(1);
});

// 导出函数供其他模块使用
module.exports = {
  runScan,
  runHealthCheck,
  listNonInstalledPrograms,
  manageRules
};
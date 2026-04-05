#!/usr/bin/env node
/**
 * 资产发现功能测试脚本
 * 测试所有新增功能的完整性和可用性
 */

const AssetDiscovery = require('./src/asset-discovery');
const PluginManager = require('./src/asset-discovery/plugins/plugin-manager');
const fs = require('fs-extra');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  verbose: true,
  scanDepth: 2,
  includeSystemInfo: true,
  includeProcessScan: true,
  includeDirectoryScan: true,
  includePackageManagerScan: true,
  includeStartupScan: true,
  includeDeviceInfo: true,
  includeHealthCheck: true,
  usePlugins: true
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(`${status} ${name}`, color);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function runTests() {
  logHeader('GitHub部署助手 - 资产发现功能测试');
  console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`Node版本: ${process.version}`);
  console.log(`平台: ${process.platform} ${process.arch}\n`);
  
  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  // 测试1: 基本模块导入
  logHeader('测试1: 模块导入测试');
  try {
    testResults.total++;
    logTest('AssetDiscovery类导入', true);
    testResults.passed++;
    
    testResults.total++;
    logTest('PluginManager类导入', true);
    testResults.passed++;
    
    log('所有核心模块导入成功！', 'green');
  } catch (error) {
    logTest('模块导入', false, error.message);
    testResults.failed++;
  }

  // 测试2: 插件管理器初始化
  logHeader('测试2: 插件管理器测试');
  try {
    const pluginManager = new PluginManager();
    await pluginManager.initialize();
    
    testResults.total++;
    const rules = pluginManager.getRules();
    const ruleCount = Object.keys(rules).length;
    logTest('插件管理器初始化', ruleCount > 0, `加载 ${ruleCount} 个规则`);
    
    if (ruleCount > 0) {
      testResults.passed++;
      testResults.details.push(`加载规则: ${ruleCount}个`);
      
      // 检查内置规则
      testResults.total++;
      const hasOpenClawRule = 'OpenClaw' in rules;
      logTest('OpenClaw规则存在', hasOpenClawRule);
      if (hasOpenClawRule) testResults.passed++; else testResults.failed++;
    } else {
      logTest('插件管理器初始化', false, '未加载任何规则');
      testResults.failed++;
    }
    
    // 系统信息
    testResults.total++;
    const systemInfo = pluginManager.getSystemInfo();
    const infoValid = systemInfo && typeof systemInfo === 'object';
    logTest('获取系统信息', infoValid);
    if (infoValid) {
      testResults.passed++;
      testResults.details.push(`插件目录: ${systemInfo.pluginDir}`);
    } else {
      testResults.failed++;
    }
    
  } catch (error) {
    logTest('插件管理器测试', false, error.message);
    testResults.failed++;
  }

  // 测试3: 资产发现实例创建
  logHeader('测试3: 资产发现实例测试');
  try {
    const assetDiscovery = new AssetDiscovery(TEST_CONFIG);
    
    testResults.total++;
    const configValid = assetDiscovery.options && typeof assetDiscovery.options === 'object';
    logTest('实例创建', configValid);
    if (configValid) {
      testResults.passed++;
      testResults.details.push(`配置项: ${Object.keys(assetDiscovery.options).length}个`);
    } else {
      testResults.failed++;
    }
    
    testResults.total++;
    const hasDiscoverMethod = typeof assetDiscovery.discover === 'function';
    logTest('discover方法存在', hasDiscoverMethod);
    if (hasDiscoverMethod) testResults.passed++; else testResults.failed++;
    
    testResults.total++;
    const hasSaveResults = typeof assetDiscovery.saveResults === 'function';
    logTest('saveResults方法存在', hasSaveResults);
    if (hasSaveResults) testResults.passed++; else testResults.failed++;
    
  } catch (error) {
    logTest('资产发现实例测试', false, error.message);
    testResults.failed++;
  }

  // 测试4: 快速扫描测试
  logHeader('测试4: 快速功能扫描测试');
  try {
    const quickConfig = {
      ...TEST_CONFIG,
      scanDepth: 1,
      includeProcessScan: false, // 简化测试
      includePackageManagerScan: false,
      includeStartupScan: false
    };
    
    const assetDiscovery = new AssetDiscovery(quickConfig);
    
    log('开始快速扫描测试...', 'yellow');
    const startTime = Date.now();
    
    const results = await assetDiscovery.discover();
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    testResults.total++;
    const resultsValid = results && typeof results === 'object';
    logTest('扫描结果返回', resultsValid, `耗时: ${duration.toFixed(2)}秒`);
    
    if (resultsValid) {
      testResults.passed++;
      
      // 检查结果结构
      testResults.total++;
      const hasTimestamp = results.timestamp && typeof results.timestamp === 'string';
      logTest('结果时间戳', hasTimestamp);
      if (hasTimestamp) testResults.passed++; else testResults.failed++;
      
      testResults.total++;
      const hasSystemInfo = results.systemInfo && typeof results.systemInfo === 'object';
      logTest('系统信息收集', hasSystemInfo);
      if (hasSystemInfo) {
        testResults.passed++;
        testResults.details.push(`系统平台: ${results.systemInfo.platform || '未知'}`);
      } else {
        testResults.failed++;
      }
      
      testResults.total++;
      const hasPrograms = Array.isArray(results.nonInstalledPrograms);
      logTest('非安装式程序数组', hasPrograms);
      if (hasPrograms) testResults.passed++; else testResults.failed++;
      
      // 保存结果测试
      testResults.total++;
      try {
        const savePath = './test-scan-results.json';
        const saved = await assetDiscovery.saveResults(savePath);
        logTest('结果保存功能', saved, `保存到: ${savePath}`);
        if (saved) {
          testResults.passed++;
          // 清理测试文件
          await fs.remove(savePath).catch(() => {});
        } else {
          testResults.failed++;
        }
      } catch (saveError) {
        logTest('结果保存功能', false, saveError.message);
        testResults.failed++;
      }
    } else {
      logTest('扫描结果返回', false, '结果无效');
      testResults.failed++;
    }
    
  } catch (error) {
    logTest('快速扫描测试', false, error.message);
    testResults.failed++;
  }

  // 测试5: 命令行工具测试
  logHeader('测试5: 命令行接口测试');
  try {
    // 检查CLI文件是否存在
    const cliPath = path.join(__dirname, 'src/asset-discovery/cli.js');
    const ruleManagerPath = path.join(__dirname, 'src/asset-discovery/plugins/rule-manager.js');
    
    testResults.total++;
    const cliExists = await fs.pathExists(cliPath);
    logTest('CLI主文件存在', cliExists, cliPath);
    if (cliExists) testResults.passed++; else testResults.failed++;
    
    testResults.total++;
    const ruleManagerExists = await fs.pathExists(ruleManagerPath);
    logTest('规则管理器CLI存在', ruleManagerExists, ruleManagerPath);
    if (ruleManagerExists) testResults.passed++; else testResults.failed++;
    
    // 检查文件可执行性
    if (cliExists) {
      testResults.total++;
      const cliContent = await fs.readFile(cliPath, 'utf8');
      const hasShebang = cliContent.startsWith('#!/usr/bin/env node');
      logTest('CLI文件有正确shebang', hasShebang);
      if (hasShebang) testResults.passed++; else testResults.failed++;
    }
    
  } catch (error) {
    logTest('命令行接口测试', false, error.message);
    testResults.failed++;
  }

  // 测试6: 目录结构验证
  logHeader('测试6: 目录结构验证');
  try {
    const requiredDirs = [
      'src/asset-discovery',
      'src/asset-discovery/detectors',
      'src/asset-discovery/collectors',
      'src/asset-discovery/health',
      'src/asset-discovery/plugins',
      'src/asset-discovery/rules'
    ];
    
    for (const dir of requiredDirs) {
      testResults.total++;
      const dirPath = path.join(__dirname, dir);
      const dirExists = await fs.pathExists(dirPath);
      logTest(`目录 ${dir} 存在`, dirExists);
      if (dirExists) testResults.passed++; else testResults.failed++;
    }
    
    // 检查关键文件
    const requiredFiles = [
      'src/asset-discovery/index.js',
      'src/asset-discovery/cli.js',
      'src/asset-discovery/detectors/process-detector.js',
      'src/asset-discovery/detectors/directory-detector.js',
      'src/asset-discovery/detectors/package-detector.js',
      'src/asset-discovery/collectors/device-collector.js',
      'src/asset-discovery/health/health-checker.js',
      'src/asset-discovery/plugins/plugin-manager.js',
      'src/asset-discovery/plugins/rule-manager.js'
    ];
    
    for (const file of requiredFiles) {
      testResults.total++;
      const filePath = path.join(__dirname, file);
      const fileExists = await fs.pathExists(filePath);
      logTest(`文件 ${file} 存在`, fileExists);
      if (fileExists) testResults.passed++; else testResults.failed++;
    }
    
  } catch (error) {
    logTest('目录结构验证', false, error.message);
    testResults.failed++;
  }

  // 总结报告
  logHeader('测试总结报告');
  console.log(`测试总数: ${testResults.total}`);
  log(`通过: ${testResults.passed}`, 'green');
  log(`失败: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  
  const passRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  console.log(`通过率: ${passRate}%`);
  
  if (testResults.details.length > 0) {
    console.log('\n📋 详细结果:');
    testResults.details.forEach(detail => {
      console.log(`  • ${detail}`);
    });
  }
  
  // 最终建议
  console.log('\n💡 建议与下一步:');
  if (testResults.failed === 0) {
    log('✅ 所有测试通过！功能完整可用。', 'green');
    console.log('  下一步: 可以提交代码到Gitee仓库。');
  } else if (passRate >= 80) {
    log('⚠️ 大部分测试通过，部分功能需要检查。', 'yellow');
    console.log('  建议: 检查失败的功能，修复后重新测试。');
  } else {
    log('❌ 测试失败较多，需要重点修复。', 'red');
    console.log('  建议: 重新检查核心功能实现。');
  }
  
  console.log('\n🚀 可用命令测试:');
  console.log('  1. node test-asset-discovery.js         运行本测试');
  console.log('  2. node src/asset-discovery/cli.js      运行资产发现CLI');
  console.log('  3. node src/asset-discovery/plugins/rule-manager.js 运行规则管理器');
  
  // 退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(error => {
  console.error('❌ 测试运行失败:', error.message);
  console.error(error.stack);
  process.exit(1);
});
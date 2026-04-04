#!/usr/bin/env node
/**
 * 测试修复脚本
 * 验证问题修复是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 GitHub Deploy Assistant 修复测试');
console.log('=' .repeat(50));

async function testFixes() {
  const results = [];
  
  // 1. 检查重复路由定义
  console.log('1. 检查重复路由定义...');
  const repoJs = fs.readFileSync(path.join(__dirname, 'src/routes/repo.js'), 'utf8');
  const analyzeCount = (repoJs.match(/router\.post\('\/analyze'/g) || []).length;
  if (analyzeCount === 1) {
    console.log('   ✅ 重复路由定义已修复');
    results.push({ test: '重复路由定义', status: 'PASS' });
  } else {
    console.log(`   ❌ 发现 ${analyzeCount} 个重复路由定义`);
    results.push({ test: '重复路由定义', status: 'FAIL' });
  }
  
  // 2. 检查重复挂载
  console.log('2. 检查重复挂载...');
  const serverJs = fs.readFileSync(path.join(__dirname, 'src/server/index.js'), 'utf8');
  const updateRoutesCount = (serverJs.match(/app\.use\('\/api\/update'/g) || []).length;
  if (updateRoutesCount === 1) {
    console.log('   ✅ 重复挂载已修复');
    results.push({ test: '重复挂载', status: 'PASS' });
  } else {
    console.log(`   ❌ 发现 ${updateRoutesCount} 个重复挂载`);
    results.push({ test: '重复挂载', status: 'FAIL' });
  }
  
  // 3. 检查私有仓库加密安全性
  console.log('3. 检查私有仓库加密安全性...');
  const privateRepoJs = fs.readFileSync(path.join(__dirname, 'src/services/private-repo.js'), 'utf8');
  if (privateRepoJs.includes('logger.warn') && privateRepoJs.includes('GADA_SECRET_KEY')) {
    console.log('   ✅ 私有仓库加密安全性警告已添加');
    results.push({ test: '私有仓库加密安全性', status: 'PASS' });
  } else {
    console.log('   ❌ 私有仓库加密安全性警告未添加');
    results.push({ test: '私有仓库加密安全性', status: 'FAIL' });
  }
  
  // 4. 检查GitHub API并发控制
  console.log('4. 检查GitHub API并发控制...');
  const githubJs = fs.readFileSync(path.join(__dirname, 'src/services/github.js'), 'utf8');
  if (githubJs.includes('Promise.all') && githubJs.includes('analyzeRepository')) {
    console.log('   ✅ GitHub API并发控制已优化');
    results.push({ test: 'GitHub API并发控制', status: 'PASS' });
  } else {
    console.log('   ❌ GitHub API并发控制未优化');
    results.push({ test: 'GitHub API并发控制', status: 'FAIL' });
  }
  
  // 5. 检查Webhook HMAC签名验证
  console.log('5. 检查Webhook HMAC签名验证...');
  const webhookJs = fs.readFileSync(path.join(__dirname, 'src/routes/webhook.js'), 'utf8');
  if (webhookJs.includes('verifyGitHubSignature') && webhookJs.includes('x-hub-signature-256')) {
    console.log('   ✅ Webhook HMAC签名验证已添加');
    results.push({ test: 'Webhook HMAC签名验证', status: 'PASS' });
  } else {
    console.log('   ❌ Webhook HMAC签名验证未添加');
    results.push({ test: 'Webhook HMAC签名验证', status: 'FAIL' });
  }
  
  // 6. 检查跨平台压缩工具
  console.log('6. 检查跨平台压缩工具...');
  if (fs.existsSync(path.join(__dirname, 'src/utils/archive.js'))) {
    console.log('   ✅ 跨平台压缩工具已添加');
    results.push({ test: '跨平台压缩工具', status: 'PASS' });
  } else {
    console.log('   ❌ 跨平台压缩工具未添加');
    results.push({ test: '跨平台压缩工具', status: 'FAIL' });
  }
  
  // 7. 检查依赖包
  console.log('7. 检查依赖包...');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const hasArchiver = packageJson.dependencies.archiver !== undefined;
  const hasExtractZip = packageJson.dependencies['extract-zip'] !== undefined;
  
  if (hasArchiver && hasExtractZip) {
    console.log('   ✅ 依赖包已添加 (archiver, extract-zip)');
    results.push({ test: '依赖包', status: 'PASS' });
  } else {
    console.log(`   ❌ 依赖包缺失: archiver=${hasArchiver}, extract-zip=${hasExtractZip}`);
    results.push({ test: '依赖包', status: 'FAIL' });
  }
  
  // 8. 检查配置更新
  console.log('8. 检查配置更新...');
  const configJs = fs.readFileSync(path.join(__dirname, 'src/config.js'), 'utf8');
  const hasLogCacheSize = configJs.includes('LOG_CACHE_SIZE');
  const hasProcessRestartConfig = configJs.includes('PROCESS_RESTART');
  
  if (hasLogCacheSize && hasProcessRestartConfig) {
    console.log('   ✅ 配置已更新');
    results.push({ test: '配置更新', status: 'PASS' });
  } else {
    console.log(`   ❌ 配置未完整更新: LOG_CACHE_SIZE=${hasLogCacheSize}, PROCESS_RESTART=${hasProcessRestartConfig}`);
    results.push({ test: '配置更新', status: 'FAIL' });
  }
  
  // 总结
  console.log('\n' + '=' .repeat(50));
  console.log('📊 测试结果汇总:');
  const passed = results.filter(r => r.status === 'PASS').length;
  const total = results.length;
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.test}: ${r.status}`);
  });
  
  console.log(`\n🎯 通过率: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log('\n🎉 所有修复测试通过！');
    return 0;
  } else {
    console.log(`\n⚠️  有 ${total-passed} 个测试未通过，请检查修复`);
    return 1;
  }
}

testFixes().then(code => {
  process.exit(code);
}).catch(err => {
  console.error('测试出错:', err);
  process.exit(1);
});
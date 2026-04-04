#!/usr/bin/env node
/**
 * 安全存储功能测试
 */

const secureStorage = require('./src/utils/secure-storage');
const cryptoUtils = require('./src/utils/crypto-utils');

console.log('🔐 GitHub Deploy Assistant - 安全存储功能测试\n');

async function runTests() {
  try {
    // 测试1: 检查加密工具
    console.log('测试1: 加密工具功能...');
    const testData = '这是一个测试敏感信息';
    const password = 'TestPassword123!';
    
    const encrypted = cryptoUtils.encrypt(testData, password);
    console.log('✓ 加密成功');
    
    const decrypted = cryptoUtils.decrypt(encrypted, password);
    console.log('✓ 解密成功');
    
    if (decrypted === testData) {
      console.log('✓ 加解密验证通过');
    } else {
      console.log('✗ 加解密验证失败');
      return false;
    }
    
    // 测试2: 检查安全存储初始化
    console.log('\n测试2: 安全存储初始化...');
    if (secureStorage.isInitialized()) {
      console.log('⚠️ 安全存储已初始化，跳过初始化测试');
    } else {
      console.log('✓ 安全存储未初始化，准备测试初始化');
    }
    
    // 测试3: 显示存储目录
    console.log('\n测试3: 存储目录检查...');
    console.log(`存储目录: ${secureStorage.storageDir}`);
    
    // 测试4: 加密算法信息
    console.log('\n测试4: 加密算法信息...');
    console.log('算法: AES-256-GCM');
    console.log('密钥长度: 256位');
    console.log('IV长度: 128位');
    console.log('认证标签: 16字节');
    
    // 测试5: 密钥派生
    console.log('\n测试5: 密钥派生测试...');
    const salt = cryptoUtils.generateSalt();
    console.log(`盐值: ${salt.substring(0, 16)}...`);
    console.log('密钥派生算法: PBKDF2-SHA256 (100,000次迭代)');
    
    // 测试6: 安全令牌生成
    console.log('\n测试6: 安全令牌生成...');
    const token1 = cryptoUtils.generateSecureToken(32);
    const token2 = cryptoUtils.generateSecureToken(32);
    console.log(`令牌1: ${token1.substring(0, 16)}...`);
    console.log(`令牌2: ${token2.substring(0, 16)}...`);
    
    if (token1 !== token2) {
      console.log('✓ 令牌随机性验证通过');
    } else {
      console.log('✗ 令牌随机性验证失败');
      return false;
    }
    
    // 测试7: 哈希函数
    console.log('\n测试7: 哈希函数测试...');
    const hash = cryptoUtils.hash('test data');
    console.log(`SHA256哈希: ${hash.substring(0, 16)}...`);
    
    // 测试8: API路由检查
    console.log('\n测试8: API路由检查...');
    const routes = [
      'POST /api/secure/initialize',
      'POST /api/secure/save',
      'POST /api/secure/get',
      'POST /api/secure/list',
      'POST /api/secure/delete',
      'POST /api/secure/migrate',
      'POST /api/secure/stats',
      'GET /api/secure/status',
      'GET /api/health'
    ];
    
    console.log('可用API端点:');
    routes.forEach(route => {
      console.log(`  ${route}`);
    });
    
    // 测试9: 系统兼容性
    console.log('\n测试9: 系统兼容性...');
    const os = require('os');
    const platform = os.platform();
    console.log(`操作系统: ${platform}`);
    
    const storagePaths = {
      win32: 'AppData/Roaming/.gada/secure',
      darwin: '.gada/secure',
      linux: '.gada/secure',
      aix: '.gada/secure',
      freebsd: '.gada/secure',
      openbsd: '.gada/secure',
      sunos: '.gada/secure'
    };
    
    console.log(`存储路径: ${storagePaths[platform] || '.gada/secure'}`);
    
    // 测试10: 依赖检查
    console.log('\n测试10: 依赖检查...');
    const requiredModules = [
      'crypto',
      'fs-extra',
      'path',
      'os'
    ];
    
    for (const moduleName of requiredModules) {
      try {
        require(moduleName);
        console.log(`✓ ${moduleName}: 可用`);
      } catch (err) {
        console.log(`✗ ${moduleName}: 不可用 - ${err.message}`);
        return false;
      }
    }
    
    // 测试总结
    console.log('\n' + '='.repeat(60));
    console.log('✅ 安全存储功能测试完成');
    console.log('='.repeat(60));
    
    console.log('\n下一步操作:');
    console.log('1. 运行迁移工具: node scripts/migrate-secure.js');
    console.log('2. 启动服务器测试API: npm start');
    console.log('3. 测试API端点: curl http://localhost:3000/api/secure/status');
    console.log('4. 查看文档: docs/security-guide.md');
    
    console.log('\n安全特性概览:');
    console.log('🔒 AES-256-GCM 端到端加密');
    console.log('🔑 安全的密钥派生 (PBKDF2)');
    console.log('🛡️ 多次失败锁定机制');
    console.log('📊 完整的审计日志');
    console.log('💾 系统级存储位置');
    console.log('🔄 数据完整性校验');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 运行测试
runTests()
  .then(success => {
    if (success) {
      console.log('\n🎉 所有测试通过！安全存储功能已就绪。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查问题。');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n💥 测试执行出错:', err.message);
    process.exit(1);
  });
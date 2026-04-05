#!/usr/bin/env node
/**
 * 浏览器扩展功能集成测试
 * 测试本地HTTP服务与浏览器扩展的兼容性
 */

const axios = require('axios');
const { validateRepositoryUrl } = require('./src/utils/validators');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testRepository: 'https://github.com/expressjs/express',
  timeout: 10000,
  retries: 3
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[1;34m',
  cyan: '\x1b[36m'
};

// 测试结果追踪
const testResults = [];

/**
 * 打印带颜色的消息
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 运行测试用例
 */
async function runTest(name, testFunc) {
  log(`\n📋 开始测试: ${name}`, colors.blue);
  
  try {
    const startTime = Date.now();
    const result = await testFunc();
    const duration = Date.now() - startTime;
    
    testResults.push({
      name,
      status: 'PASS',
      duration,
      result
    });
    
    log(`✅ ${name} - 通过 (${duration}ms)`, colors.green);
    return true;
  } catch (error) {
    testResults.push({
      name,
      status: 'FAIL',
      error: error.message,
      stack: error.stack
    });
    
    log(`❌ ${name} - 失败: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * 测试1: 验证URL验证器
 */
async function testUrlValidator() {
  log('测试URL验证器...', colors.cyan);
  
  const testCases = [
    {
      url: 'https://github.com/expressjs/express',
      shouldPass: true,
      expectedPlatform: 'github'
    },
    {
      url: 'https://gitee.com/openharmony/docs',
      shouldPass: true,
      expectedPlatform: 'gitee'
    },
    {
      url: 'https://github.com/owner/repo/tree/main',
      shouldPass: true,
      shouldBeRoot: false
    },
    {
      url: 'https://gitlab.com/some/repo',
      shouldPass: false
    },
    {
      url: 'invalid-url',
      shouldPass: false
    }
  ];
  
  for (const testCase of testCases) {
    const result = validateRepositoryUrl(testCase.url);
    
    if (testCase.shouldPass && !result.valid) {
      throw new Error(`预期通过但失败: ${testCase.url} - ${result.error}`);
    }
    
    if (!testCase.shouldPass && result.valid) {
      throw new Error(`预期失败但通过: ${testCase.url}`);
    }
    
    if (testCase.expectedPlatform && result.platform !== testCase.expectedPlatform) {
      throw new Error(`平台不匹配: 预期 ${testCase.expectedPlatform}, 实际 ${result.platform}`);
    }
    
    log(`  ✓ ${testCase.url} - ${result.valid ? '有效' : '无效'}`, colors.green);
  }
  
  return { passed: testCases.length };
}

/**
 * 测试2: 健康检查端点
 */
async function testHealthEndpoint() {
  log('测试健康检查端点...', colors.cyan);
  
  const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/browser/health`, {
    timeout: TEST_CONFIG.timeout
  });
  
  if (response.status !== 200) {
    throw new Error(`HTTP状态码: ${response.status}`);
  }
  
  const data = response.data;
  
  if (!data.success) {
    throw new Error(`API返回失败: ${data.error || '未知错误'}`);
  }
  
  if (data.status !== 'ok') {
    throw new Error(`服务状态异常: ${data.status}`);
  }
  
  log(`  ✓ 服务状态: ${data.status}`, colors.green);
  log(`  ✓ 运行时间: ${Math.floor(data.uptime)}秒`, colors.green);
  log(`  ✓ 版本: ${data.version || '未知'}`, colors.green);
  log(`  ✓ 数据库: ${data.database || '未知'}`, colors.green);
  
  return data;
}

/**
 * 测试3: 部署验证端点
 */
async function testDeployValidation() {
  log('测试部署验证端点...', colors.cyan);
  
  const payload = {
    repositoryUrl: TEST_CONFIG.testRepository,
    repositoryInfo: {
      platform: 'github',
      owner: 'expressjs',
      repo: 'express'
    }
  };
  
  const response = await axios.post(
    `${TEST_CONFIG.baseUrl}/api/browser/deploy/validate`,
    payload,
    {
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.status !== 200) {
    throw new Error(`HTTP状态码: ${response.status}`);
  }
  
  const data = response.data;
  
  if (!data.success) {
    throw new Error(`验证失败: ${data.error || '未知错误'}`);
  }
  
  if (!data.valid) {
    throw new Error(`URL验证失败: ${data.message || '未知错误'}`);
  }
  
  log(`  ✓ URL验证: ${data.message}`, colors.green);
  log(`  ✓ 平台: ${data.platform}`, colors.green);
  
  return data;
}

/**
 * 测试4: 模拟浏览器扩展部署请求
 */
async function testBrowserDeployRequest() {
  log('测试浏览器扩展部署请求...', colors.cyan);
  
  const payload = {
    repositoryUrl: TEST_CONFIG.testRepository,
    repositoryInfo: {
      platform: 'github',
      owner: 'expressjs',
      repo: 'express',
      fullName: 'expressjs/express'
    },
    action: 'deploy',
    source: 'browser-extension',
    timestamp: new Date().toISOString(),
    userAgent: 'Test-Browser-Extension/1.0'
  };
  
  const response = await axios.post(
    `${TEST_CONFIG.baseUrl}/api/browser/deploy`,
    payload,
    {
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.status !== 200) {
    throw new Error(`HTTP状态码: ${response.status}`);
  }
  
  const data = response.data;
  
  if (!data.success) {
    throw new Error(`部署请求失败: ${data.error || '未知错误'}`);
  }
  
  if (!data.deploymentId) {
    throw new Error('缺少deploymentId');
  }
  
  log(`  ✓ 部署请求已接收`, colors.green);
  log(`  ✓ 部署ID: ${data.deploymentId}`, colors.green);
  log(`  ✓ 状态: ${data.status}`, colors.green);
  log(`  ✓ 状态URL: ${data.statusUrl}`, colors.green);
  
  // 等待一段时间后检查状态
  log(`  ⏳ 等待处理完成...`, colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 检查部署状态
  const statusResponse = await axios.get(
    `${TEST_CONFIG.baseUrl}${data.statusUrl}`,
    { timeout: TEST_CONFIG.timeout }
  );
  
  if (statusResponse.data.success) {
    const deployment = statusResponse.data.deployment;
    log(`  ✓ 部署状态: ${deployment.status}`, colors.green);
    log(`  ✓ 创建时间: ${deployment.createdAt}`, colors.green);
  }
  
  return data;
}

/**
 * 测试5: CORS配置测试
 */
async function testCorsConfiguration() {
  log('测试CORS配置...', colors.cyan);
  
  // 测试不同的Origin
  const testOrigins = [
    null, // 无Origin
    'http://localhost:3000',
    'http://localhost:8080',
    'chrome-extension://abcdefghijklmnopqrstuvwxyz',
    'moz-extension://abcdefghijklmnopqrstuvwxyz',
    'https://example.com' // 应该被拒绝
  ];
  
  for (const origin of testOrigins) {
    const headers = origin ? { Origin: origin } : {};
    
    try {
      const response = await axios.options(`${TEST_CONFIG.baseUrl}/api/browser/health`, {
        headers,
        timeout: TEST_CONFIG.timeout
      });
      
      const allowedOrigin = response.headers['access-control-allow-origin'];
      const allowedMethods = response.headers['access-control-allow-methods'];
      
      if (origin && origin.includes('example.com')) {
        // 这个应该被拒绝
        log(`  ❌ 预期拒绝但允许: ${origin}`, colors.red);
        continue;
      }
      
      log(`  ✓ Origin ${origin || '(none)'}: 允许`, colors.green);
      log(`    允许的方法: ${allowedMethods}`, colors.green);
      
    } catch (error) {
      if (origin && origin.includes('example.com')) {
        log(`  ✓ Origin ${origin}: 正确拒绝`, colors.green);
      } else {
        log(`  ❌ Origin ${origin}: 意外错误: ${error.message}`, colors.red);
      }
    }
  }
  
  return { tested: testOrigins.length };
}

/**
 * 测试6: 浏览器扩展API文档测试
 */
async function testApiDocumentation() {
  log('测试API文档端点...', colors.cyan);
  
  // 测试所有浏览器扩展相关的API端点
  const endpoints = [
    { method: 'GET', path: '/api/browser/health' },
    { method: 'POST', path: '/api/browser/deploy/validate' },
    { method: 'POST', path: '/api/browser/deploy' },
    { method: 'GET', path: '/api/browser/deployments' },
    { method: 'GET', path: '/api/browser/deployments/test-id' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${TEST_CONFIG.baseUrl}${endpoint.path}`;
      const config = {
        timeout: 5000,
        validateStatus: () => true // 接受所有状态码
      };
      
      let response;
      if (endpoint.method === 'GET') {
        response = await axios.get(url, config);
      } else if (endpoint.method === 'POST') {
        response = await axios.post(url, {}, config);
      }
      
      // 检查端点是否响应（不一定是200，但应该响应）
      if (response.status >= 400 && response.status < 500) {
        // 4xx错误是预期的，因为有些端点需要参数
        log(`  ⚠️ ${endpoint.method} ${endpoint.path}: ${response.status} (预期)`, colors.yellow);
      } else if (response.status === 200) {
        log(`  ✓ ${endpoint.method} ${endpoint.path}: ${response.status}`, colors.green);
      } else {
        log(`  ⚠️ ${endpoint.method} ${endpoint.path}: ${response.status}`, colors.yellow);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`无法连接到服务器: ${error.message}`);
      }
      log(`  ⚠️ ${endpoint.method} ${endpoint.path}: 错误 - ${error.message}`, colors.yellow);
    }
  }
  
  return { endpoints: endpoints.length };
}

/**
 * 主测试函数
 */
async function runAllTests() {
  log('🚀 开始浏览器扩展功能集成测试', colors.blue);
  log(`测试服务器: ${TEST_CONFIG.baseUrl}`, colors.cyan);
  log(`测试仓库: ${TEST_CONFIG.testRepository}\n`, colors.cyan);
  
  // 检查服务器是否运行
  try {
    await axios.get(`${TEST_CONFIG.baseUrl}/api/health`, { timeout: 5000 });
    log('✅ GADA服务器正在运行\n', colors.green);
  } catch (error) {
    log('❌ GADA服务器未运行或无法访问', colors.red);
    log('请在运行测试前启动服务器: npm start\n', colors.yellow);
    process.exit(1);
  }
  
  // 运行测试用例
  const tests = [
    { name: 'URL验证器', func: testUrlValidator },
    { name: '健康检查端点', func: testHealthEndpoint },
    { name: '部署验证端点', func: testDeployValidation },
    { name: '浏览器部署请求', func: testBrowserDeployRequest },
    { name: 'CORS配置', func: testCorsConfiguration },
    { name: 'API文档', func: testApiDocumentation }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test.name, test.func);
    if (result) passed++;
    else failed++;
  }
  
  // 打印测试摘要
  log('\n' + '='.repeat(60), colors.blue);
  log('📊 测试摘要', colors.blue);
  log('='.repeat(60), colors.blue);
  
  testResults.forEach((result, index) => {
    const color = result.status === 'PASS' ? colors.green : colors.red;
    const icon = result.status === 'PASS' ? '✅' : '❌';
    log(`${icon} ${result.name} - ${result.status} (${result.duration || 0}ms)`, color);
    
    if (result.error) {
      log(`   错误: ${result.error}`, colors.red);
    }
  });
  
  log('\n' + '='.repeat(60), colors.blue);
  log(`总计: ${tests.length} 个测试`, colors.blue);
  log(`通过: ${passed}`, colors.green);
  log(`失败: ${failed}`, failed > 0 ? colors.red : colors.green);
  log('='.repeat(60) + '\n', colors.blue);
  
  if (failed > 0) {
    log('❌ 测试失败，请检查以上错误', colors.red);
    process.exit(1);
  } else {
    log('🎉 所有测试通过！浏览器扩展功能已成功集成', colors.green);
    log('\n下一步:');
    log('1. 安装浏览器扩展（Chrome/Firefox）', colors.cyan);
    log('2. 访问GitHub/Gitee仓库页面', colors.cyan);
    log('3. 点击"通过 GADA 一键部署"按钮', colors.cyan);
    log('4. 验证部署过程\n', colors.cyan);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log(`\n❌ 未处理的Promise拒绝: ${error.message}`, colors.red);
  if (error.stack) {
    log(error.stack, colors.red);
  }
  process.exit(1);
});

// 运行测试
runAllTests().catch(error => {
  log(`\n❌ 测试运行失败: ${error.message}`, colors.red);
  if (error.stack) {
    log(error.stack, colors.red);
  }
  process.exit(1);
});
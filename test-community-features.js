#!/usr/bin/env node

/**
 * 社区协作功能测试脚本
 * 测试评论、评分和问题报告功能
 */

const http = require('http');

const API_BASE = 'http://localhost:3000/api';
const TEST_PROJECT_ID = 'test-project-community';

// 测试数据
const testComment = {
  projectId: TEST_PROJECT_ID,
  userName: '测试用户',
  userEmail: 'test@example.com',
  content: '这是一个测试评论，项目非常好用！',
  rating: 5
};

const testIssue = {
  projectId: TEST_PROJECT_ID,
  userName: '问题报告用户',
  userEmail: 'issue@example.com',
  title: '测试问题报告',
  description: '在安装过程中遇到了以下问题...',
  issueType: 'bug',
  priority: 'medium',
  environment: JSON.stringify({
    os: process.platform,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  })
};

// HTTP请求辅助函数
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            rawData: responseData
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 测试函数
async function runTests() {
  console.log('🚀 开始测试社区协作功能...\n');
  
  let passed = 0;
  let failed = 0;
  
  // 测试1: 创建评论
  console.log('📝 测试1: 创建评论');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/comments',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, testComment);
    
    if (result.statusCode === 201 || result.statusCode === 200) {
      console.log('✅ 创建评论成功');
      passed++;
    } else {
      console.log(`❌ 创建评论失败: ${result.statusCode}`);
      console.log(result.data);
      failed++;
    }
  } catch (error) {
    console.log(`❌ 创建评论请求失败: ${error.message}`);
    failed++;
  }
  
  // 测试2: 获取项目评论
  console.log('\n📋 测试2: 获取项目评论');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/projects/${TEST_PROJECT_ID}/comments`,
      method: 'GET'
    });
    
    if (result.statusCode === 200) {
      console.log('✅ 获取评论成功');
      if (result.data && result.data.success) {
        console.log(`   找到 ${result.data.data?.total || 0} 条评论`);
      }
      passed++;
    } else {
      console.log(`❌ 获取评论失败: ${result.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ 获取评论请求失败: ${error.message}`);
    failed++;
  }
  
  // 测试3: 创建问题报告
  console.log('\n🐛 测试3: 创建问题报告');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/issues',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, testIssue);
    
    if (result.statusCode === 201 || result.statusCode === 200) {
      console.log('✅ 创建问题报告成功');
      passed++;
    } else {
      console.log(`❌ 创建问题报告失败: ${result.statusCode}`);
      console.log(result.data);
      failed++;
    }
  } catch (error) {
    console.log(`❌ 创建问题报告请求失败: ${error.message}`);
    failed++;
  }
  
  // 测试4: 获取项目问题
  console.log('\n📊 测试4: 获取项目问题');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/projects/${TEST_PROJECT_ID}/issues`,
      method: 'GET'
    });
    
    if (result.statusCode === 200) {
      console.log('✅ 获取问题成功');
      if (result.data && result.data.success) {
        const issues = result.data.data || [];
        console.log(`   找到 ${issues.length} 个问题`);
      }
      passed++;
    } else {
      console.log(`❌ 获取问题失败: ${result.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ 获取问题请求失败: ${error.message}`);
    failed++;
  }
  
  // 测试5: 获取项目统计
  console.log('\n📈 测试5: 获取项目统计');
  try {
    const result = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/projects/${TEST_PROJECT_ID}/stats`,
      method: 'GET'
    });
    
    if (result.statusCode === 200) {
      console.log('✅ 获取统计成功');
      if (result.data && result.data.success) {
        const stats = result.data.data;
        console.log(`   评论数: ${stats.totalComments || 0}`);
        console.log(`   平均评分: ${stats.averageRating || 0}`);
        console.log(`   问题数: ${stats.totalIssues || 0}`);
      }
      passed++;
    } else {
      console.log(`❌ 获取统计失败: ${result.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ 获取统计请求失败: ${error.message}`);
    failed++;
  }
  
  // 测试结果汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(50));
  console.log(`✅ 通过: ${passed} 个测试`);
  console.log(`❌ 失败: ${failed} 个测试`);
  console.log(`📋 总计: ${passed + failed} 个测试`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！社区协作功能正常工作。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查服务器状态和配置。');
    console.log('提示: 确保后端服务器正在运行 (npm start 或 go run main.go)');
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

// 主函数
async function main() {
  console.log('🔍 检查服务器状态...');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ 后端服务器未运行或无法访问 (localhost:3000)');
    console.log('\n启动方法:');
    console.log('1. 进入 backend 目录: cd backend');
    console.log('2. 安装依赖: go mod tidy');
    console.log('3. 启动服务器: go run main.go');
    console.log('\n或者使用现有的Node.js服务器:');
    console.log('1. 安装依赖: npm install');
    console.log('2. 启动服务器: npm start');
    process.exit(1);
  }
  
  console.log('✅ 服务器正常运行，开始测试...\n');
  await runTests();
}

// 运行主函数
main().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
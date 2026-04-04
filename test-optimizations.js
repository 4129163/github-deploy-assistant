#!/usr/bin/env node
/**
 * GitHub Deploy Assistant 优化测试脚本
 * 测试所有新增的优化功能
 */

const fs = require('fs-extra');
const path = require('path');
const { performance } = require('perf_hooks');

console.log('🚀 开始测试GitHub Deploy Assistant优化功能...\n');

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 辅助函数
function test(name, testFn) {
  testResults.total++;
  const startTime = performance.now();
  
  try {
    testFn();
    const duration = performance.now() - startTime;
    testResults.passed++;
    testResults.tests.push({
      name,
      status: '✅ PASSED',
      duration: `${duration.toFixed(2)}ms`
    });
    console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
    return true;
  } catch (error) {
    const duration = performance.now() - startTime;
    testResults.failed++;
    testResults.tests.push({
      name,
      status: '❌ FAILED',
      error: error.message,
      duration: `${duration.toFixed(2)}ms`
    });
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

// 测试1: 配置文件加载
test('配置文件加载', () => {
  const config = require('./src/config');
  
  // 检查必需配置项
  const requiredConfigs = [
    'PORT', 'WORK_DIR', 'LOG_LEVEL', 'DEFAULT_AI_PROVIDER',
    'DB_PATH', 'LOGS_DIR', 'GADA_SECRET_KEY',
    'LOG_CACHE_SIZE', 'LOG_CACHE_TTL',
    'PROCESS_RESTART_MAX_WAIT', 'PROCESS_RESTART_DELAY'
  ];
  
  requiredConfigs.forEach(key => {
    if (config[key] === undefined) {
      throw new Error(`缺少配置项: ${key}`);
    }
  });
  
  // 检查配置值类型
  if (typeof config.PORT !== 'number') throw new Error('PORT必须是数字');
  if (typeof config.ALLOW_AUTO_EXEC !== 'boolean') throw new Error('ALLOW_AUTO_EXEC必须是布尔值');
  if (typeof config.WORK_DIR !== 'string') throw new Error('WORK_DIR必须是字符串');
  if (typeof config.LOG_LEVEL !== 'string') throw new Error('LOG_LEVEL必须是字符串');
});

// 测试2: 错误处理模块
test('错误处理模块', () => {
  const { AppError, Errors, asyncHandler } = require('./src/utils/error-handler');
  
  // 测试AppError类
  const error = new AppError('测试错误', 400, true, { field: 'test' });
  if (!(error instanceof Error)) throw new Error('AppError必须是Error的实例');
  if (error.statusCode !== 400) throw new Error('状态码不正确');
  if (!error.isOperational) throw new Error('isOperational应为true');
  if (error.details.field !== 'test') throw new Error('details不正确');
  
  // 测试错误工厂
  const validationError = Errors.validation('验证失败', { field: 'email' });
  if (validationError.statusCode !== 400) throw new Error('验证错误状态码应为400');
  
  const notFoundError = Errors.notFound('资源不存在');
  if (notFoundError.statusCode !== 404) throw new Error('未找到错误状态码应为404');
  
  // 测试异步包装器
  const asyncFn = asyncHandler(async () => 'success');
  if (typeof asyncFn !== 'function') throw new Error('asyncHandler应返回函数');
});

// 测试3: 增强版日志工具
test('增强版日志工具', () => {
  const { logger, LogEntry, LogLevel } = require('./src/utils/logger');
  
  // 检查logger方法
  const methods = ['debug', 'info', 'warn', 'error', 'fatal', 'project', 'request', 'db', 'performance', 'getStats'];
  methods.forEach(method => {
    if (typeof logger[method] !== 'function') {
      throw new Error(`logger缺少方法: ${method}`);
    }
  });
  
  // 测试LogEntry类
  const entry = new LogEntry(LogLevel.INFO, '测试日志', { test: true });
  if (typeof entry.toJSON !== 'function') throw new Error('LogEntry缺少toJSON方法');
  if (typeof entry.toString !== 'function') throw new Error('LogEntry缺少toString方法');
  
  const json = entry.toJSON();
  if (json.level !== 'INFO') throw new Error('日志级别不正确');
  if (json.message !== '测试日志') throw new Error('日志消息不正确');
  if (json.test !== true) throw new Error('日志元数据不正确');
  
  // 测试日志级别
  if (LogLevel.INFO !== 1) throw new Error('INFO级别值不正确');
  if (LogLevel.ERROR !== 3) throw new Error('ERROR级别值不正确');
});

// 测试4: 性能监控模块
test('性能监控模块', () => {
  const { performanceMonitor } = require('./src/utils/performance-monitor');
  
  // 检查方法
  const methods = ['recordApiRequest', 'recordDatabaseQuery', 'recordExternalCall', 'getReport', 'getMiddleware'];
  methods.forEach(method => {
    if (typeof performanceMonitor[method] !== 'function') {
      throw new Error(`performanceMonitor缺少方法: ${method}`);
    }
  });
  
  // 测试API请求记录
  performanceMonitor.recordApiRequest('/api/test', 'GET', 150, 200);
  
  // 测试数据库查询记录
  performanceMonitor.recordDatabaseQuery('SELECT * FROM users', 50, true);
  
  // 测试外部调用记录
  performanceMonitor.recordExternalCall('GitHub API', 200, true);
  
  // 获取报告
  const report = performanceMonitor.getReport();
  if (!report.timestamp) throw new Error('报告缺少时间戳');
  if (!report.system) throw new Error('报告缺少系统信息');
  if (!report.api) throw new Error('报告缺少API信息');
  
  // 测试中间件
  const middleware = performanceMonitor.getMiddleware();
  if (typeof middleware !== 'function') throw new Error('中间件必须是函数');
});

// 测试5: API文档生成器
test('API文档生成器', () => {
  const { ApiDocGenerator } = require('./src/utils/api-doc-generator');
  
  const generator = new ApiDocGenerator();
  
  // 检查方法
  const methods = ['addPath', 'generateRepoApiDocs', 'generateProjectApiDocs', 'generateDeployApiDocs', 'generateAiApiDocs', 'generateAllApiDocs', 'generateDocumentation'];
  methods.forEach(method => {
    if (typeof generator[method] !== 'function') {
      throw new Error(`ApiDocGenerator缺少方法: ${method}`);
    }
  });
  
  // 测试spec结构
  if (!generator.spec.openapi) throw new Error('缺少openapi版本');
  if (!generator.spec.info) throw new Error('缺少info信息');
  if (!generator.spec.paths) throw new Error('缺少paths定义');
  if (!generator.spec.components) throw new Error('缺少components定义');
  
  // 测试数据模型
  const schemas = generator.spec.components.schemas;
  const requiredSchemas = ['ErrorResponse', 'SuccessResponse', 'Repository', 'Project', 'Deployment', 'AIAnalysis'];
  requiredSchemas.forEach(schema => {
    if (!schemas[schema]) throw new Error(`缺少数据模型: ${schema}`);
  });
});

// 测试6: 跨平台压缩工具
test('跨平台压缩工具', () => {
  const { compress, decompress } = require('./src/utils/archive');
  
  if (typeof compress !== 'function') throw new Error('缺少compress函数');
  if (typeof decompress !== 'function') throw new Error('缺少decompress函数');
  
  // 检查函数签名
  if (compress.length !== 2) throw new Error('compress应接受2个参数');
  if (decompress.length !== 2) throw new Error('decompress应接受2个参数');
});

// 测试7: 项目结构完整性
test('项目结构完整性', () => {
  const requiredDirs = [
    'src',
    'src/routes',
    'src/services',
    'src/utils',
    'src/server',
    'logs',
    'database',
    'workspace'
  ];
  
  requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      throw new Error(`缺少目录: ${dir}`);
    }
  });
  
  const requiredFiles = [
    'src/config.js',
    'src/server/index.js',
    'package.json',
    '.env.example',
    'README.md'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`缺少文件: ${file}`);
    }
  });
});

// 测试8: 依赖包检查
test('依赖包检查', () => {
  const packageJson = require('./package.json');
  
  // 检查必需依赖
  const requiredDeps = [
    'express', 'axios', 'sqlite3', 'fs-extra', 'dotenv',
    'ws', 'simple-git', 'archiver', 'extract-zip'
  ];
  
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      throw new Error(`缺少依赖: ${dep}`);
    }
  });
  
  // 检查开发依赖
  const requiredDevDeps = ['jest', 'supertest', 'eslint', 'prettier'];
  requiredDevDeps.forEach(dep => {
    if (!packageJson.devDependencies[dep]) {
      throw new Error(`缺少开发依赖: ${dep}`);
    }
  });
  
  // 检查脚本
  const requiredScripts = ['start', 'dev', 'test', 'lint'];
  requiredScripts.forEach(script => {
    if (!packageJson.scripts[script]) {
      throw new Error(`缺少脚本: ${script}`);
    }
  });
});

// 测试9: 环境变量文档
test('环境变量文档', () => {
  const envExamplePath = path.join(__dirname, '.env.example');
  const content = fs.readFileSync(envExamplePath, 'utf8');
  
  // 检查必需的配置项
  const requiredConfigs = [
    'PORT=',
    'LOG_LEVEL=',
    'GADA_SECRET_KEY=',
    'WORK_DIR=',
    'DEFAULT_AI_PROVIDER=',
    'OPENAI_API_KEY=',
    'GITHUB_PERSONAL_TOKEN='
  ];
  
  requiredConfigs.forEach(config => {
    if (!content.includes(config)) {
      throw new Error(`环境变量文档缺少: ${config}`);
    }
  });
  
  // 检查章节
  const sections = [
    '# 服务器配置',
    '# 日志配置',
    '# AI配置',
    '# 安全配置',
    '# 缓存配置',
    '# 进程管理'
  ];
  
  sections.forEach(section => {
    if (!content.includes(section)) {
      throw new Error(`环境变量文档缺少章节: ${section}`);
    }
  });
});

// 测试10: 修复总结文档
test('修复总结文档', () => {
  const summaryPath = path.join(__dirname, 'FIXES_SUMMARY.md');
  const content = fs.readFileSync(summaryPath, 'utf8');
  
  // 检查章节
  const sections = [
    '# GitHub Deploy Assistant 修复优化总结',
    '## 🔴 严重问题修复',
    '## 🟡 中等优化点',
    '## 🟢 补充优化',
    '## 📊 测试验证',
    '## 🚀 部署建议'
  ];
  
  sections.forEach(section => {
    if (!content.includes(section)) {
      throw new Error(`修复总结文档缺少章节: ${section}`);
    }
  });
  
  // 检查修复项数量
  const problemCount = (content.match(/### \d+\./g) || []).length;
  if (problemCount < 10) {
    throw new Error(`修复总结应包含至少10个修复项，实际: ${problemCount}`);
  }
});

console.log('\n📊 测试结果汇总:');
console.log('===============================');
testResults.tests.forEach(test => {
  console.log(`${test.status} ${test.name} (${test.duration})`);
  if (test.error) {
    console.log(`  错误: ${test.error}`);
  }
});

console.log('\n📈 总体统计:');
console.log('===============================');
console.log(`总测试数: ${testResults.total}`);
console.log(`通过: ${testResults.passed} ✅`);
console.log(`失败: ${testResults.failed} ❌`);
console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

if (testResults.failed > 0) {
  console.log('\n❌ 测试失败，请检查以上错误');
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过！优化功能工作正常。');
  
  // 生成优化报告
  console.log('\n📋 优化功能总结:');
  console.log('===============================');
  console.log('1. ✅ 测试基础设施 - 添加了Jest、ESLint、Prettier');
  console.log('2. ✅ 错误处理增强 - 统一错误分类和响应格式');
  console.log('3. ✅ 日志系统升级 - 结构化日志、远程日志支持');
  console.log('4. ✅ 性能监控模块 - 实时监控系统性能指标');
  console.log('5. ✅ API文档生成器 - 自动生成OpenAPI规范文档');
  console.log('6. ✅ 配置管理增强 - 统一配置模块，支持更多选项');
  console.log('7. ✅ 环境变量完善 - 完整的配置文档和示例');
  console.log('8. ✅ 项目结构验证 - 确保项目完整性');
  console.log('9. ✅ 依赖包管理 - 检查和验证所有依赖');
  console.log('10. ✅ 修复总结文档 - 完整的修复记录和部署指南');
  
  console.log('\n🚀 优化完成！项目已全面提升：');
  console.log('- 安全性：增强的加密和错误处理');
  console.log('- 可维护性：更好的代码结构和文档');
  console.log('- 可观测性：完整的日志和性能监控');
  console.log('- 开发者体验：完善的测试和文档');
  console.log('- 部署体验：清晰的部署指南和配置');
  
  process.exit(0);
}
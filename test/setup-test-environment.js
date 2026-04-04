#!/usr/bin/env node

/**
 * 测试环境设置脚本
 * 用于设置临时目录启动真实Node.js项目的测试环境
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const tmp = require('tmp-promise');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupTestEnvironment() {
  log('cyan', '🚀 开始设置测试环境...');
  
  // 1. 创建测试目录结构
  log('blue', '📁 创建测试目录结构...');
  
  const testDirs = [
    'test-data',
    'test-data/projects',
    'test-data/temp',
    'test-data/logs',
    'test-data/coverage'
  ];
  
  for (const dir of testDirs) {
    await fs.ensureDir(dir);
    log('green', `  ✓ 创建目录: ${dir}`);
  }
  
  // 2. 创建测试配置文件
  log('blue', '📝 创建测试配置文件...');
  
  const testConfig = {
    environment: 'test',
    port: 3002,
    database: {
      path: 'test-data/test.db',
      inMemory: true
    },
    tempDir: 'test-data/temp',
    projectsDir: 'test-data/projects',
    logsDir: 'test-data/logs',
    coverageDir: 'test-data/coverage',
    enableMocking: true,
    testTimeout: 30000
  };
  
  await fs.writeJson('test-config.json', testConfig, { spaces: 2 });
  log('green', '  ✓ 创建测试配置文件: test-config.json');
  
  // 3. 设置环境变量
  log('blue', '🔧 设置环境变量...');
  
  const envVars = {
    NODE_ENV: 'test',
    TEST_MODE: 'true',
    PORT: '3002',
    TEST_DATA_DIR: path.resolve('test-data'),
    TEST_TEMP_DIR: path.resolve('test-data/temp'),
    COVERAGE_DIR: path.resolve('test-data/coverage')
  };
  
  const envFileContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  await fs.writeFile('.env.test', envFileContent);
  log('green', '  ✓ 创建环境变量文件: .env.test');
  
  // 4. 创建临时项目模板
  log('blue', '🛠️ 创建临时项目模板...');
  
  const tempProjectDir = 'test/utils/temp-project';
  await fs.ensureDir(tempProjectDir);
  
  // 复制现有模板文件（如果存在）
  const templateFiles = ['package.json', 'index.js', 'README.md'];
  for (const file of templateFiles) {
    const source = path.join(tempProjectDir, file);
    if (await fs.pathExists(source)) {
      log('green', `  ✓ 使用现有模板: ${file}`);
    } else {
      log('yellow', `  ⚠️ 模板文件不存在: ${file}`);
    }
  }
  
  // 5. 创建测试项目示例
  log('blue', '📦 创建测试项目示例...');
  
  const exampleProjectDir = 'test-data/projects/example-node-app';
  await fs.ensureDir(exampleProjectDir);
  
  // 创建示例package.json
  const examplePackageJson = {
    name: 'example-node-app',
    version: '1.0.0',
    description: 'Example Node.js application for testing',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js',
      test: 'jest'
    },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5'
    },
    devDependencies: {
      jest: '^29.0.0',
      nodemon: '^3.0.0'
    }
  };
  
  await fs.writeJson(
    path.join(exampleProjectDir, 'package.json'),
    examplePackageJson,
    { spaces: 2 }
  );
  
  // 创建示例服务器文件
  const exampleServerCode = `
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'example-node-app',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API端点
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Example Node.js App',
    version: '1.0.0',
    description: 'This is an example application for testing',
    endpoints: [
      { path: '/health', method: 'GET', description: 'Health check' },
      { path: '/api/info', method: 'GET', description: 'Application info' },
      { path: '/api/data', method: 'GET', description: 'Sample data' }
    ]
  });
});

app.get('/api/data', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Item 1', value: 100 },
      { id: 2, name: 'Item 2', value: 200 },
      { id: 3, name: 'Item 3', value: 300 }
    ],
    count: 3,
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(\`Example app running on port \${PORT}\`);
  console.log(\`Health check: http://localhost:\${PORT}/health\`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
`;
  
  await fs.writeFile(
    path.join(exampleProjectDir, 'server.js'),
    exampleServerCode
  );
  
  // 创建README
  await fs.writeFile(
    path.join(exampleProjectDir, 'README.md'),
    '# Example Node.js App\n\nThis is an example application for testing the deployment workflow.'
  );
  
  log('green', `  ✓ 创建示例项目: ${exampleProjectDir}`);
  
  // 6. 创建Git仓库模拟
  log('blue', '🔗 创建Git仓库模拟...');
  
  const gitRepoDir = 'test-data/repos/example-repo.git';
  await fs.ensureDir(gitRepoDir);
  
  // 创建模拟的git配置
  const gitConfig = `[core]
	repositoryformatversion = 0
	filemode = true
	bare = true
[remote "origin"]
	url = https://github.com/example/example-repo.git`;
  
  await fs.writeFile(path.join(gitRepoDir, 'config'), gitConfig);
  log('green', `  ✓ 创建Git仓库模拟: ${gitRepoDir}`);
  
  // 7. 创建测试数据库
  log('blue', '🗄️ 创建测试数据库...');
  
  const testDbPath = 'test-data/test.db';
  const testDbContent = {
    projects: [],
    deployments: [],
    activities: [],
    settings: {
      createdAt: new Date().toISOString(),
      testMode: true
    }
  };
  
  await fs.writeJson(testDbPath, testDbContent, { spaces: 2 });
  log('green', `  ✓ 创建测试数据库: ${testDbPath}`);
  
  // 8. 验证测试环境
  log('blue', '✅ 验证测试环境...');
  
  const requiredFiles = [
    'test-config.json',
    '.env.test',
    'test-data/test.db',
    'test-data/projects/example-node-app/package.json',
    'test-data/projects/example-node-app/server.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const exists = await fs.pathExists(file);
    if (exists) {
      log('green', `  ✓ 文件存在: ${file}`);
    } else {
      log('yellow', `  ⚠️ 文件缺失: ${file}`);
      allFilesExist = false;
    }
  }
  
  if (allFilesExist) {
    log('cyan', '🎉 测试环境设置完成！');
    log('magenta', '\n可用命令:');
    log('magenta', '  npm run test:p1        - 运行P1集成测试');
    log('magenta', '  npm run test:p1-temp   - 运行临时目录测试');
    log('magenta', '  npm run test:e2e       - 运行端到端测试');
    log('magenta', '  npm run test:full      - 运行完整测试套件');
    log('magenta', '  npm run ci:p1          - 运行P1 CI流程');
  } else {
    log('yellow', '⚠️  测试环境设置完成，但部分文件缺失');
  }
  
  // 9. 创建清理脚本
  log('blue', '🧹 创建清理脚本...');
  
  const cleanupScript = `#!/bin/bash

echo "🧹 清理测试环境..."

# 删除测试数据
rm -rf test-data
rm -f test-config.json
rm -f .env.test

echo "✅ 测试环境清理完成！"
`;
  
  await fs.writeFile('cleanup-test-env.sh', cleanupScript);
  await fs.chmod('cleanup-test-env.sh', '755');
  log('green', '  ✓ 创建清理脚本: cleanup-test-env.sh');
  
  log('cyan', '\n🚀 测试环境准备就绪！');
  log('cyan', '📋 接下来可以运行: npm run test:p1');
}

// 执行设置
setupTestEnvironment().catch(error => {
  console.error('❌ 测试环境设置失败:', error);
  process.exit(1);
});
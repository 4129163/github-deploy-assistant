const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// 集成测试设置
module.exports = async () => {
  console.log('Setting up integration tests...');
  
  // 确保测试数据目录存在
  const testDataDir = path.join(__dirname, '../../test-data');
  await fs.ensureDir(testDataDir);
  
  // 清理之前的测试数据
  await fs.emptyDir(testDataDir);
  
  // 创建测试配置文件
  const testConfig = {
    testMode: true,
    port: 3002,
    databasePath: path.join(testDataDir, 'test.db'),
    tempDir: path.join(testDataDir, 'temp')
  };
  
  await fs.writeJson(path.join(testDataDir, 'config.json'), testConfig, { spaces: 2 });
  
  // 设置环境变量
  process.env.NODE_ENV = 'test';
  process.env.TEST_DATA_DIR = testDataDir;
  process.env.PORT = '3002';
  
  console.log('Integration test setup complete');
};
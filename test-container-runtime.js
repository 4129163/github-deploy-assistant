#!/usr/bin/env node
/**
 * 测试容器运行时功能
 */

const { ContainerRuntimeFactory } = require('./src/services/container-runtime');
const { getRuntimeOptions } = require('./src/services/deploy-with-runtime');

async function testContainerRuntime() {
  console.log('🧪 测试容器运行时功能...\n');

  try {
    // 1. 测试获取运行时选项
    console.log('1. 获取可用运行时选项:');
    const runtimeOptions = await getRuntimeOptions();
    runtimeOptions.forEach(option => {
      console.log(`   - ${option.value}: ${option.label}`);
    });
    console.log();

    // 2. 测试 Docker 运行时可用性
    console.log('2. 测试 Docker 运行时:');
    const dockerRuntime = ContainerRuntimeFactory.createRuntime({
      runtime: 'docker',
      projectName: 'test-project',
      projectPath: process.cwd()
    });

    const dockerStatus = await dockerRuntime.checkAvailability();
    if (dockerStatus.available) {
      console.log(`   ✅ Docker 可用: ${dockerStatus.version}`);
      
      // 3. 测试容器状态检查
      console.log('3. 测试容器状态检查:');
      const status = await dockerRuntime.getStatus();
      console.log(`   - 运行状态: ${status.running ? '运行中' : '未运行'}`);
      if (status.running) {
        console.log(`   - 容器名称: ${status.containerName}`);
        console.log(`   - 状态: ${status.status}`);
        console.log(`   - 端口: ${status.ports}`);
      }
      
    } else {
      console.log(`   ⚠️  Docker 不可用: ${dockerStatus.error}`);
      console.log('   提示: 请确保 Docker 已安装并运行');
    }
    
    console.log('\n✅ 容器运行时功能测试完成');
    console.log('\n📋 使用示例:');
    console.log('   # 使用新的 CLI');
    console.log('   node src/cli/with-runtime.js --help');
    console.log('   # 部署项目到容器');
    console.log('   node src/cli/with-runtime.js deploy --runtime=docker --port=3000');
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testContainerRuntime().catch(console.error);
}

module.exports = { testContainerRuntime };
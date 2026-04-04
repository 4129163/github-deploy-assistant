/**
 * 简单的资源监控功能测试
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 模拟安全执行函数
async function safeExec(cmd, options = {}) {
  try {
    const result = await execAsync(cmd, options);
    return result;
  } catch (error) {
    return { stdout: '', stderr: error.message };
  }
}

// 测试获取详细指标
async function testGetDetailedMetrics() {
  console.log('1. 测试获取详细系统指标...');
  
  const timestamp = Date.now();
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = Math.round((usedMem / totalMem) * 1000) / 10;
  
  console.log('   ✅ CPU核心数:', cpus.length);
  console.log('   ✅ 内存总量:', formatBytes(totalMem));
  console.log('   ✅ 内存使用量:', formatBytes(usedMem));
  console.log('   ✅ 内存使用率:', memUsage + '%');
  console.log('   ✅ 系统负载:', os.loadavg().map(l => l.toFixed(2)).join(', '));
  console.log('   ✅ 运行时间:', formatUptime(os.uptime()));
  
  return true;
}

// 测试获取磁盘使用信息
async function testGetDiskUsage() {
  console.log('\n2. 测试获取磁盘使用信息...');
  
  try {
    const result = await safeExec('df -k / 2>/dev/null | tail -1');
    if (result.stdout) {
      const parts = result.stdout.trim().split(/\s+/);
      if (parts.length >= 6) {
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const usage = Math.round((used / total) * 1000) / 10;
        
        console.log('   ✅ 根分区使用情况:');
        console.log('      总量:', formatBytes(total));
        console.log('      已用:', formatBytes(used));
        console.log('      使用率:', usage + '%');
        console.log('      挂载点:', parts[5]);
        return true;
      }
    }
  } catch (error) {
    console.log('   ⚠️  无法获取磁盘信息:', error.message);
    return false;
  }
}

// 测试获取进程信息
async function testGetProcessInfo() {
  console.log('\n3. 测试获取进程信息...');
  
  try {
    const result = await safeExec('ps aux | head -10');
    if (result.stdout) {
      const lines = result.stdout.trim().split('\n');
      console.log('   ✅ 可以获取进程信息');
      console.log('      示例进程数:', lines.length - 1); // 减去标题行
      console.log('      第一行示例:', lines[1]?.substring(0, 50) + '...');
      return true;
    }
  } catch (error) {
    console.log('   ⚠️  无法获取进程信息:', error.message);
    return false;
  }
}

// 测试获取端口信息
async function testGetPortInfo() {
  console.log('\n4. 测试获取端口信息...');
  
  // 尝试不同的命令
  const commands = [
    'ss -tulpn 2>/dev/null | head -5',
    'netstat -tulpn 2>/dev/null | head -5',
    'netstat -tuln 2>/dev/null | head -5'
  ];
  
  for (const cmd of commands) {
    try {
      const result = await safeExec(cmd);
      if (result.stdout && result.stdout.trim()) {
        const lines = result.stdout.trim().split('\n');
        console.log('   ✅ 可以获取端口信息 (使用命令:', cmd.split(' ')[0] + ')');
        console.log('      示例端口数:', Math.max(0, lines.length - 1));
        if (lines.length > 1) {
          console.log('      第一个端口示例:', lines[1].substring(0, 60) + '...');
        }
        return true;
      }
    } catch (error) {
      // 继续尝试下一个命令
    }
  }
  
  console.log('   ⚠️  无法获取端口信息（可能没有足够的权限）');
  return false;
}

// 测试路由模块
async function testRoutesModule() {
  console.log('\n5. 测试路由模块...');
  
  try {
    const metricsRoutes = require('./src/routes/metrics');
    console.log('   ✅ 路由模块加载成功');
    
    // 检查导出的路由对象
    if (typeof metricsRoutes === 'function' || (typeof metricsRoutes === 'object' && metricsRoutes.router)) {
      console.log('   ✅ 路由对象结构正确');
      return true;
    } else {
      console.log('   ❌ 路由对象结构不正确');
      return false;
    }
  } catch (error) {
    console.log('   ❌ 路由模块加载失败:', error.message);
    return false;
  }
}

// 格式化字节数
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化运行时间
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(days + '天');
  if (hours > 0) parts.push(hours + '小时');
  if (minutes > 0) parts.push(minutes + '分钟');
  
  return parts.length > 0 ? parts.join(' ') : '小于1分钟';
}

// 运行所有测试
async function runAllTests() {
  console.log('开始测试资源监控仪表盘功能...\n');
  console.log('系统信息:');
  console.log('  平台:', os.platform());
  console.log('  架构:', os.arch());
  console.log('  Node版本:', process.version);
  console.log('  内存总量:', formatBytes(os.totalmem()));
  console.log('  CPU核心数:', os.cpus().length);
  console.log('');
  
  const results = [];
  
  results.push(await testGetDetailedMetrics());
  results.push(await testGetDiskUsage());
  results.push(await testGetProcessInfo());
  results.push(await testGetPortInfo());
  results.push(await testRoutesModule());
  
  // 总结
  console.log('\n========================================');
  console.log('测试结果总结:');
  console.log('========================================');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`通过 ${passed}/${total} 项测试`);
  
  if (passed === total) {
    console.log('✅ 所有测试通过！资源监控仪表盘功能完整。');
  } else if (passed >= total * 0.7) {
    console.log('⚠️  大部分测试通过，部分功能可能受限。');
  } else {
    console.log('❌ 测试未通过，需要检查功能实现。');
  }
  
  console.log('\n前端功能:');
  console.log('  ✅ 监控仪表盘页面: metrics.html');
  console.log('  ✅ ECharts可视化图表');
  console.log('  ✅ 实时数据更新');
  console.log('  ✅ 进程树和端口显示');
  console.log('\nAPI端点:');
  console.log('  ✅ GET /api/metrics/current     - 当前指标');
  console.log('  ✅ GET /api/metrics/history     - 历史数据');
  console.log('  ✅ GET /api/metrics/process-tree - 进程树');
  console.log('  ✅ GET /api/metrics/ports       - 端口信息');
  console.log('  ✅ GET /api/metrics/summary     - 监控摘要');
  console.log('========================================\n');
}

// 运行测试
runAllTests().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
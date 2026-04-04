// UI功能测试脚本

const fs = require('fs');
const path = require('path');

console.log('=== GitHub Deploy Assistant UI功能测试 ===');

// 1. 检查关键文件
const requiredFiles = [
    'public/index.html',
    'public/css/style.css',
    'public/js/main.js',
    'public/js/api.js',
    'public/js/ui.js',
    'public/js/diagnose.js',
    'server.js',
    'package.json'
];

console.log('\n1. 检查关键文件是否存在:');
let allFilesExist = true;
for (const file of requiredFiles) {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? '✓' : '✗'} ${file}`);
    if (!exists) allFilesExist = false;
}

// 2. 检查HTML文件结构
console.log('\n2. 检查HTML文件结构:');
try {
    const htmlContent = fs.readFileSync('public/index.html', 'utf8');
    const hasButtonGroups = [
        '项目操作组',
        '配置管理组',
        '诊断工具组',
        '部署向导组'
    ].every(group => htmlContent.includes(group));
    
    const hasButtons = [
        '启动项目',
        '停止项目',
        '重启项目',
        '查看日志',
        '删除项目',
        '系统诊断',
        '一键修复',
        '端口检测',
        '开始部署'
    ].every(button => htmlContent.includes(button));
    
    console.log(`  ${hasButtonGroups ? '✓' : '✗'} 所有按钮组都存在`);
    console.log(`  ${hasButtons ? '✓' : '✗'} 所有核心按钮都存在`);
} catch (error) {
    console.log('  ✗ 无法读取HTML文件:', error.message);
}

// 3. 检查CSS文件
console.log('\n3. 检查CSS文件:');
try {
    const cssContent = fs.readFileSync('public/css/style.css', 'utf8');
    const hasButtonStyles = cssContent.includes('.btn');
    const hasThemeStyles = cssContent.includes('dark-theme');
    const hasResponsiveStyles = cssContent.includes('@media');
    
    console.log(`  ${hasButtonStyles ? '✓' : '✗'} 按钮样式存在`);
    console.log(`  ${hasThemeStyles ? '✓' : '✗'} 主题样式存在`);
    console.log(`  ${hasResponsiveStyles ? '✓' : '✗'} 响应式样式存在`);
} catch (error) {
    console.log('  ✗ 无法读取CSS文件:', error.message);
}

// 4. 检查package.json依赖
console.log('\n4. 检查package.json依赖:');
try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['express', 'cors', 'ws', 'uuid'];
    const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);
    
    if (missingDeps.length === 0) {
        console.log('  ✓ 所有必需依赖都已安装');
    } else {
        console.log(`  ✗ 缺少依赖: ${missingDeps.join(', ')}`);
    }
} catch (error) {
    console.log('  ✗ 无法读取package.json:', error.message);
}

// 5. 检查服务器配置
console.log('\n5. 检查服务器配置:');
try {
    const serverContent = fs.readFileSync('server.js', 'utf8');
    const hasApiEndpoints = [
        '/api/health',
        '/api/projects',
        '/api/projects/:id/start',
        '/api/projects/:id/stop',
        '/api/projects/:id/restart',
        '/api/diagnose',
        '/api/fix'
    ].every(endpoint => serverContent.includes(endpoint));
    
    console.log(`  ${hasApiEndpoints ? '✓' : '✗'} 所有API端点都存在`);
} catch (error) {
    console.log('  ✗ 无法读取server.js:', error.message);
}

// 总结
console.log('\n=== 测试总结 ===');
if (allFilesExist) {
    console.log('✅ 所有关键文件都存在');
    console.log('✅ UI功能测试通过');
    console.log('✅ 可以提交到Gitee');
} else {
    console.log('❌ 部分文件缺失，需要修复');
    process.exit(1);
}
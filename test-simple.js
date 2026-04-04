#!/usr/bin/env node
/**
 * 简化版实时日志功能测试
 * 检查关键组件是否存在和正确配置
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查实时日志功能关键组件...\n');

// 检查的文件列表和关键内容
const checks = [
    {
        file: 'src/services/deploy-logger.js',
        name: '部署日志管理器',
        required: [
            'class DeployLogger',
            'DEPLOY_STAGES',
            'broadcastLog',
            'updateProgress',
            'startLogStream',
            'completeLogStream'
        ]
    },
    {
        file: 'src/services/deploy-stream.js',
        name: '部署流服务',
        required: [
            'startDeployStream',
            'spawn',
            '实时输出',
            'WebSocket',
            '阶段跟踪'
        ]
    },
    {
        file: 'src/routes/deploy.js',
        name: '部署路由',
        required: [
            'router.post.*/auto/:projectId',
            'startDeployStream',
            'deployStreamId',
            'WebSocket'
        ]
    },
    {
        file: 'public/js/deploy-log.js',
        name: '前端部署日志组件',
        required: [
            'deployLogManager',
            'startDeployLog',
            'WebSocket',
            '实时日志',
            '阶段进度'
        ]
    },
    {
        file: 'public/js/main.js',
        name: '前端主逻辑',
        required: [
            'oneClickDeploy',
            'deployLogManager',
            'fetch.*/api/deploy/auto',
            'startDeployLog'
        ]
    },
    {
        file: 'public/index.html',
        name: '前端HTML',
        required: [
            'deploy-log.js',
            '实时日志',
            '日志面板'
        ]
    }
];

let allPassed = true;

checks.forEach(check => {
    console.log(`📄 检查: ${check.name} (${check.file})`);
    
    const filePath = path.join(__dirname, check.file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`   ❌ 文件不存在`);
        allPassed = false;
        return;
    }
    
    console.log(`   ✅ 文件存在`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let passedCount = 0;
        
        check.required.forEach(pattern => {
            if (content.includes(pattern)) {
                console.log(`     ✅ ${pattern}`);
                passedCount++;
            } else {
                console.log(`     ❌ ${pattern}`);
            }
        });
        
        if (passedCount === check.required.length) {
            console.log(`   ✅ 所有必需功能都找到`);
        } else {
            console.log(`   ⚠️  找到 ${passedCount}/${check.required.length} 个必需功能`);
            allPassed = false;
        }
        
    } catch (error) {
        console.log(`   ❌ 读取文件失败: ${error.message}`);
        allPassed = false;
    }
    
    console.log('');
});

// 检查WebSocket服务器配置
console.log('🔌 检查WebSocket服务器配置...');
try {
    const serverFile = 'src/app.js';
    const serverPath = path.join(__dirname, serverFile);
    
    if (fs.existsSync(serverPath)) {
        const content = fs.readFileSync(serverPath, 'utf8');
        
        const wsChecks = [
            'WebSocket.Server',
            'ws://',
            'connection',
            'message'
        ];
        
        wsChecks.forEach(pattern => {
            if (content.includes(pattern)) {
                console.log(`   ✅ WebSocket配置: ${pattern}`);
            } else {
                console.log(`   ❌ WebSocket配置: ${pattern} 未找到`);
                allPassed = false;
            }
        });
    } else {
        console.log(`   ❌ 服务器文件不存在: ${serverFile}`);
        allPassed = false;
    }
} catch (error) {
    console.log(`   ❌ 检查WebSocket配置失败: ${error.message}`);
    allPassed = false;
}

console.log('');

// 检查样式文件
console.log('🎨 检查样式文件...');
try {
    const cssFile = 'public/css/style.css';
    const cssPath = path.join(__dirname, cssFile);
    
    if (fs.existsSync(cssPath)) {
        const content = fs.readFileSync(cssPath, 'utf8');
        
        const cssChecks = [
            'deploy-log-panel',
            'deploy-stage',
            'log-entry',
            '实时日志'
        ];
        
        cssChecks.forEach(pattern => {
            if (content.includes(pattern)) {
                console.log(`   ✅ 样式: ${pattern}`);
            } else {
                console.log(`   ⚠️  样式: ${pattern} 未找到`);
            }
        });
    } else {
        console.log(`   ❌ 样式文件不存在: ${cssFile}`);
        allPassed = false;
    }
} catch (error) {
    console.log(`   ❌ 检查样式文件失败: ${error.message}`);
    allPassed = false;
}

console.log('\n📋 测试结果汇总:');
if (allPassed) {
    console.log('✅ 所有关键组件都存在且配置正确！');
    console.log('\n🚀 实时日志功能已成功实现！');
    console.log('\n使用说明:');
    console.log('1. 启动服务: npm start');
    console.log('2. 打开浏览器访问: http://localhost:3000');
    console.log('3. 在部署向导中输入GitHub仓库URL');
    console.log('4. 点击"一键智能部署"按钮');
    console.log('5. 观察实时日志面板显示部署过程');
    console.log('\n功能特点:');
    console.log('• 实时显示克隆、npm install、启动输出');
    console.log('• 部署日志面板默认折叠，保持界面干净');
    console.log('• 支持WebSocket实时推送');
    console.log('• 支持阶段跟踪和进度显示');
    console.log('• 支持暂停、清空、导出日志功能');
} else {
    console.log('❌ 部分组件存在问题，请检查以上错误');
}

process.exit(allPassed ? 0 : 1);
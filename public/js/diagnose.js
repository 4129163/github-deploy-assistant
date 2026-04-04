// GitHub Deploy Assistant - 诊断模块

// 诊断检查项
const DiagnosticChecks = {
    system: [
        { id: 'disk_space', name: '磁盘空间', description: '检查磁盘可用空间' },
        { id: 'memory', name: '内存使用', description: '检查内存使用情况' },
        { id: 'cpu', name: 'CPU负载', description: '检查CPU负载情况' },
        { id: 'network', name: '网络连接', description: '检查网络连接状态' },
        { id: 'ports', name: '端口占用', description: '检查常用端口占用情况' }
    ],
    
    dependencies: [
        { id: 'nodejs', name: 'Node.js', description: '检查Node.js版本和安装' },
        { id: 'npm', name: 'NPM', description: '检查NPM版本和配置' },
        { id: 'git', name: 'Git', description: '检查Git安装和配置' },
        { id: 'python', name: 'Python', description: '检查Python安装' },
        { id: 'docker', name: 'Docker', description: '检查Docker安装和运行状态' }
    ],
    
    project: [
        { id: 'files', name: '项目文件', description: '检查项目文件完整性' },
        { id: 'deps', name: '项目依赖', description: '检查项目依赖完整性' },
        { id: 'config', name: '配置文件', description: '检查配置文件正确性' },
        { id: 'env', name: '环境变量', description: '检查环境变量配置' },
        { id: 'permissions', name: '文件权限', description: '检查文件和目录权限' }
    ]
};

// 诊断结果存储
let diagnosticResults = {
    system: {},
    dependencies: {},
    project: {},
    timestamp: null
};

// 初始化诊断模块
function initDiagnostics() {
    console.log('初始化诊断模块...');
    
    // 绑定诊断相关事件
    bindDiagnosticEvents();
    
    // 加载诊断配置
    loadDiagnosticConfig();
    
    console.log('诊断模块初始化完成');
}

// 绑定诊断事件
function bindDiagnosticEvents() {
    // 全局诊断按钮
    const globalDiagnoseBtn = document.getElementById('global-diagnose-btn');
    if (globalDiagnoseBtn) {
        globalDiagnoseBtn.addEventListener('click', runGlobalDiagnostics);
    }
    
    // 项目诊断按钮（在main.js中已绑定）
    
    // 一键修复按钮
    const quickFixBtn = document.getElementById('quick-fix-btn');
    if (quickFixBtn) {
        quickFixBtn.addEventListener('click', quickFixAllIssues);
    }
}

// 运行全局诊断
async function runGlobalDiagnostics() {
    showLoading('正在运行全局诊断...');
    
    try {
        // 运行所有诊断检查
        const results = await Promise.all([
            runSystemChecks(),
            runDependencyChecks(),
            runProjectChecks()
        ]);
        
        // 合并结果
        diagnosticResults = {
            system: results[0],
            dependencies: results[1],
            project: results[2],
            timestamp: new Date().toISOString()
        };
        
        // 显示诊断报告
        displayDiagnosticReport();
        
        addLog('success', '全局诊断完成');
        
    } catch (error) {
        console.error('诊断失败:', error);
        showError('诊断过程中出现错误');
    } finally {
        hideLoading();
    }
}

// 运行项目诊断
async function runProjectDiagnostics(projectId) {
    if (!projectId && currentProject) {
        projectId = currentProject.id;
    }
    
    if (!projectId) {
        showError('请先选择项目');
        return;
    }
    
    showLoading('正在运行项目诊断...');
    
    try {
        // 运行项目相关检查
        const projectChecks = await runProjectChecks(projectId);
        
        // 运行依赖检查
        const dependencyChecks = await runDependencyChecks();
        
        // 运行系统检查
        const systemChecks = await runSystemChecks();
        
        // 保存结果
        diagnosticResults = {
            system: systemChecks,
            dependencies: dependencyChecks,
            project: projectChecks,
            timestamp: new Date().toISOString()
        };
        
        // 显示诊断报告
        displayDiagnosticReport();
        
        addLog('success', `项目 ${projectId} 诊断完成`);
        
    } catch (error) {
        console.error('项目诊断失败:', error);
        showError('项目诊断过程中出现错误');
    } finally {
        hideLoading();
    }
}

// 运行系统检查
async function runSystemChecks() {
    const results = {};
    
    for (const check of DiagnosticChecks.system) {
        try {
            results[check.id] = await runSystemCheck(check.id);
        } catch (error) {
            results[check.id] = {
                status: 'error',
                message: `检查失败: ${error.message}`,
                value: null
            };
        }
    }
    
    return results;
}

// 运行单个系统检查
async function runSystemCheck(checkId) {
    switch (checkId) {
        case 'disk_space':
            return await checkDiskSpace();
        case 'memory':
            return await checkMemoryUsage();
        case 'cpu':
            return await checkCpuLoad();
        case 'network':
            return await checkNetworkConnection();
        case 'ports':
            return await checkPorts();
        default:
            throw new Error(`未知的系统检查: ${checkId}`);
    }
}

// 运行依赖检查
async function runDependencyChecks() {
    const results = {};
    
    for (const check of DiagnosticChecks.dependencies) {
        try {
            results[check.id] = await runDependencyCheck(check.id);
        } catch (error) {
            results[check.id] = {
                status: 'error',
                message: `检查失败: ${error.message}`,
                value: null
            };
        }
    }
    
    return results;
}

// 运行单个依赖检查
async function runDependencyCheck(checkId) {
    switch (checkId) {
        case 'nodejs':
            return await checkNodeJS();
        case 'npm':
            return await checkNPM();
        case 'git':
            return await checkGit();
        case 'python':
            return await checkPython();
        case 'docker':
            return await checkDocker();
        default:
            throw new Error(`未知的依赖检查: ${checkId}`);
    }
}

// 运行项目检查
async function runProjectChecks(projectId) {
    const results = {};
    
    for (const check of DiagnosticChecks.project) {
        try {
            results[check.id] = await runProjectCheck(check.id, projectId);
        } catch (error) {
            results[check.id] = {
                status: 'error',
                message: `检查失败: ${error.message}`,
                value: null
            };
        }
    }
    
    return results;
}

// 运行单个项目检查
async function runProjectCheck(checkId, projectId) {
    const project = projectId ? 
        projects.find(p => p.id === projectId) : 
        currentProject;
    
    if (!project) {
        return {
            status: 'warning',
            message: '未找到项目信息',
            value: null
        };
    }
    
    switch (checkId) {
        case 'files':
            return await checkProjectFiles(project);
        case 'deps':
            return await checkProjectDependencies(project);
        case 'config':
            return await checkProjectConfig(project);
        case 'env':
            return await checkProjectEnvironment(project);
        case 'permissions':
            return await checkProjectPermissions(project);
        default:
            throw new Error(`未知的项目检查: ${checkId}`);
    }
}

// 具体的检查实现
async function checkDiskSpace() {
    // 模拟API调用
    return {
        status: 'warning',
        message: '磁盘空间不足，建议清理',
        value: '15GB 可用 / 100GB 总量',
        details: {
            available: 15,
            total: 100,
            usage: 85
        },
        severity: 'medium',
        fixable: true
    };
}

async function checkMemoryUsage() {
    return {
        status: 'good',
        message: '内存使用正常',
        value: '4.2GB / 8GB (52%)',
        details: {
            used: 4.2,
            total: 8,
            usage: 52
        },
        severity: 'low',
        fixable: false
    };
}

async function checkCpuLoad() {
    return {
        status: 'good',
        message: 'CPU负载正常',
        value: '24%',
        details: {
            load: 24,
            cores: 4
        },
        severity: 'low',
        fixable: false
    };
}

async function checkNetworkConnection() {
    return {
        status: 'good',
        message: '网络连接正常',
        value: '延迟: 45ms',
        details: {
            latency: 45,
            bandwidth: '100 Mbps'
        },
        severity: 'low',
        fixable: false
    };
}

async function checkPorts() {
    return {
        status: 'error',
        message: '端口 3000 已被占用',
        value: '进程: node (PID: 12345)',
        details: {
            port: 3000,
            process: 'node',
            pid: 12345
        },
        severity: 'high',
        fixable: true,
        fixSuggestion: '停止占用进程或修改项目端口'
    };
}

async function checkNodeJS() {
    return {
        status: 'good',
        message: 'Node.js 已安装',
        value: 'v18.15.0',
        details: {
            version: '18.15.0',
            path: '/usr/bin/node'
        },
        severity: 'low',
        fixable: false
    };
}

async function checkNPM() {
    return {
        status: 'good',
        message: 'NPM 已安装',
        value: 'v9.5.0',
        details: {
            version: '9.5.0',
            path: '/usr/bin/npm'
        },
        severity: 'low',
        fixable: false
    };
}

async function checkGit() {
    return {
        status: 'good',
        message: 'Git 已安装',
        value: 'v2.40.0',
        details: {
            version: '2.40.0',
            path: '/usr/bin/git'
        },
        severity: 'low',
        fixable: false
    };
}

async function checkPython() {
    return {
        status: 'warning',
        message: 'Python 版本较旧',
        value: 'v3.8.10',
        details: {
            version: '3.8.10',
            path: '/usr/bin/python3'
        },
        severity: 'medium',
        fixable: true,
        fixSuggestion: '建议升级到 Python 3.10+'
    };
}

async function checkDocker() {
    return {
        status: 'error',
        message: 'Docker 服务未运行',
        value: '服务状态: 停止',
        details: {
            installed: true,
            running: false,
            version: '24.0.5'
        },
        severity: 'high',
        fixable: true,
        fixSuggestion: '启动 Docker 服务: sudo systemctl start docker'
    };
}

async function checkProjectFiles(project) {
    return {
        status: 'good',
        message: '项目文件完整',
        value: '256 个文件',
        details: {
            totalFiles: 256,
            missingFiles: 0,
            size: '45.2 MB'
        },
        severity: 'low',
        fixable: false
    };
}

async function checkProjectDependencies(project) {
    return {
        status: 'warning',
        message: '发现过期的依赖包',
        value: '3 个依赖需要更新',
        details: {
            totalDeps: 42,
            outdatedDeps: 3,
            securityIssues: 0
        },
        severity: 'medium',
        fixable: true,
        fixSuggestion: '运行: npm update'
    };
}

async function checkProjectConfig(project) {
    return {
        status: 'good',
        message: '配置文件正常',
        value: '配置检查通过',
        details: {
            configFiles: ['package.json', '.env', 'config.json'],
            issues: 0
        },
        severity: 'low',
        fixable: false
    };
}

async function checkProjectEnvironment(project) {
    return {
        status: 'error',
        message: '缺少必要的环境变量',
        value: 'DATABASE_URL 未设置',
        details: {
            requiredVars: ['NODE_ENV', 'PORT', 'DATABASE_URL'],
            missingVars: ['DATABASE_URL']
        },
        severity: 'high',
        fixable: true,
        fixSuggestion: '在 .env 文件中添加 DATABASE_URL 变量'
    };
}

async function checkProjectPermissions(project) {
    return {
        status: 'good',
        message: '文件权限正常',
        value: '权限检查通过',
        details: {
            writable: true,
            readable: true,
            executable: true
        },
        severity: 'low',
        fixable: false
    };
}

// 显示诊断报告
function displayDiagnosticReport() {
    const reportHtml = generateDiagnosticReportHTML();
    
    showModal('诊断报告', reportHtml, null, 'large');
}

function generateDiagnosticReportHTML() {
    const timestamp = diagnosticResults.timestamp ? 
        new Date(diagnosticResults.timestamp).toLocaleString('zh-CN') : 
        '刚刚';
    
    // 统计问题
    const stats = countDiagnosticIssues();
    
    let html = `
        <div class="diagnostic-report">
            <div class="report-header">
                <div class="report-stats">
                    <div class="stat-item">
                        <span class="stat-value ${stats.errors > 0 ? 'stat-error' : ''}">${stats.errors}</span>
                        <span class="stat-label">严重问题</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value ${stats.warnings > 0 ? 'stat-warning' : ''}">${stats.warnings}</span>
                        <span class="stat-label">警告</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value stat-good">${stats.good}</span>
                        <span class="stat-label">正常</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${stats.fixable}</span>
                        <span class="stat-label">可修复</span>
                    </div>
                </div>
                <div class="report-meta">
                    <span>诊断时间: ${timestamp}</span>
                </div>
            </div>
    `;
    
    // 系统检查结果
    html += generateCheckSectionHTML('系统检查', DiagnosticChecks.system, diagnosticResults.system);
    
    // 依赖检查结果
    html += generateCheckSectionHTML('依赖检查', DiagnosticChecks.dependencies, diagnosticResults.dependencies);
    
    // 项目检查结果
    html += generateCheckSectionHTML('项目检查', DiagnosticChecks.project, diagnosticResults.project);
    
    // 修复建议
    if (stats.fixable > 0) {
        html += generateFixSuggestionsHTML();
    }
    
    html += `
            <div class="report-actions">
                <button class="btn btn-success" onclick="quickFixAllIssues()" ${stats.fixable === 0 ? 'disabled' : ''}>
                    <i class="fas fa-magic"></i> 一键修复所有问题
                </button>
                <button class="btn btn-primary" onclick="exportDiagnosticReport()">
                    <i class="fas fa-download"></i> 导出报告
                </button>
                <button class="btn btn-secondary" onclick="runGlobalDiagnostics()">
                    <i class="fas fa-redo"></i> 重新诊断
                </button>
            </div>
        </div>
    `;
    
    return html;
}

function generateCheckSectionHTML(title, checks, results) {
    let html = `
        <div class="check-section">
            <h4>${title}</h4>
            <div class="check-grid">
    `;
    
    checks.forEach(check => {
        const result = results[check.id] || { status: 'pending', message: '未检查' };
        const statusClass = getStatusClass(result.status);
        const statusIcon = getStatusIcon(result.status);
        
        html += `
            <div class="check-item ${statusClass}">
                <div class="check-header">
                    <div class="check-icon">${statusIcon}</div>
                    <div class="check-info">
                        <h5>${check.name}</h5>
                        <p>${check.description}</p>
                    </div>
                </div>
                <div class="check-result">
                    <span class="check-value">${result.value || 'N/A'}</span>
                    <span class="check-message">${result.message}</span>
                </div>
        `;
        
        if (result.fixable) {
            html += `
                <div class="check-fix">
                    <button class="btn btn-sm btn-outline" onclick="fixSingleIssue('${check.id}')">
                        <i class="fas fa-wrench"></i> 修复
                    </button>
                </div>
            `;
        }
        
        html += `</div>`;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function generateFixSuggestionsHTML() {
    const suggestions = collectFixSuggestions();
    
    let html = `
        <div class="fix-suggestions">
            <h4>修复建议</h4>
            <div class="suggestions-list">
    `;
    
    suggestions.forEach((suggestion, index) => {
        html += `
            <div class="suggestion-item">
                <div class="suggestion-header">
                    <span class="suggestion-number">${index + 1}</span>
                    <span class="suggestion-title">${suggestion.title}</span>
                    <span class="suggestion-severity severity-${suggestion.severity}">${suggestion.severity}</span>
                </div>
                <div class="suggestion-body">
                    <p>${suggestion.description}</p>
                    <div class="suggestion-command">
                        <code>${suggestion.command}</code>
                        <button class="btn btn-sm btn-primary" onclick="copyToClipboard('${suggestion.command}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div class="suggestion-actions">
                    <button class="btn btn-sm btn-success" onclick="applyFixSuggestion(${index})">
                        <i class="fas fa-play"></i> 执行修复
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="showFixDetails(${index})">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// 修复功能
async function quickFixAllIssues() {
    const confirm = window.confirm('确定要一键修复所有可修复的问题吗？');
    if (!confirm) return;
    
    showLoading('正在修复所有问题...');
    
    try {
        const fixes = collectFixSuggestions();
        let fixedCount = 0;
        
        for (const fix of fixes) {
            try {
                await applyFix(fix);
                fixedCount++;
            } catch (error) {
                console.warn(`修复失败: ${fix.title}`, error);
            }
        }
        
        addLog('success', `已修复 ${fixedCount} 个问题`);
        showNotification('success', `已修复 ${fixedCount} 个问题`, 5000);
        
        // 重新运行诊断
        setTimeout(runGlobalDiagnostics, 2000);
        
    } catch (error) {
        console.error('一键修复失败:', error);
        showError('一键修复过程中出现错误');
    } finally {
        hideLoading();
    }
}

async function fixSingleIssue(checkId) {
    const fix = findFixForCheck(checkId);
    if (!fix) {
        showError('未找到该问题的修复方案');
        return;
    }
    
    const confirm = window.confirm(`确定要修复 "${fix.title}" 吗？`);
    if (!confirm) return;
    
    showLoading(`正在修复: ${fix.title}`);
    
    try {
        await applyFix(fix);
        
        addLog('success', `已修复: ${fix.title}`);
        showNotification('success', '修复完成', 3000);
        
        // 重新运行相关检查
        setTimeout(() => {
            runSpecificCheck(checkId);
        }, 1000);
        
    } catch (error) {
        console.error('修复失败:', error);
        showError(`修复失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function applyFix(fix) {
    // 这里应该调用实际的修复API
    // 现在只是模拟
    return new Promise(resolve => {
        setTimeout(() => {
            console.log('执行修复:', fix.command);
            resolve();
        }, 1500);
    });
}

function applyFixSuggestion(index) {
    const suggestions = collectFixSuggestions();
    if (index >= 0 && index < suggestions.length) {
        fixSingleIssueBySuggestion(suggestions[index]);
    }
}

function fixSingleIssueBySuggestion(suggestion) {
    // 找到对应的检查ID并修复
    const checkId = findCheckIdBySuggestion(suggestion);
    if (checkId) {
        fixSingleIssue(checkId);
    }
}

// 辅助函数
function countDiagnosticIssues() {
    const stats = {
        errors: 0,
        warnings: 0,
        good: 0,
        fixable: 0
    };
    
    // 统计所有检查结果
    const allResults = [
        ...Object.values(diagnosticResults.system || {}),
        ...Object.values(diagnosticResults.dependencies || {}),
        ...Object.values(diagnosticResults.project || {})
    ];
    
    allResults.forEach(result => {
        switch (result.status) {
            case 'error':
                stats.errors++;
                break;
            case 'warning':
                stats.warnings++;
                break;
            case 'good':
                stats.good++;
                break;
        }
        
        if (result.fixable) {
            stats.fixable++;
        }
    });
    
    return stats;
}

function collectFixSuggestions() {
    const suggestions = [];
    
    // 收集系统检查的修复建议
    Object.entries(diagnosticResults.system || {}).forEach(([checkId, result]) => {
        if (result.fixable && result.fixSuggestion) {
            suggestions.push({
                checkId,
                title: DiagnosticChecks.system.find(c => c.id === checkId)?.name || checkId,
                description: result.message,
                command: result.fixSuggestion,
                severity: result.severity || 'medium'
            });
        }
    });
    
    // 收集依赖检查的修复建议
    Object.entries(diagnosticResults.dependencies || {}).forEach(([checkId, result]) => {
        if (result.fixable && result.fixSuggestion) {
            suggestions.push({
                checkId,
                title: DiagnosticChecks.dependencies.find(c => c.id === checkId)?.name || checkId,
                description: result.message,
                command: result.fixSuggestion,
                severity: result.severity || 'medium'
            });
        }
    });
    
    // 收集项目检查的修复建议
    Object.entries(diagnosticResults.project || {}).forEach(([checkId, result]) => {
        if (result.fixable && result.fixSuggestion) {
            suggestions.push({
                checkId,
                title: DiagnosticChecks.project.find(c => c.id === checkId)?.name || checkId,
                description: result.message,
                command: result.fixSuggestion,
                severity: result.severity || 'medium'
            });
        }
    });
    
    return suggestions;
}

function findFixForCheck(checkId) {
    const suggestions = collectFixSuggestions();
    return suggestions.find(s => s.checkId === checkId);
}

function findCheckIdBySuggestion(suggestion) {
    // 在诊断结果中查找匹配的检查
    const allChecks = [
        ...DiagnosticChecks.system,
        ...DiagnosticChecks.dependencies,
        ...DiagnosticChecks.project
    ];
    
    const check = allChecks.find(c => c.name === suggestion.title);
    return check?.id;
}

function getStatusClass(status) {
    const classMap = {
        'good': 'status-good',
        'warning': 'status-warning',
        'error': 'status-error',
        'pending': 'status-pending'
    };
    return classMap[status] || 'status-unknown';
}

function getStatusIcon(status) {
    const iconMap = {
        'good': '✓',
        'warning': '⚠',
        'error': '✗',
        'pending': '⋯'
    };
    return iconMap[status] || '?';
}

async function runSpecificCheck(checkId) {
    // 重新运行特定的检查
    // 实现取决于具体的检查类型
    console.log('重新运行检查:', checkId);
}

function exportDiagnosticReport() {
    const report = {
        diagnosticResults,
        timestamp: new Date().toISOString(),
        project: currentProject || null
    };
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `diagnostic-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addLog('info', '诊断报告已导出');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('success', '已复制到剪贴板', 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        showError('复制失败');
    });
}

function showFixDetails(index) {
    const suggestions = collectFixSuggestions();
    if (index >= 0 && index < suggestions.length) {
        const fix = suggestions[index];
        
        showModal('修复详情', `
            <div class="fix-details">
                <h4>${fix.title}</h4>
                <div class="detail-section">
                    <h5>问题描述</h5>
                    <p>${fix.description}</p>
                </div>
                <div class="detail-section">
                    <h5>修复命令</h5>
                    <pre class="fix-command">${fix.command}</pre>
                </div>
                <div class="detail-section">
                    <h5>严重程度</h5>
                    <span class="severity-badge severity-${fix.severity}">${fix.severity}</span>
                </div>
                <div class="detail-section">
                    <h5>影响范围</h5>
                    <p>此修复将影响相关服务的运行，建议在维护窗口执行。</p>
                </div>
                <div class="detail-actions">
                    <button class="btn btn-success" onclick="applyFixSuggestion(${index})">
                        <i class="fas fa-play"></i> 执行修复
                    </button>
                    <button class="btn btn-primary" onclick="copyToClipboard('${fix.command}')">
                        <i class="fas fa-copy"></i> 复制命令
                    </button>
                </div>
            </div>
        `);
    }
}

// 加载诊断配置
function loadDiagnosticConfig() {
    const savedConfig = localStorage.getItem('gada-diagnostic-config');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            // 应用配置
            console.log('加载诊断配置:', config);
        } catch (error) {
            console.warn('诊断配置解析失败:', error);
        }
    }
}

// 保存诊断配置
function saveDiagnosticConfig(config) {
    try {
        localStorage.setItem('gada-diagnostic-config', JSON.stringify(config));
    } catch (error) {
        console.warn('保存诊断配置失败:', error);
    }
}

// 导出函数
window.initDiagnostics = initDiagnostics;
window.runGlobalDiagnostics = runGlobalDiagnostics;
window.runProjectDiagnostics = runProjectDiagnostics;
window.quickFixAllIssues = quickFixAllIssues;
window.fixSingleIssue = fixSingleIssue;
window.exportDiagnosticReport = exportDiagnosticReport;
window.applyFixSuggestion = applyFixSuggestion;
window.showFixDetails = showFixDetails;

// 在初始化完成后调用
setTimeout(initDiagnostics, 1000);
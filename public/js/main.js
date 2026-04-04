// GitHub Deploy Assistant - 主JavaScript文件

// 全局变量
let currentProject = null;
let projects = [];
let websocket = null;
let isLogsPaused = false;

// DOM元素
const elements = {
    // 顶部导航
    systemStatus: document.getElementById('system-status'),
    projectCount: document.getElementById('project-count'),
    refreshBtn: document.getElementById('refresh-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    
    // 侧边栏
    projectList: document.getElementById('project-list'),
    addProjectBtn: document.getElementById('add-project-btn'),
    quickAddBtn: document.getElementById('quick-add-btn'),
    cpuUsage: document.getElementById('cpu-usage'),
    memoryUsage: document.getElementById('memory-usage'),
    diskUsage: document.getElementById('disk-usage'),
    
    // 主面板
    selectedProjectTitle: document.getElementById('selected-project-title'),
    projectStatusDisplay: document.getElementById('project-status-display'),
    projectCard: document.getElementById('project-card'),
    deploymentWizard: document.getElementById('deployment-wizard'),
    
    // 项目信息
    projectName: document.getElementById('project-name'),
    projectType: document.getElementById('project-type'),
    projectPort: document.getElementById('project-port'),
    projectPath: document.getElementById('project-path'),
    
    // 核心操作按钮
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    restartBtn: document.getElementById('restart-btn'),
    logsBtn: document.getElementById('logs-btn'),
    
    // 配置管理按钮
    editPortBtn: document.getElementById('edit-port-btn'),
    editEnvBtn: document.getElementById('edit-env-btn'),
    updateDepsBtn: document.getElementById('update-deps-btn'),
    rebuildBtn: document.getElementById('rebuild-btn'),
    
    // 高级操作按钮
    backupBtn: document.getElementById('backup-btn'),
    rollbackBtn: document.getElementById('rollback-btn'),
    diagnoseBtn: document.getElementById('diagnose-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    
    // 更多选项按钮
    healthCheckBtn: document.getElementById('health-check-btn'),
    metricsBtn: document.getElementById('metrics-btn'),
    exportConfigBtn: document.getElementById('export-config-btn'),
    importConfigBtn: document.getElementById('import-config-btn'),
    moreOptionsToggle: document.getElementById('more-options-toggle'),
    moreOptions: document.getElementById('more-options'),
    
    // 部署向导
    oneClickDeployBtn: document.getElementById('one-click-deploy-btn'),
    stepByStepBtn: document.getElementById('step-by-step-btn'),
    remoteDeployBtn: document.getElementById('remote-deploy-btn'),
    repoUrl: document.getElementById('repo-url'),
    analyzeBtn: document.getElementById('analyze-btn'),
    projectNameInput: document.getElementById('project-name-input'),
    projectPortInput: document.getElementById('project-port-input'),
    
    // 底部日志
    clearLogsBtn: document.getElementById('clear-logs-btn'),
    pauseLogsBtn: document.getElementById('pause-logs-btn'),
    exportLogsBtn: document.getElementById('export-logs-btn'),
    toggleLogsBtn: document.getElementById('toggle-logs-btn'),
    logContainer: document.getElementById('log-container'),
    
    // 模态框
    modalOverlay: document.getElementById('modal-overlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn')
};

// 初始化函数
function init() {
    console.log('GitHub Deploy Assistant UI 初始化...');
    
    // 绑定事件监听器
    bindEvents();
    
    // 加载初始数据
    loadInitialData();
    
    // 连接WebSocket
    connectWebSocket();
    
    // 开始系统监控
    startSystemMonitoring();
    
    console.log('UI 初始化完成');
}

// 绑定所有事件
function bindEvents() {
    // 顶部导航
    elements.refreshBtn.addEventListener('click', refreshAll);
    elements.settingsBtn.addEventListener('click', openSettings);
    
    // 侧边栏
    elements.addProjectBtn.addEventListener('click', openAddProjectModal);
    elements.quickAddBtn.addEventListener('click', openQuickAddModal);
    
    // 核心操作按钮
    elements.startBtn.addEventListener('click', startProject);
    elements.stopBtn.addEventListener('click', stopProject);
    elements.restartBtn.addEventListener('click', restartProject);
    elements.logsBtn.addEventListener('click', viewLogs);
    
    // 配置管理按钮
    elements.editPortBtn.addEventListener('click', editPort);
    elements.editEnvBtn.addEventListener('click', editEnvironment);
    elements.updateDepsBtn.addEventListener('click', updateDependencies);
    elements.rebuildBtn.addEventListener('click', rebuildProject);
    
    // 高级操作按钮
    elements.backupBtn.addEventListener('click', backupProject);
    elements.rollbackBtn.addEventListener('click', rollbackProject);
    elements.diagnoseBtn.addEventListener('click', diagnoseProject);
    elements.deleteBtn.addEventListener('click', deleteProject);
    
    // 更多选项
    elements.moreOptionsToggle.addEventListener('click', toggleMoreOptions);
    elements.healthCheckBtn.addEventListener('click', healthCheck);
    elements.metricsBtn.addEventListener('click', viewMetrics);
    elements.exportConfigBtn.addEventListener('click', exportConfig);
    elements.importConfigBtn.addEventListener('click', importConfig);
    
    // 部署向导
    elements.oneClickDeployBtn.addEventListener('click', oneClickDeploy);
    elements.stepByStepBtn.addEventListener('click', stepByStepDeploy);
    elements.remoteDeployBtn.addEventListener('click', remoteDeploy);
    elements.analyzeBtn.addEventListener('click', analyzeRepository);
    
    // 底部日志控制
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    elements.pauseLogsBtn.addEventListener('click', toggleLogsPause);
    elements.exportLogsBtn.addEventListener('click', exportLogs);
    elements.toggleLogsBtn.addEventListener('click', toggleLogsPanel);
    
    // 模态框控制
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalCancelBtn.addEventListener('click', closeModal);
    elements.modalConfirmBtn.addEventListener('click', confirmModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) {
            closeModal();
        }
    });
    
    // 全局键盘快捷键
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// 加载初始数据
async function loadInitialData() {
    try {
        showLoading('正在加载项目列表...');
        
        // 模拟API调用
        setTimeout(() => {
            // 模拟项目数据
            projects = [
                {
                    id: 1,
                    name: 'my-react-app',
                    type: 'React',
                    port: 3000,
                    path: '/home/user/projects/my-react-app',
                    status: 'running',
                    lastActive: '2026-04-04T12:30:00Z'
                },
                {
                    id: 2,
                    name: 'api-service',
                    type: 'Node.js',
                    port: 8080,
                    path: '/home/user/projects/api-service',
                    status: 'stopped',
                    lastActive: '2026-04-03T15:45:00Z'
                },
                {
                    id: 3,
                    name: 'data-processor',
                    type: 'Python',
                    port: 5000,
                    path: '/home/user/projects/data-processor',
                    status: 'error',
                    lastActive: '2026-04-04T10:15:00Z'
                }
            ];
            
            updateProjectList();
            updateSystemStatus();
            hideLoading();
            
        }, 1000);
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败，请检查网络连接');
        hideLoading();
    }
}

// 更新项目列表
function updateProjectList() {
    const projectList = elements.projectList;
    projectList.innerHTML = '';
    
    if (projects.length === 0) {
        projectList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>暂无项目</p>
                <button class="btn btn-primary" id="quick-add-btn">
                    <i class="fas fa-plus-circle"></i> 快速添加
                </button>
            </div>
        `;
        
        // 重新绑定事件
        document.getElementById('quick-add-btn').addEventListener('click', openQuickAddModal);
        return;
    }
    
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.dataset.id = project.id;
        
        const statusClass = getStatusClass(project.status);
        const statusText = getStatusText(project.status);
        
        projectItem.innerHTML = `
            <div class="project-item-header">
                <h4>${project.name}</h4>
                <span class="project-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="project-item-info">
                <span><i class="fas fa-network-wired"></i> ${project.type}</span>
                <span><i class="fas fa-plug"></i> ${project.port}</span>
            </div>
            <div class="project-item-actions">
                <button class="btn btn-sm ${project.status === 'running' ? 'btn-danger' : 'btn-success'}" 
                        onclick="handleProjectAction(${project.id}, '${project.status === 'running' ? 'stop' : 'start'}')">
                    <i class="fas fa-${project.status === 'running' ? 'stop' : 'play'}"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="selectProject(${project.id})">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        `;
        
        projectItem.addEventListener('click', (e) => {
            if (!e.target.closest('.project-item-actions')) {
                selectProject(project.id);
            }
        });
        
        projectList.appendChild(projectItem);
    });
    
    // 更新项目计数
    elements.projectCount.textContent = `${projects.length} 个项目`;
}

// 选择项目
function selectProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    currentProject = project;
    
    // 更新UI显示选中的项目
    updateProjectCard(project);
    
    // 显示项目卡片，隐藏部署向导
    elements.projectCard.classList.remove('hidden');
    elements.deploymentWizard.classList.add('hidden');
    
    // 更新按钮状态
    updateButtonStates(project.status);
}

// 更新项目卡片
function updateProjectCard(project) {
    elements.selectedProjectTitle.textContent = project.name;
    elements.projectName.textContent = project.name;
    elements.projectType.textContent = project.type;
    elements.projectPort.textContent = project.port;
    elements.projectPath.textContent = project.path;
    
    // 更新状态显示
    updateProjectStatusDisplay(project.status);
}

// 更新项目状态显示
function updateProjectStatusDisplay(status) {
    const statusText = getStatusText(status);
    const statusClass = getStatusClass(status);
    
    elements.projectStatusDisplay.innerHTML = `
        <span class="status-badge ${statusClass}">${statusText}</span>
    `;
}

// 更新按钮状态
function updateButtonStates(status) {
    // 启用所有按钮
    const buttons = [
        elements.startBtn,
        elements.stopBtn,
        elements.restartBtn,
        elements.logsBtn,
        elements.editPortBtn,
        elements.editEnvBtn,
        elements.updateDepsBtn,
        elements.rebuildBtn,
        elements.backupBtn,
        elements.rollbackBtn,
        elements.diagnoseBtn,
        elements.deleteBtn,
        elements.healthCheckBtn,
        elements.metricsBtn,
        elements.exportConfigBtn,
        elements.importConfigBtn
    ];
    
    buttons.forEach(btn => {
        btn.disabled = false;
    });
    
    // 根据状态调整特定按钮
    if (status === 'running') {
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;
        elements.restartBtn.disabled = false;
    } else if (status === 'stopped') {
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
        elements.restartBtn.disabled = true;
    } else if (status === 'error') {
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = false;
        elements.restartBtn.disabled = false;
    }
}

// 获取状态类名
function getStatusClass(status) {
    const statusMap = {
        'running': 'status-running',
        'stopped': 'status-stopped',
        'starting': 'status-starting',
        'error': 'status-error'
    };
    return statusMap[status] || 'status-unknown';
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'running': '运行中',
        'stopped': '已停止',
        'starting': '启动中',
        'error': '错误'
    };
    return statusMap[status] || '未知';
}

// 项目操作处理
function handleProjectAction(projectId, action) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    switch (action) {
        case 'start':
            startSpecificProject(projectId);
            break;
        case 'stop':
            stopSpecificProject(projectId);
            break;
        case 'restart':
            restartSpecificProject(projectId);
            break;
    }
}

// 启动特定项目
function startSpecificProject(projectId) {
    showLoading(`正在启动项目 ${projectId}...`);
    
    // 模拟API调用
    setTimeout(() => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.status = 'running';
            updateProjectList();
            
            if (currentProject && currentProject.id === projectId) {
                updateProjectStatusDisplay('running');
                updateButtonStates('running');
            }
            
            addLog('success', `项目 ${project.name} 已启动成功`);
        }
        hideLoading();
    }, 1500);
}

// 停止特定项目
function stopSpecificProject(projectId) {
    showLoading(`正在停止项目 ${projectId}...`);
    
    // 模拟API调用
    setTimeout(() => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.status = 'stopped';
            updateProjectList();
            
            if (currentProject && currentProject.id === projectId) {
                updateProjectStatusDisplay('stopped');
                updateButtonStates('stopped');
            }
            
            addLog('warning', `项目 ${project.name} 已停止`);
        }
        hideLoading();
    }, 1000);
}

// 重启特定项目
function restartSpecificProject(projectId) {
    showLoading(`正在重启项目 ${projectId}...`);
    
    // 模拟API调用
    setTimeout(() => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.status = 'starting';
            updateProjectList();
            
            if (currentProject && currentProject.id === projectId) {
                updateProjectStatusDisplay('starting');
            }
            
            addLog('info', `项目 ${project.name} 正在重启...`);
            
            // 模拟重启完成
            setTimeout(() => {
                project.status = 'running';
                updateProjectList();
                
                if (currentProject && currentProject.id === projectId) {
                    updateProjectStatusDisplay('running');
                    updateButtonStates('running');
                }
                
                addLog('success', `项目 ${project.name} 重启完成`);
            }, 2000);
        }
        hideLoading();
    }, 500);
}

// 核心操作函数
function startProject() {
    if (!currentProject) return;
    startSpecificProject(currentProject.id);
}

function stopProject() {
    if (!currentProject) return;
    stopSpecificProject(currentProject.id);
}

function restartProject() {
    if (!currentProject) return;
    restartSpecificProject(currentProject.id);
}

function viewLogs() {
    if (!currentProject) return;
    showModal('项目日志', `
        <div class="log-preview">
            <h4>${currentProject.name} 的日志</h4>
            <pre class="log-content">
[2026-04-04 12:30:15] 项目启动成功
[2026-04-04 12:30:20] 监听端口: ${currentProject.port}
[2026-04-04 12:30:25] 数据库连接成功
[2026-04-04 12:30:30] API服务已就绪
[2026-04-04 12:31:00] 收到第一个请求
            </pre>
            <div class="log-controls">
                <button class="btn btn-sm btn-primary">
                    <i class="fas fa-download"></i> 下载完整日志
                </button>
                <button class="btn btn-sm btn-dark">
                    <i class="fas fa-trash"></i> 清空日志
                </button>
            </div>
        </div>
    `);
}

// 配置管理函数
function editPort() {
    if (!currentProject) return;
    
    showModal('修改端口', `
        <div class="form-group">
            <label for="new-port">新的端口号</label>
            <input type="number" id="new-port" class="form-control" 
                   value="${currentProject.port}" min="1024" max="65535">
            <small class="form-text">端口范围: 1024 - 65535</small>
        </div>
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            修改端口后需要重启项目才能生效
        </div>
    `, () => {
        const newPort = document.getElementById('new-port').value;
        if (newPort && newPort !== currentProject.port) {
            currentProject.port = parseInt(newPort);
            updateProjectCard(currentProject);
            addLog('info', `项目 ${currentProject.name} 的端口已修改为 ${newPort}`);
        }
    });
}

function editEnvironment() {
    if (!currentProject) return;
    
    showModal('环境变量管理', `
        <div class="form-group">
            <label for="env-content">环境变量 (每行一个 KEY=VALUE)</label>
            <textarea id="env-content" class="form-control" rows="10">
NODE_ENV=production
PORT=${currentProject.port}
DATABASE_URL=postgres://user:pass@localhost:5432/db
LOG_LEVEL=info
            </textarea>
        </div>
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            修改环境变量后需要重启项目才能生效
        </div>
    `, () => {
        const envContent = document.getElementById('env-content').value;
        addLog('info', `项目 ${currentProject.name} 的环境变量已更新`);
    });
}

function updateDependencies() {
    if (!currentProject) return;
    
    showLoading(`正在更新 ${currentProject.name} 的依赖...`);
    
    // 模拟更新过程
    setTimeout(() => {
        addLog('success', `项目 ${currentProject.name} 的依赖更新完成`);
        hideLoading();
    }, 2000);
}

function rebuildProject() {
    if (!currentProject) return;
    
    const confirm = window.confirm(`确定要重新构建 ${currentProject.name} 吗？这可能需要几分钟时间。`);
    if (!confirm) return;
    
    showLoading(`正在重新构建 ${currentProject.name}...`);
    
    // 模拟构建过程
    setTimeout(() => {
        addLog('success', `项目 ${currentProject.name} 重新构建完成`);
        hideLoading();
    }, 3000);
}

// 高级操作函数
function backupProject() {
    if (!currentProject) return;
    
    showLoading(`正在备份 ${currentProject.name}...`);
    
    // 模拟备份过程
    setTimeout(() => {
        addLog('success', `项目 ${currentProject.name} 备份完成，已保存到备份目录`);
        hideLoading();
    }, 1500);
}

function rollbackProject() {
    if (!currentProject) return;
    
    showModal('回滚项目', `
        <div class="form-group">
            <label for="backup-select">选择要恢复的备份</label>
            <select id="backup-select" class="form-control">
                <option value="1">备份 1 - 2026-04-04 12:00:00</option>
                <option value="2">备份 2 - 2026-04-03 18:30:00</option>
                <option value="3">备份 3 - 2026-04-02 09:15:00</option>
            </select>
        </div>
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle"></i>
            警告：回滚将覆盖当前项目文件，请谨慎操作！
        </div>
    `, () => {
        const backupId = document.getElementById('backup-select').value;
        showLoading(`正在从备份 ${backupId} 回滚 ${currentProject.name}...`);
        
        setTimeout(() => {
            addLog('success', `项目 ${currentProject.name} 回滚完成`);
            hideLoading();
        }, 2000);
    });
}

function diagnoseProject() {
    if (!currentProject) return;
    
    showLoading(`正在诊断 ${currentProject.name}...`);
    
    // 模拟诊断过程
    setTimeout(() => {
        showModal('项目诊断报告', `
            <div class="diagnosis-report">
                <h4>诊断结果</h4>
                <div class="result-item result-success">
                    <i class="fas fa-check-circle"></i>
                    <span>项目文件完整性: 正常</span>
                </div>
                <div class="result-item result-success">
                    <i class="fas fa-check-circle"></i>
                    <span>依赖包完整性: 正常</span>
                </div>
                <div class="result-item result-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>磁盘空间: 剩余 15GB (建议清理)</span>
                </div>
                <div class="result-item result-success">
                    <i class="fas fa-check-circle"></i>
                    <span>配置文件: 正常</span>
                </div>
                <div class="result-item result-error">
                    <i class="fas fa-times-circle"></i>
                    <span>端口 ${currentProject.port}: 已被占用</span>
                </div>
                
                <h5>建议操作</h5>
                <ul>
                    <li>清理磁盘缓存文件</li>
                    <li>修改项目端口或停止占用端口的进程</li>
                    <li>更新项目依赖到最新版本</li>
                </ul>
                
                <button class="btn btn-primary btn-block" onclick="fixDiagnosisIssues()">
                    <i class="fas fa-magic"></i> 一键修复所有问题
                </button>
            </div>
        `);
        hideLoading();
    }, 2500);
}

function deleteProject() {
    if (!currentProject) return;
    
    const projectName = currentProject.name;
    const confirm = window.confirm(`确定要删除项目 "${projectName}" 吗？此操作不可撤销！`);
    
    if (confirm) {
        showLoading(`正在删除项目 ${projectName}...`);
        
        // 模拟删除过程
        setTimeout(() => {
            // 从列表中移除
            const index = projects.findIndex(p => p.id === currentProject.id);
            if (index !== -1) {
                projects.splice(index, 1);
            }
            
            // 重置当前项目
            currentProject = null;
            
            // 更新UI
            updateProjectList();
            elements.projectCard.classList.add('hidden');
            elements.deploymentWizard.classList.remove('hidden');
            elements.selectedProjectTitle.textContent = '选择项目进行操作';
            
            addLog('warning', `项目 ${projectName} 已删除`);
            hideLoading();
        }, 1000);
    }
}

// 更多选项函数
function toggleMoreOptions() {
    const toggle = elements.moreOptionsToggle;
    const content = elements.moreOptions;
    
    content.classList.toggle('hidden');
    toggle.classList.toggle('active');
    
    const icon = toggle.querySelector('i');
    if (content.classList.contains('hidden')) {
        icon.className = 'fas fa-chevron-down';
    } else {
        icon.className = 'fas fa-chevron-up';
    }
}

function healthCheck() {
    if (!currentProject) return;
    
    showLoading(`正在对 ${currentProject.name} 进行健康检查...`);
    
    setTimeout(() => {
        showModal('健康检查结果', `
            <div class="health-check">
                <div class="check-item check-pass">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <h5>服务状态</h5>
                        <p>服务运行正常，响应时间: 45ms</p>
                    </div>
                </div>
                <div class="check-item check-pass">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <h5>API端点</h5>
                        <p>所有API端点均可正常访问</p>
                    </div>
                </div>
                <div class="check-item check-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <h5>内存使用</h5>
                        <p>内存使用率较高: 85%</p>
                    </div>
                </div>
                <div class="check-item check-pass">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <h5>数据库连接</h5>
                        <p>数据库连接正常，查询时间: 12ms</p>
                    </div>
                </div>
                <div class="check-item check-pass">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <h5>外部依赖</h5>
                        <p>所有外部服务均正常</p>
                    </div>
                </div>
            </div>
            
            <div class="health-score">
                <div class="score-circle">
                    <svg width="100" height="100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" stroke-width="8"></circle>
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#28a745" stroke-width="8" 
                                stroke-dasharray="283" stroke-dashoffset="56" transform="rotate(-90 50 50)"></circle>
                    </svg>
                    <div class="score-text">80%</div>
                </div>
                <p class="score-label">健康评分</p>
            </div>
        `);
        hideLoading();
    }, 1500);
}

function viewMetrics() {
    if (!currentProject) return;
    
    showModal('性能监控', `
        <div class="metrics-container">
            <h4>${currentProject.name} 性能指标</h4>
            
            <div class="metric-chart">
                <div class="chart-header">
                    <h5>CPU 使用率</h5>
                    <span class="chart-value">24%</span>
                </div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: 24%"></div>
                </div>
            </div>
            
            <div class="metric-chart">
                <div class="chart-header">
                    <h5>内存 使用率</h5>
                    <span class="chart-value">65%</span>
                </div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: 65%"></div>
                </div>
            </div>
            
            <div class="metric-chart">
                <div class="chart-header">
                    <h5>请求响应时间</h5>
                    <span class="chart-value">45ms</span>
                </div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: 45%"></div>
                </div>
            </div>
            
            <div class="metric-chart">
                <div class="chart-header">
                    <h5>错误率</h5>
                    <span class="chart-value">0.2%</span>
                </div>
                <div class="chart-bar">
                    <div class="chart-fill error-fill" style="width: 0.2%"></div>
                </div>
            </div>
            
            <div class="time-range">
                <button class="btn btn-sm btn-outline">1小时</button>
                <button class="btn btn-sm btn-outline active">24小时</button>
                <button class="btn btn-sm btn-outline">7天</button>
                <button class="btn btn-sm btn-outline">30天</button>
            </div>
        </div>
    `);
}

function exportConfig() {
    if (!currentProject) return;
    
    const config = {
        project: currentProject,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${currentProject.name}-config.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addLog('info', `项目 ${currentProject.name} 配置已导出`);
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const config = JSON.parse(event.target.result);
                showModal('导入配置', `
                    <div class="import-preview">
                        <h5>配置详情</h5>
                        <pre>${JSON.stringify(config, null, 2)}</pre>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            导入配置将覆盖当前项目设置
                        </div>
                    </div>
                `, () => {
                    addLog('info', `配置导入成功: ${config.project.name}`);
                });
            } catch (error) {
                showError('配置文件格式错误');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// 部署向导函数
function oneClickDeploy() {
    const repoUrl = elements.repoUrl.value.trim();
    if (!repoUrl) {
        showError('请输入GitHub仓库URL');
        return;
    }
    
    const projectName = elements.projectNameInput.value.trim() || 'new-project';
    const port = elements.projectPortInput.value || '3000';
    
    // 创建新项目
    const newProject = {
        id: projects.length + 1,
        name: projectName,
        type: 'Node.js', // 根据实际分析结果
        port: parseInt(port),
        path: `/home/user/projects/${projectName}`,
        status: 'deploying',
        lastActive: new Date().toISOString()
    };
    
    projects.push(newProject);
    updateProjectList();
    
    // 启动部署日志面板
    if (window.deployLogManager) {
        const deployLog = window.deployLogManager.startDeployLog(newProject.id, newProject.name);
        
        // 显示部署日志面板
        const deployLogPanel = document.getElementById('deploy-log-panel');
        if (deployLogPanel) {
            deployLogPanel.style.display = 'block';
        }
    }
    
    // 调用实时部署API
    showLoading(`正在一键部署 ${repoUrl}...`);
    
    fetch(`/api/deploy/auto/${newProject.id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            repoUrl,
            projectName,
            port
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            // 更新项目状态为运行中
            newProject.status = 'running';
            updateProjectList();
            
            addLog('success', `项目 ${projectName} 一键部署完成！`);
            
            // 自动选择新项目
            selectProject(newProject.id);
            
            // 部署完成，关闭日志面板
            if (window.deployLogManager) {
                const deployLog = window.deployLogManager.getDeployLog(newProject.id);
                if (deployLog) {
                    deployLog.complete(true, '部署成功完成');
                }
            }
        } else {
            // 部署失败
            newProject.status = 'error';
            updateProjectList();
            
            showError(`部署失败: ${data.error}`);
            
            // 部署失败，关闭日志面板
            if (window.deployLogManager) {
                const deployLog = window.deployLogManager.getDeployLog(newProject.id);
                if (deployLog) {
                    deployLog.complete(false, `部署失败: ${data.error}`);
                }
            }
        }
    })
    .catch(error => {
        hideLoading();
        
        // 更新项目状态为错误
        newProject.status = 'error';
        updateProjectList();
        
        showError(`部署请求失败: ${error.message}`);
        
        // 部署失败，关闭日志面板
        if (window.deployLogManager) {
            const deployLog = window.deployLogManager.getDeployLog(newProject.id);
            if (deployLog) {
                deployLog.complete(false, `部署请求失败: ${error.message}`);
            }
        }
    });
}

function stepByStepDeploy() {
    showModal('分步部署向导', `
        <div class="wizard-steps">
            <div class="wizard-step active">
                <div class="step-number">1</div>
                <div class="step-content">
                    <h5>仓库信息</h5>
                    <input type="url" class="form-control" placeholder="GitHub仓库URL" value="${elements.repoUrl.value}">
                </div>
            </div>
            <div class="wizard-step">
                <div class="step-number">2</div>
                <div class="step-content">
                    <h5>项目配置</h5>
                    <div class="form-row">
                        <input type="text" class="form-control" placeholder="项目名称" value="${elements.projectNameInput.value}">
                        <input type="number" class="form-control" placeholder="端口" value="${elements.projectPortInput.value}">
                    </div>
                </div>
            </div>
            <div class="wizard-step">
                <div class="step-number">3</div>
                <div class="step-content">
                    <h5>环境配置</h5>
                    <select class="form-control">
                        <option>Node.js环境</option>
                        <option>Python环境</option>
                        <option>Docker环境</option>
                        <option>自定义环境</option>
                    </select>
                </div>
            </div>
            <div class="wizard-step">
                <div class="step-number">4</div>
                <div class="step-content">
                    <h5>部署选项</h5>
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="auto-start" checked>
                        <label class="form-check-label" for="auto-start">部署后自动启动</label>
                    </div>
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="create-backup" checked>
                        <label class="form-check-label" for="create-backup">创建备份</label>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="wizard-navigation">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="startStepByStep()">开始部署</button>
        </div>
    `);
}

function remoteDeploy() {
    showModal('远程部署', `
        <div class="form-group">
            <label for="remote-host">远程主机</label>
            <input type="text" id="remote-host" class="form-control" placeholder="user@hostname">
        </div>
        <div class="form-group">
            <label for="remote-path">部署路径</label>
            <input type="text" id="remote-path" class="form-control" placeholder="/home/user/projects/">
        </div>
        <div class="form-group">
            <label for="auth-method">认证方式</label>
            <select id="auth-method" class="form-control">
                <option value="password">密码认证</option>
                <option value="key">SSH密钥</option>
            </select>
        </div>
        <div class="form-group" id="password-field">
            <label for="remote-password">密码</label>
            <input type="password" id="remote-password" class="form-control">
        </div>
        <div class="form-group hidden" id="key-field">
            <label for="ssh-key">SSH私钥</label>
            <textarea id="ssh-key" class="form-control" rows="6" placeholder="-----BEGIN RSA PRIVATE KEY-----"></textarea>
        </div>
        
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            确保远程主机已安装必要的运行环境
        </div>
    `, () => {
        const host = document.getElementById('remote-host').value;
        const path = document.getElementById('remote-path').value;
        
        if (host && path) {
            showLoading(`正在部署到远程主机 ${host}...`);
            
            setTimeout(() => {
                addLog('success', `项目已成功部署到远程主机: ${host}`);
                hideLoading();
            }, 2500);
        }
    });
}

function analyzeRepository() {
    const repoUrl = elements.repoUrl.value.trim();
    if (!repoUrl) {
        showError('请输入GitHub仓库URL');
        return;
    }
    
    showLoading(`正在分析仓库 ${repoUrl}...`);
    
    // 模拟分析过程
    setTimeout(() => {
        const analysis = {
            name: repoUrl.split('/').pop().replace('.git', ''),
            type: 'Node.js',
            description: '一个现代化的Web应用项目',
            dependencies: ['express', 'react', 'webpack'],
            port: 3000,
            size: '15.2 MB',
            stars: 245,
            lastUpdated: '2026-04-03'
        };
        
        showModal('仓库分析结果', `
            <div class="analysis-result">
                <h4>${analysis.name}</h4>
                <p>${analysis.description}</p>
                
                <div class="analysis-details">
                    <div class="detail-item">
                        <i class="fas fa-code"></i>
                        <span>项目类型: <strong>${analysis.type}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-plug"></i>
                        <span>推荐端口: <strong>${analysis.port}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-weight"></i>
                        <span>项目大小: <strong>${analysis.size}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-star"></i>
                        <span>GitHub Stars: <strong>${analysis.stars}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>最后更新: <strong>${analysis.lastUpdated}</strong></span>
                    </div>
                </div>
                
                <h5>主要依赖</h5>
                <div class="dependencies">
                    ${analysis.dependencies.map(dep => `<span class="dependency-tag">${dep}</span>`).join('')}
                </div>
                
                <div class="analysis-actions">
                    <button class="btn btn-success" onclick="useAnalysisResult()">
                        <i class="fas fa-check"></i> 使用此分析结果
                    </button>
                </div>
            </div>
        `);
        
        // 自动填充表单
        elements.projectNameInput.value = analysis.name;
        elements.projectPortInput.value = analysis.port;
        
        hideLoading();
    }, 2000);
}

// 系统状态函数
function refreshAll() {
    showLoading('正在刷新所有数据...');
    
    // 模拟刷新过程
    setTimeout(() => {
        loadInitialData();
        addLog('info', '系统数据已刷新');
    }, 1000);
}

function openSettings() {
    showModal('系统设置', `
        <div class="settings-tabs">
            <div class="settings-section">
                <h5><i class="fas fa-cog"></i> 常规设置</h5>
                <div class="form-group">
                    <label for="theme">主题</label>
                    <select id="theme" class="form-control">
                        <option value="light">浅色主题</option>
                        <option value="dark">深色主题</option>
                        <option value="auto">自动</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="language">语言</label>
                    <select id="language" class="form-control">
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-section">
                <h5><i class="fas fa-server"></i> 服务器设置</h5>
                <div class="form-group">
                    <label for="api-url">API地址</label>
                    <input type="url" id="api-url" class="form-control" value="http://localhost:3000">
                </div>
                <div class="form-group">
                    <label for="log-level">日志级别</label>
                    <select id="log-level" class="form-control">
                        <option value="debug">Debug</option>
                        <option value="info" selected>Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                </div>
            </div>
            
            <div class="settings-section">
                <h5><i class="fas fa-shield-alt"></i> 安全设置</h5>
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="auto-update" checked>
                    <label class="form-check-label" for="auto-update">自动检查更新</label>
                </div>
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="backup-auto" checked>
                    <label class="form-check-label" for="backup-auto">自动备份</label>
                </div>
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="https-only">
                    <label class="form-check-label" for="https-only">强制HTTPS</label>
                </div>
            </div>
        </div>
    `, () => {
        addLog('info', '系统设置已保存');
    });
}

function updateSystemStatus() {
    // 模拟系统状态更新
    const cpu = Math.floor(Math.random() * 30) + 10;
    const memory = Math.floor(Math.random() * 40) + 40;
    const disk = Math.floor(Math.random() * 20) + 60;
    
    elements.cpuUsage.textContent = `${cpu}%`;
    elements.memoryUsage.textContent = `${memory}%`;
    elements.diskUsage.textContent = `${disk}%`;
}

function startSystemMonitoring() {
    // 定期更新系统状态
    setInterval(updateSystemStatus, 10000);
    
    // 首次更新
    updateSystemStatus();
}

// WebSocket连接
function connectWebSocket() {
    try {
        // 这里应该是实际的WebSocket地址
        const wsUrl = 'ws://localhost:3000/ws';
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = () => {
            console.log('WebSocket连接已建立');
            addLog('success', 'WebSocket连接已建立');
        };
        
        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        websocket.onerror = (error) => {
            console.error('WebSocket错误:', error);
            addLog('error', 'WebSocket连接错误');
        };
        
        websocket.onclose = () => {
            console.log('WebSocket连接已关闭');
            setTimeout(connectWebSocket, 5000); // 5秒后重试
        };
        
    } catch (error) {
        console.error('WebSocket连接失败:', error);
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'log':
            if (!isLogsPaused) {
                addLog(data.level, data.message);
            }
            break;
        case 'project_update':
            updateProjectFromWebSocket(data.project);
            break;
        case 'system_status':
            updateSystemStatusFromWebSocket(data.status);
            break;
    }
}

// 日志管理函数
function addLog(level, message) {
    if (isLogsPaused) return;
    
    const logContainer = elements.logContainer;
    const time = new Date().toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-level">${level.toUpperCase()}</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLogs() {
    elements.logContainer.innerHTML = '';
    addLog('info', '日志已清空');
}

function toggleLogsPause() {
    isLogsPaused = !isLogsPaused;
    const btn = elements.pauseLogsBtn;
    const icon = btn.querySelector('i');
    
    if (isLogsPaused) {
        btn.classList.add('btn-warning');
        icon.className = 'fas fa-play';
        btn.title = '继续日志';
        addLog('warning', '日志已暂停');
    } else {
        btn.classList.remove('btn-warning');
        icon.className = 'fas fa-pause';
        btn.title = '暂停日志';
        addLog('info', '日志已继续');
    }
}

function exportLogs() {
    const logs = [];
    const logEntries = elements.logContainer.querySelectorAll('.log-entry');
    
    logEntries.forEach(entry => {
        const time = entry.querySelector('.log-time').textContent;
        const level = entry.querySelector('.log-level').textContent;
        const message = entry.querySelector('.log-message').textContent;
        logs.push(`${time} [${level}] ${message}`);
    });
    
    const dataStr = logs.join('\n');
    const dataUri = 'data:text/plain;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `gada-logs-${new Date().toISOString().split('T')[0]}.log`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addLog('info', '日志已导出');
}

function toggleLogsPanel() {
    const panel = document.querySelector('.bottom-panel');
    const btn = elements.toggleLogsBtn;
    const icon = btn.querySelector('i');
    
    if (panel.style.maxHeight === '0px' || !panel.style.maxHeight) {
        panel.style.maxHeight = '300px';
        icon.className = 'fas fa-chevron-up';
        btn.title = '隐藏日志';
    } else {
        panel.style.maxHeight = '0px';
        icon.className = 'fas fa-chevron-down';
        btn.title = '显示日志';
    }
}

// 模态框函数
function showModal(title, content, onConfirm = null) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.modalOverlay.classList.remove('hidden');
    
    // 存储确认回调
    if (onConfirm) {
        elements.modalConfirmBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
    } else {
        elements.modalConfirmBtn.onclick = closeModal;
    }
    
    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function confirmModal() {
    // 确认操作由具体函数设置
    closeModal();
}

// 辅助函数
function showLoading(message = '处理中...') {
    // 创建或显示加载指示器
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'global-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="loader-message">${message}</div>
            </div>
        `;
        document.body.appendChild(loader);
    } else {
        loader.querySelector('.loader-message').textContent = message;
        loader.classList.remove('hidden');
    }
}

function hideLoading() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

function showError(message) {
    // 显示错误消息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'global-error';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button class="error-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 3000);
}

function handleKeyboardShortcuts(e) {
    // 全局键盘快捷键
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'r':
                e.preventDefault();
                refreshAll();
                break;
            case 'n':
                e.preventDefault();
                openAddProjectModal();
                break;
            case 'l':
                e.preventDefault();
                toggleLogsPanel();
                break;
            case ',':
                e.preventDefault();
                openSettings();
                break;
        }
    }
}

// 其他辅助函数
function openAddProjectModal() {
    showModal('添加新项目', `
        <div class="add-project-form">
            <div class="form-group">
                <label for="new-repo-url">GitHub仓库URL</label>
                <input type="url" id="new-repo-url" class="form-control" 
                       placeholder="https://github.com/username/repository">
            </div>
            <div class="form-group">
                <label for="new-project-name">项目名称</label>
                <input type="text" id="new-project-name" class="form-control" 
                       placeholder="my-project">
            </div>
            <div class="form-group">
                <label for="new-project-port">端口号</label>
                <input type="number" id="new-project-port" class="form-control" 
                       placeholder="3000" min="1024" max="65535">
            </div>
            <div class="form-group">
                <label for="new-project-path">本地路径</label>
                <input type="text" id="new-project-path" class="form-control" 
                       placeholder="/home/user/projects/" value="/home/user/projects/">
            </div>
            <div class="form-check">
                <input type="checkbox" class="form-check-input" id="new-auto-deploy" checked>
                <label class="form-check-label" for="new-auto-deploy">自动部署</label>
            </div>
        </div>
    `, () => {
        const name = document.getElementById('new-project-name').value || 'new-project';
        const port = document.getElementById('new-project-port').value || '3000';
        
        const newProject = {
            id: projects.length + 1,
            name: name,
            type: '待分析',
            port: parseInt(port),
            path: document.getElementById('new-project-path').value + name,
            status: 'stopped',
            lastActive: new Date().toISOString()
        };
        
        projects.push(newProject);
        updateProjectList();
        addLog('info', `新项目 ${name} 已添加`);
    });
}

function openQuickAddModal() {
    // 预填充当前表单的值
    showModal('快速添加项目', `
        <div class="quick-add-form">
            <div class="form-group">
                <label for="quick-repo-url">GitHub仓库URL</label>
                <input type="url" id="quick-repo-url" class="form-control" 
                       placeholder="https://github.com/username/repository">
            </div>
            <div class="form-group">
                <label for="quick-project-name">项目名称</label>
                <input type="text" id="quick-project-name" class="form-control" 
                       placeholder="自动从URL提取">
            </div>
            <button class="btn btn-primary btn-block" onclick="analyzeQuickRepo()">
                <i class="fas fa-search"></i> 分析并添加
            </button>
        </div>
    `, () => {
        const url = document.getElementById('quick-repo-url').value;
        const name = document.getElementById('quick-project-name').value || url.split('/').pop().replace('.git', '');
        
        if (url) {
            const newProject = {
                id: projects.length + 1,
                name: name,
                type: '待部署',
                port: 3000,
                path: `/home/user/projects/${name}`,
                status: 'stopped',
                lastActive: new Date().toISOString()
            };
            
            projects.push(newProject);
            updateProjectList();
            selectProject(newProject.id);
            addLog('info', `快速添加项目: ${name}`);
        }
    });
}

function analyzeQuickRepo() {
    const url = document.getElementById('quick-repo-url').value;
    if (!url) {
        showError('请输入仓库URL');
        return;
    }
    
    const name = url.split('/').pop().replace('.git', '');
    document.getElementById('quick-project-name').value = name;
    
    showLoading(`正在分析 ${name}...`);
    setTimeout(() => {
        hideLoading();
        showModal('分析完成', `
            <div class="quick-analysis">
                <p>仓库分析完成！</p>
                <p><strong>项目名称:</strong> ${name}</p>
                <p><strong>推荐端口:</strong> 3000</p>
                <p><strong>项目类型:</strong> Node.js</p>
                <button class="btn btn-success btn-block" onclick="confirmQuickAdd()">
                    <i class="fas fa-check"></i> 确认添加
                </button>
            </div>
        `);
    }, 1500);
}

function confirmQuickAdd() {
    closeModal(); // 关闭分析结果模态框
    const url = document.getElementById('quick-repo-url').value;
    const name = document.getElementById('quick-project-name').value;
    
    if (url) {
        const newProject = {
            id: projects.length + 1,
            name: name,
            type: 'Node.js',
            port: 3000,
            path: `/home/user/projects/${name}`,
            status: 'stopped',
            lastActive: new Date().toISOString()
        };
        
        projects.push(newProject);
        updateProjectList();
        selectProject(newProject.id);
        addLog('success', `项目 ${name} 已成功添加并准备部署`);
        
        // 关闭快速添加模态框
        const modal = document.querySelector('.modal-overlay:not(.hidden)');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

function useAnalysisResult() {
    const analysis = {
        name: elements.projectNameInput.value,
        port: elements.projectPortInput.value
    };
    
    showModal('使用分析结果', `
        <div class="use-analysis">
            <p>将使用以下配置:</p>
            <ul>
                <li><strong>项目名称:</strong> ${analysis.name}</li>
                <li><strong>端口:</strong> ${analysis.port}</li>
                <li><strong>类型:</strong> Node.js</li>
            </ul>
            <button class="btn btn-success btn-block" onclick="startDeployment()">
                <i class="fas fa-rocket"></i> 开始部署
            </button>
        </div>
    `);
}

function startDeployment() {
    oneClickDeploy();
}

function fixDiagnosisIssues() {
    showLoading('正在修复诊断出的问题...');
    
    setTimeout(() => {
        addLog('success', '所有问题已修复完成');
        hideLoading();
        closeModal();
    }, 2000);
}

function startStepByStep() {
    closeModal();
    oneClickDeploy(); // 简化处理，实际应该是分步流程
}

function updateProjectFromWebSocket(projectData) {
    // 根据WebSocket消息更新项目状态
    const project = projects.find(p => p.id === projectData.id);
    if (project) {
        Object.assign(project, projectData);
        updateProjectList();
        
        if (currentProject && currentProject.id === project.id) {
            updateProjectCard(project);
            updateButtonStates(project.status);
        }
    }
}

function updateSystemStatusFromWebSocket(statusData) {
    // 更新系统状态显示
    if (statusData.cpu !== undefined) {
        elements.cpuUsage.textContent = `${statusData.cpu}%`;
    }
    if (statusData.memory !== undefined) {
        elements.memoryUsage.textContent = `${statusData.memory}%`;
    }
    if (statusData.disk !== undefined) {
        elements.diskUsage.textContent = `${statusData.disk}%`;
    }
}

// 添加额外的CSS样式
const extraStyles = document.createElement('style');
extraStyles.textContent = `
    .global-loader {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loader-content {
        background: white;
        padding: 30px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .loader-spinner {
        font-size: 40px;
        color: var(--primary-color);
        margin-bottom: 16px;
    }
    
    .loader-message {
        font-size: 16px;
        font-weight: 500;
        color: #333;
    }
    
    .global-error {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
    }
    
    .error-content {
        background: var(--danger-color);
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .error-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
    }
    
    .project-item {
        background: var(--light-color);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .project-item:hover {
        background: #e9ecef;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px var(--shadow-color);
    }
    
    .project-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .project-item-header h4 {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
    }
    
    .project-status-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .status-running {
        background: rgba(40, 167, 69, 0.1);
        color: var(--success-color);
        border: 1px solid rgba(40, 167, 69, 0.3);
    }
    
    .status-stopped {
        background: rgba(220, 53, 69, 0.1);
        color: var(--danger-color);
        border: 1px solid rgba(220, 53, 69, 0.3);
    }
    
    .project-item-info {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--secondary-color);
        margin-bottom: 8px;
    }
    
    .project-item-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }
    
    .project-item-actions .btn-sm {
        padding: 4px 8px;
        font-size: 12px;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

document.head.appendChild(extraStyles);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 导出部分函数到全局作用域
window.handleProjectAction = handleProjectAction;
window.selectProject = selectProject;
window.startDeployment = startDeployment;
window.fixDiagnosisIssues = fixDiagnosisIssues;
window.startStepByStep = startStepByStep;
window.useAnalysisResult = useAnalysisResult;
window.analyzeQuickRepo = analyzeQuickRepo;
window.confirmQuickAdd = confirmQuickAdd;
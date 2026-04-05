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

// 国际化工具函数
const i18nUtils = {
    // 格式化项目数量显示
    formatProjectCount: function(count) {
        if (typeof window.I18n !== 'undefined') {
            return `${count} ${window.I18n.t('project.list')}`;
        }
        return `${count} 个项目`;
    },
    
    // 获取状态文本
    getStatusText: function(status) {
        if (typeof window.I18n !== 'undefined') {
            const statusMap = {
                'running': window.I18n.t('status.running'),
                'stopped': window.I18n.t('status.stopped'),
                'starting': window.I18n.t('status.starting'),
                'stopping': window.I18n.t('status.stopping'),
                'restarting': window.I18n.t('status.restarting'),
                'error': window.I18n.t('status.error'),
                'healthy': window.I18n.t('status.healthy'),
                'warning': window.I18n.t('status.warning'),
                'critical': window.I18n.t('status.critical'),
                'offline': window.I18n.t('status.offline'),
                'online': window.I18n.t('status.online'),
                'paused': window.I18n.t('status.paused'),
                'resuming': window.I18n.t('status.resuming')
            };
            return statusMap[status] || window.I18n.t('status.unknown');
        }
        
        // 回退到原始中文文本
        const statusMap = {
            'running': '运行中',
            'stopped': '已停止',
            'starting': '启动中',
            'stopping': '停止中',
            'restarting': '重启中',
            'error': '错误',
            'healthy': '健康',
            'warning': '警告',
            'critical': '严重',
            'offline': '离线',
            'online': '在线',
            'paused': '已暂停',
            'resuming': '恢复中'
        };
        return statusMap[status] || '未知状态';
    },
    
    // 显示国际化通知
    showNotification: function(messageKey, type = 'info', params = {}) {
        const message = window.I18n ? window.I18n.t(messageKey, params) : messageKey;
        const typeMap = {
            'success': 'success',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        
        this.showToast(message, typeMap[type] || 'info');
    },
    
    // 显示Toast通知
    showToast: function(message, type = 'info') {
        // 创建Toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 添加关闭事件
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 300);
        });
        
        // 自动消失
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
        
        // 显示动画
        setTimeout(() => toast.classList.add('toast-show'), 10);
    },
    
    // 获取Toast图标
    getToastIcon: function(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    // 显示确认对话框（国际化）
    showConfirm: function(messageKey, titleKey = 'app.confirm', params = {}) {
        return new Promise((resolve) => {
            const message = window.I18n ? window.I18n.t(messageKey, params) : messageKey;
            const title = window.I18n ? window.I18n.t(titleKey) : '确认';
            
            if (confirm(`${title}\n\n${message}`)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    },
    
    // 更新项目计数显示
    updateProjectCountDisplay: function(count) {
        if (elements.projectCount) {
            elements.projectCount.textContent = this.formatProjectCount(count);
        }
    },
    
    // 更新系统状态显示
    updateSystemStatusDisplay: function(status) {
        if (elements.systemStatus) {
            elements.systemStatus.textContent = this.getStatusText(status);
        }
    }
};

// 初始化函数
function init() {
    console.log('GitHub Deploy Assistant UI 初始化...');
    
    // 等待i18n初始化完成
    if (typeof window.I18n === 'undefined') {
        console.warn('I18n not loaded, waiting...');
        setTimeout(init, 100);
        return;
    }
    
    console.log(`当前语言: ${window.I18n.getCurrentLanguage()}`);
    
    // 绑定事件监听器
    bindEvents();
    
    // 加载初始数据
    loadInitialData();
    
    // 连接WebSocket
    connectWebSocket();
    
    // 监听语言变化
    document.addEventListener('languageChanged', handleLanguageChange);
}

// 处理语言变化
function handleLanguageChange(event) {
    console.log(`语言已更改为: ${event.detail.language}`);
    
    // 重新加载项目数据
    if (projects.length > 0) {
        updateProjectList();
    }
    
    // 更新项目计数显示
    i18nUtils.updateProjectCountDisplay(projects.length);
    
    // 更新系统状态显示
    if (currentProject) {
        updateProjectStatusDisplay(currentProject.status);
    }
    
    // 显示语言切换成功通知
    i18nUtils.showNotification('success.saved', 'success', { 
        language: window.I18n.getLanguageName(event.detail.language) 
    });
}

// 绑定事件
function bindEvents() {
    // 刷新按钮
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', () => {
            loadInitialData();
            i18nUtils.showNotification('app.refresh', 'info');
        });
    }
    
    // 设置按钮
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            showSettingsModal();
        });
    }
    
    // 添加项目按钮
    if (elements.addProjectBtn) {
        elements.addProjectBtn.addEventListener('click', () => {
            showAddProjectModal();
        });
    }
    
    // 快速添加按钮
    if (elements.quickAddBtn) {
        elements.quickAddBtn.addEventListener('click', () => {
            showQuickAddModal();
        });
    }
    
    // 核心操作按钮
    if (elements.startBtn) {
        elements.startBtn.addEventListener('click', () => {
            if (currentProject) {
                handleProjectAction(currentProject.id, 'start');
            }
        });
    }
    
    if (elements.stopBtn) {
        elements.stopBtn.addEventListener('click', () => {
            if (currentProject) {
                i18nUtils.showConfirm('confirm.stop', 'app.confirm').then((confirmed) => {
                    if (confirmed && currentProject) {
                        handleProjectAction(currentProject.id, 'stop');
                    }
                });
            }
        });
    }
    
    if (elements.restartBtn) {
        elements.restartBtn.addEventListener('click', () => {
            if (currentProject) {
                i18nUtils.showConfirm('confirm.restart', 'app.confirm').then((confirmed) => {
                    if (confirmed && currentProject) {
                        handleProjectAction(currentProject.id, 'restart');
                    }
                });
            }
        });
    }
    
    if (elements.logsBtn) {
        elements.logsBtn.addEventListener('click', () => {
            if (currentProject) {
                showProjectLogs(currentProject.id);
            }
        });
    }
    
    // 配置管理按钮
    if (elements.editPortBtn) {
        elements.editPortBtn.addEventListener('click', () => {
            if (currentProject) {
                showEditPortModal(currentProject);
            }
        });
    }
    
    if (elements.editEnvBtn) {
        elements.editEnvBtn.addEventListener('click', () => {
            if (currentProject) {
                showEditEnvModal(currentProject);
            }
        });
    }
    
    if (elements.updateDepsBtn) {
        elements.updateDepsBtn.addEventListener('click', () => {
            if (currentProject) {
                i18nUtils.showConfirm('确认要更新依赖吗？').then((confirmed) => {
                    if (confirmed && currentProject) {
                        handleProjectAction(currentProject.id, 'update-deps');
                    }
                });
            }
        });
    }
    
    if (elements.rebuildBtn) {
        elements.rebuildBtn.addEventListener('click', () => {
            if (currentProject) {
                i18nUtils.showConfirm('确认要重新构建吗？').then((confirmed) => {
                    if (confirmed && currentProject) {
                        handleProjectAction(currentProject.id, 'rebuild');
                    }
                });
            }
        });
    }
    
    if (elements.backupBtn) {
        elements.backupBtn.addEventListener('click', () => {
            if (currentProject) {
                handleProjectAction(currentProject.id, 'backup');
            }
        });
    }
    
    // 删除按钮
    if (elements.deleteBtn) {
        elements.deleteBtn.addEventListener('click', () => {
            if (currentProject) {
                i18nUtils.showConfirm('confirm.delete', 'app.confirm').then((confirmed) => {
                    if (confirmed && currentProject) {
                        handleProjectAction(currentProject.id, 'delete');
                    }
                });
            }
        });
    }
    
    // 监控按钮
    const monitorBtn = document.getElementById('monitor-btn');
    if (monitorBtn) {
        monitorBtn.addEventListener('click', () => {
            showMonitoringDashboard();
        });
    }
    
    // 模板市场入口
    const marketEntry = document.getElementById('market-entry');
    if (marketEntry) {
        marketEntry.addEventListener('click', () => {
            showTemplateMarket();
        });
    }
    
    // 主添加按钮
    const mainAddBtn = document.getElementById('main-add-btn');
    if (mainAddBtn) {
        mainAddBtn.addEventListener('click', () => {
            showAddProjectModal();
        });
    }
}

// 加载初始数据
async function loadInitialData() {
    try {
        // 显示加载状态
        i18nUtils.showNotification('app.loading', 'info');
        
        // 加载项目列表
        const response = await fetch('/api/projects');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        projects = await response.json();
        
        // 更新项目列表
        updateProjectList();
        
        // 更新项目计数
        i18nUtils.updateProjectCountDisplay(projects.length);
        
        // 加载系统状态
        await loadSystemStatus();
        
        // 隐藏加载状态
        console.log('初始数据加载完成');
        
    } catch (error) {
        console.error('加载数据失败:', error);
        i18nUtils.showNotification('error.network', 'error');
    }
}

// 更新项目列表
function updateProjectList() {
    const projectList = document.getElementById('project-list-container');
    if (!projectList) return;
    
    // 清空现有列表
    projectList.innerHTML = '';
    
    if (projects.length === 0) {
        // 显示空状态
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <p data-i18n="project.no_projects">暂无项目</p>
            <button class="btn btn-outline btn-sm" id="quick-add-btn-2">
                <i class="fas fa-plus-circle"></i> <span data-i18n="project.quick_add">快速添加</span>
            </button>
        `;
        projectList.appendChild(emptyState);
        
        // 绑定快速添加按钮事件
        const quickAddBtn2 = document.getElementById('quick-add-btn-2');
        if (quickAddBtn2) {
            quickAddBtn2.addEventListener('click', () => {
                showQuickAddModal();
            });
        }
        
        // 隐藏主面板的项目卡片
        if (elements.projectCard) {
            elements.projectCard.style.display = 'none';
        }
        
        // 显示空的主状态
        const emptyMainState = document.getElementById('empty-main-state');
        if (emptyMainState) {
            emptyMainState.style.display = 'block';
        }
        
        return;
    }
    
    // 隐藏空的主状态
    const emptyMainState = document.getElementById('empty-main-state');
    if (emptyMainState) {
        emptyMainState.style.display = 'none';
    }
    
    // 创建项目列表
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.dataset.projectId = project.id;
        
        const statusClass = getStatusClass(project.status);
        const statusText = i18nUtils.getStatusText(project.status);
        
        projectItem.innerHTML = `
            <div class="project-item-header">
                <div class="project-icon">
                    <i class="fas fa-${getProjectIcon(project.type)}"></i>
                </div>
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-type">${project.type}</div>
                </div>
                <div class="project-status ${statusClass}">
                    <span class="status-dot"></span>
                    <span class="status-text">${statusText}</span>
                </div>
            </div>
            <div class="project-item-meta">
                <span><i class="fas fa-plug"></i> ${project.port || 'N/A'}</span>
                <span><i class="fas fa-folder"></i> ${project.path ? project.path.substring(0, 20) + '...' : 'N/A'}</span>
            </div>
        `;
        
        // 添加点击事件
        projectItem.addEventListener('click', () => {
            selectProject(project.id);
        });
        
        projectList.appendChild(projectItem);
    });
    
    // 如果没有选中的项目，选择第一个
    if (!currentProject && projects.length > 0) {
        selectProject(projects[0].id);
    }
}

// 选择项目
function selectProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    currentProject = project;
    
    // 移除所有项目的选中状态
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加当前项目的选中状态
    const selectedItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // 更新项目卡片
    updateProjectCard(project);
    
    // 显示项目卡片
    if (elements.projectCard) {
        elements.projectCard.style.display = 'block';
    }
    
    // 更新标题
    if (elements.selectedProjectTitle) {
        elements.selectedProjectTitle.textContent = window.I18n ? 
            window.I18n.t('project.details') : '项目详情';
    }
}

// 更新项目卡片
function updateProjectCard(project) {
    if (!project) return;
    
    // 更新基本信息
    if (elements.projectName) elements.projectName.textContent = project.name;
    if (elements.projectType) elements.projectType.textContent = project.type || '-';
    if (elements.projectPort) elements.projectPort.textContent = project.port || '-';
    if (elements.projectPath) elements.projectPath.textContent = project.path || '-';
    
    // 更新状态显示
    updateProjectStatusDisplay(project.status);
    
    // 更新按钮状态
    updateButtonStates(project.status);
}

// 更新项目状态显示
function updateProjectStatusDisplay(status) {
    if (!elements.projectStatusDisplay) return;
    
    const statusClass = getStatusClass(status);
    const statusText = i18nUtils.getStatusText(status);
    
    // 清除所有状态类
    elements.projectStatusDisplay.className = 'status-badge';
    
    // 添加当前状态类
    elements.projectStatusDisplay.classList.add(statusClass);
    
    // 更新状态文本
    const statusSpan = elements.projectStatusDisplay.querySelector('.status-text') || 
                      elements.projectStatusDisplay.querySelector('span:last-child');
    if (statusSpan) {
        statusSpan.textContent = statusText;
    } else {
        elements.projectStatusDisplay.innerHTML = `
            <span class="status-dot"></span>
            <span class="status-text">${statusText}</span>
        `;
    }
}

// 更新按钮状态
function updateButtonStates(status) {
    const buttons = [
        { element: elements.startBtn, enabled: ['stopped', 'error'].includes(status) },
        { element: elements.stopBtn, enabled: ['running', 'starting'].includes(status) },
        { element: elements.restartBtn, enabled: ['running', 'starting', 'stopped'].includes(status) },
        { element: elements.logsBtn, enabled: true },
        { element: elements.editPortBtn, enabled: true },
        { element: elements.editEnvBtn, enabled: true },
        { element: elements.updateDepsBtn, enabled: true },
        { element: elements.rebuildBtn, enabled: true },
        { element: elements.backupBtn, enabled: true },
        { element: elements.deleteBtn, enabled: true }
    ];
    
    buttons.forEach(button => {
        if (button.element) {
            if (button.enabled) {
                button.element.disabled = false;
                button.element.classList.remove('disabled');
            } else {
                button.element.disabled = true;
                button.element.classList.add('disabled');
            }
        }
    });
}

// 获取状态类
function getStatusClass(status) {
    const statusMap = {
        'running': 'status-running',
        'stopped': 'status-stopped',
        'starting': 'status-starting',
        'stopping': 'status-stopping',
        'restarting': 'status-restarting',
        'error': 'status-error',
        'healthy': 'status-healthy',
        'warning': 'status-warning',
        'critical': 'status-critical',
        'offline': 'status-offline',
        'online': 'status-online'
    };
    return statusMap[status] || 'status-unknown';
}

// 获取项目图标
function getProjectIcon(projectType) {
    const iconMap = {
        'node': 'node-js',
        'python': 'python',
        'java': 'java',
        'php': 'php',
        'ruby': 'gem',
        'go': 'golang',
        'rust': 'rust',
        'docker': 'docker',
        'kubernetes': 'kubernetes',
        'static': 'file-code',
        'react': 'react',
        'vue': 'vuejs',
        'angular': 'angular',
        'nextjs': 'nextjs',
        'nuxtjs': 'nuxtjs',
        'laravel': 'laravel',
        'django': 'django',
        'flask': 'flask',
        'express': 'express',
        'spring': 'spring',
        'wordpress': 'wordpress'
    };
    return iconMap[projectType?.toLowerCase()] || 'cube';
}

// 处理项目操作
async function handleProjectAction(projectId, action) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    try {
        // 显示操作开始通知
        const actionText = window.I18n ? window.I18n.t(`action.${action}`) : action;
        i18nUtils.showNotification(`正在${actionText}项目...`, 'info');
        
        const response = await fetch(`/api/projects/${projectId}/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`操作失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 显示成功通知
        const successKey = `success.${action === 'update-deps' ? 'updated' : 
                           action === 'rebuild' ? 'updated' : action}`;
        i18nUtils.showNotification(successKey, 'success');
        
        // 重新加载项目数据
        await loadInitialData();
        
        // 如果当前项目是操作的项目，更新显示
        if (currentProject && currentProject.id === projectId) {
            selectProject(projectId);
        }
        
    } catch (error) {
        console.error(`${action} 操作失败:`, error);
        i18nUtils.showNotification('error.unknown', 'error');
    }
}

// 加载系统状态
async function loadSystemStatus() {
    try {
        const response = await fetch('/api/system/status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const status = await response.json();
        
        // 更新系统状态显示
        i18nUtils.updateSystemStatusDisplay(status.system);
        
        // 更新资源使用情况
        if (elements.cpuUsage) elements.cpuUsage.textContent = `${status.cpu || 0}%`;
        if (elements.memoryUsage) elements.memoryUsage.textContent = `${status.memory || 0}%`;
        if (elements.diskUsage) elements.diskUsage.textContent = `${status.disk || 0}%`;
        
    } catch (error) {
        console.error('加载系统状态失败:', error);
        i18nUtils.updateSystemStatusDisplay('error');
    }
}

// 连接WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        console.log('WebSocket连接已建立');
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket消息解析失败:', error);
        }
    };
    
    websocket.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
    
    websocket.onclose = () => {
        console.log('WebSocket连接已关闭，5秒后重连...');
        setTimeout(connectWebSocket, 5000);
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'project_update':
            // 更新项目状态
            const projectIndex = projects.findIndex(p => p.id === data.project.id);
            if (projectIndex !== -1) {
                projects[projectIndex] = { ...projects[projectIndex], ...data.project };
                
                // 更新项目列表
                updateProjectList();
                
                // 如果当前项目被更新，更新项目卡片
                if (currentProject && currentProject.id === data.project.id) {
                    updateProjectCard(projects[projectIndex]);
                }
            }
            break;
            
        case 'system_update':
            // 更新系统状态
            if (elements.cpuUsage) elements.cpuUsage.textContent = `${data.cpu || 0}%`;
            if (elements.memoryUsage) elements.memoryUsage.textContent = `${data.memory || 0}%`;
            if (elements.diskUsage) elements.diskUsage.textContent = `${data.disk || 0}%`;
            break;
            
        case 'log_message':
            // 处理日志消息
            if (currentProject && data.projectId === currentProject.id) {
                addLogMessage(data.message, data.level);
            }
            break;
            
        case 'notification':
            // 显示通知
            i18nUtils.showNotification(data.message, data.level);
            break;
    }
}

// 添加日志消息
function addLogMessage(message, level = 'info') {
    if (!elements.logContainer) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-level">${level.toUpperCase()}</span>
        <span class="log-message">${message}</span>
    `;
    
    elements.logContainer.appendChild(logEntry);
    
    // 自动滚动到底部
    if (!isLogsPaused) {
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }
}

// 模态框相关函数（简化版）
function showSettingsModal() {
    // 实现设置模态框
    console.log('显示设置模态框');
}

function showAddProjectModal() {
    // 实现添加项目模态框
    console.log('显示添加项目模态框');
}

function showQuickAddModal() {
    // 实现快速添加模态框
    console.log('显示快速添加模态框');
}

function showEditPortModal(project) {
    // 实现编辑端口模态框
    console.log('显示编辑端口模态框', project);
}

function showEditEnvModal(project) {
    // 实现编辑环境变量模态框
    console.log('显示编辑环境变量模态框', project);
}

function showProjectLogs(projectId) {
    // 实现显示项目日志
    console.log('显示项目日志', projectId);
}

function showMonitoringDashboard() {
    // 实现显示监控仪表盘
    console.log('显示监控仪表盘');
}

function showTemplateMarket() {
    // 实现显示模板市场
    console.log('显示模板市场');
}

// 导出初始化函数
window.initApp = init;
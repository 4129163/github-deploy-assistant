// GitHub Deploy Assistant - API通信模块

// API配置
const APIConfig = {
    baseURL: 'http://localhost:3000/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// API状态
const APIState = {
    connected: false,
    lastError: null,
    retryCount: 0,
    maxRetries: 3
};

// 初始化API模块
function initAPI() {
    console.log('初始化API模块...');
    
    // 测试API连接
    testAPIConnection();
    
    // 启动心跳检查
    startHeartbeat();
    
    console.log('API模块初始化完成');
}

// 测试API连接
async function testAPIConnection() {
    try {
        const response = await fetch(`${APIConfig.baseURL}/health`);
        
        if (response.ok) {
            APIState.connected = true;
            APIState.retryCount = 0;
            
            addLog('success', 'API服务器连接正常');
            showNotification('success', 'API服务器连接正常', 3000);
            
            // 连接成功后加载数据
            loadAllData();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        APIState.connected = false;
        APIState.lastError = error;
        
        addLog('error', `API服务器连接失败: ${error.message}`);
        showNotification('error', '无法连接到API服务器', 5000);
        
        // 尝试重连
        if (APIState.retryCount < APIState.maxRetries) {
            APIState.retryCount++;
            setTimeout(testAPIConnection, 5000);
        }
    }
}

// 启动心跳检查
function startHeartbeat() {
    setInterval(async () => {
        if (APIState.connected) {
            try {
                const response = await fetch(`${APIConfig.baseURL}/health`, {
                    method: 'HEAD',
                    timeout: 5000
                });
                
                if (!response.ok) {
                    APIState.connected = false;
                    addLog('warning', 'API服务器心跳检测失败');
                }
            } catch (error) {
                APIState.connected = false;
                console.warn('心跳检查失败:', error);
            }
        } else {
            // 尝试重连
            testAPIConnection();
        }
    }, 30000); // 每30秒检查一次
}

// API请求封装
async function apiRequest(endpoint, options = {}) {
    const url = `${APIConfig.baseURL}${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: APIConfig.headers,
        timeout: APIConfig.timeout,
        ...options
    };
    
    // 如果有body，转换为JSON
    if (defaultOptions.body && typeof defaultOptions.body === 'object') {
        defaultOptions.body = JSON.stringify(defaultOptions.body);
    }
    
    try {
        showLoading(`请求中: ${endpoint}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), APIConfig.timeout);
        
        const response = await fetch(url, {
            ...defaultOptions,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
        
    } catch (error) {
        handleAPIError(error, endpoint);
        throw error;
    } finally {
        hideLoading();
    }
}

// API错误处理
function handleAPIError(error, endpoint) {
    console.error(`API请求失败 [${endpoint}]:`, error);
    
    let errorMessage = 'API请求失败';
    
    if (error.name === 'AbortError') {
        errorMessage = `请求超时 (${APIConfig.timeout / 1000}秒)`;
    } else if (error.message.includes('Failed to fetch')) {
        errorMessage = '无法连接到服务器';
    } else {
        errorMessage = error.message;
    }
    
    APIState.connected = false;
    APIState.lastError = error;
    
    addLog('error', `API错误 [${endpoint}]: ${errorMessage}`);
    showNotification('error', errorMessage, 5000);
}

// 加载所有数据
async function loadAllData() {
    try {
        showLoading('正在加载数据...');
        
        // 并行加载不同类型的数据
        const [projectsData, systemStatus, recentActivities] = await Promise.all([
            fetchProjects(),
            fetchSystemStatus(),
            fetchRecentActivities()
        ]);
        
        // 更新应用状态
        updateProjects(projectsData);
        updateSystemStatusDisplay(systemStatus);
        updateRecentActivities(recentActivities);
        
        addLog('info', '数据加载完成');
        
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败');
    } finally {
        hideLoading();
    }
}

// 项目相关API
async function fetchProjects() {
    try {
        const data = await apiRequest('/projects');
        
        // 模拟数据转换
        return data.projects || [
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
            }
        ];
        
    } catch (error) {
        console.warn('获取项目列表失败，使用模拟数据');
        return []; // 返回空数组避免UI错误
    }
}

async function createProject(projectData) {
    try {
        const response = await apiRequest('/projects', {
            method: 'POST',
            body: projectData
        });
        
        addLog('success', `项目 ${projectData.name} 创建成功`);
        showNotification('success', '项目创建成功', 3000);
        
        return response;
        
    } catch (error) {
        console.error('创建项目失败:', error);
        throw error;
    }
}

async function updateProject(projectId, updateData) {
    try {
        const response = await apiRequest(`/projects/${projectId}`, {
            method: 'PUT',
            body: updateData
        });
        
        addLog('info', `项目 ${projectId} 更新成功`);
        
        return response;
        
    } catch (error) {
        console.error('更新项目失败:', error);
        throw error;
    }
}

async function deleteProject(projectId) {
    try {
        const response = await apiRequest(`/projects/${projectId}`, {
            method: 'DELETE'
        });
        
        addLog('warning', `项目 ${projectId} 已删除`);
        showNotification('warning', '项目已删除', 3000);
        
        return response;
        
    } catch (error) {
        console.error('删除项目失败:', error);
        throw error;
    }
}

async function startProjectAPI(projectId) {
    try {
        const response = await apiRequest(`/projects/${projectId}/start`, {
            method: 'POST'
        });
        
        addLog('success', `项目 ${projectId} 启动命令已发送`);
        
        return response;
        
    } catch (error) {
        console.error('启动项目失败:', error);
        throw error;
    }
}

async function stopProjectAPI(projectId) {
    try {
        const response = await apiRequest(`/projects/${projectId}/stop`, {
            method: 'POST'
        });
        
        addLog('warning', `项目 ${projectId} 停止命令已发送`);
        
        return response;
        
    } catch (error) {
        console.error('停止项目失败:', error);
        throw error;
    }
}

async function restartProjectAPI(projectId) {
    try {
        const response = await apiRequest(`/projects/${projectId}/restart`, {
            method: 'POST'
        });
        
        addLog('info', `项目 ${projectId} 重启命令已发送`);
        
        return response;
        
    } catch (error) {
        console.error('重启项目失败:', error);
        throw error;
    }
}

// 部署相关API
async function analyzeRepositoryAPI(repoUrl) {
    try {
        const response = await apiRequest('/repo/analyze', {
            method: 'POST',
            body: { url: repoUrl }
        });
        
        addLog('info', `仓库分析完成: ${repoUrl}`);
        
        return response;
        
    } catch (error) {
        console.error('分析仓库失败:', error);
        throw error;
    }
}

async function deployProjectAPI(deployData) {
    try {
        showLoading('正在部署项目...');
        
        const response = await apiRequest('/deploy', {
            method: 'POST',
            body: deployData
        });
        
        addLog('success', '项目部署任务已启动');
        showNotification('success', '部署任务已启动', 3000);
        
        return response;
        
    } catch (error) {
        console.error('部署项目失败:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

// 系统状态API
async function fetchSystemStatus() {
    try {
        const data = await apiRequest('/system/status');
        
        // 模拟数据
        return data || {
            cpu: 24,
            memory: 65,
            disk: 85,
            network: true,
            database: true,
            uptime: 3600
        };
        
    } catch (error) {
        console.warn('获取系统状态失败');
        return {
            cpu: 0,
            memory: 0,
            disk: 0,
            network: false,
            database: false,
            uptime: 0
        };
    }
}

// 活动记录API
async function fetchRecentActivities() {
    try {
        const data = await apiRequest('/activities/recent');
        
        // 模拟数据
        return data || [
            {
                id: 1,
                type: 'start',
                project: 'my-react-app',
                message: '项目已启动',
                timestamp: '2026-04-04T12:30:15Z',
                success: true
            },
            {
                id: 2,
                type: 'deploy',
                project: 'api-service',
                message: '部署完成',
                timestamp: '2026-04-04T11:45:30Z',
                success: true
            },
            {
                id: 3,
                type: 'error',
                project: 'data-processor',
                message: '端口占用错误',
                timestamp: '2026-04-04T10:15:45Z',
                success: false
            }
        ];
        
    } catch (error) {
        console.warn('获取活动记录失败');
        return [];
    }
}

// 诊断相关API
async function runDiagnosticsAPI(projectId) {
    try {
        showLoading('正在运行诊断...');
        
        const response = await apiRequest(`/projects/${projectId}/diagnose`, {
            method: 'POST'
        });
        
        return response;
        
    } catch (error) {
        console.error('运行诊断失败:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

async function fixIssuesAPI(projectId, issues) {
    try {
        showLoading('正在修复问题...');
        
        const response = await apiRequest(`/projects/${projectId}/fix`, {
            method: 'POST',
            body: { issues }
        });
        
        addLog('success', '问题修复完成');
        showNotification('success', '问题已修复', 3000);
        
        return response;
        
    } catch (error) {
        console.error('修复问题失败:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

// 监控相关API
async function fetchProjectMetrics(projectId, timeRange = '24h') {
    try {
        const response = await apiRequest(`/projects/${projectId}/metrics?range=${timeRange}`);
        
        return response;
        
    } catch (error) {
        console.warn('获取项目指标失败');
        return {
            cpu: [],
            memory: [],
            requests: [],
            errors: []
        };
    }
}

async function fetchSystemMetrics(timeRange = '24h') {
    try {
        const response = await apiRequest(`/system/metrics?range=${timeRange}`);
        
        return response;
        
    } catch (error) {
        console.warn('获取系统指标失败');
        return {
            cpu: [],
            memory: [],
            disk: [],
            network: []
        };
    }
}

// 配置相关API
async function fetchConfiguration() {
    try {
        const response = await apiRequest('/config');
        
        return response;
        
    } catch (error) {
        console.warn('获取配置失败');
        return {};
    }
}

async function updateConfiguration(configData) {
    try {
        const response = await apiRequest('/config', {
            method: 'PUT',
            body: configData
        });
        
        addLog('info', '系统配置已更新');
        
        return response;
        
    } catch (error) {
        console.error('更新配置失败:', error);
        throw error;
    }
}

// 日志相关API
async function fetchProjectLogs(projectId, limit = 100) {
    try {
        const response = await apiRequest(`/projects/${projectId}/logs?limit=${limit}`);
        
        return response;
        
    } catch (error) {
        console.warn('获取项目日志失败');
        return [];
    }
}

async function clearProjectLogs(projectId) {
    try {
        const response = await apiRequest(`/projects/${projectId}/logs`, {
            method: 'DELETE'
        });
        
        addLog('info', '项目日志已清空');
        
        return response;
        
    } catch (error) {
        console.error('清空日志失败:', error);
        throw error;
    }
}

// WebSocket集成
function setupWebSocket() {
    const wsUrl = APIConfig.baseURL.replace('http', 'ws') + '/ws';
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
        addLog('success', '实时连接已建立');
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket消息解析失败:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        addLog('error', '实时连接错误');
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        addLog('warning', '实时连接已断开，尝试重连...');
        
        // 5秒后重连
        setTimeout(setupWebSocket, 5000);
    };
    
    return ws;
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'project_update':
            updateProjectFromSocket(data.project);
            break;
            
        case 'log':
            if (!isLogsPaused) {
                addLog(data.level, data.message);
            }
            break;
            
        case 'system_status':
            updateSystemStatusFromSocket(data.status);
            break;
            
        case 'deployment_progress':
            updateDeploymentProgress(data.progress);
            break;
    }
}

// 数据更新函数
function updateProjects(projectsData) {
    projects = projectsData;
    updateProjectList();
    updateProjectCount();
}

function updateProjectFromSocket(projectData) {
    const index = projects.findIndex(p => p.id === projectData.id);
    
    if (index !== -1) {
        projects[index] = { ...projects[index], ...projectData };
        
        if (currentProject && currentProject.id === projectData.id) {
            currentProject = projects[index];
            updateProjectCard(currentProject);
            updateButtonStates(currentProject.status);
        }
        
        updateProjectList();
    }
}

function updateSystemStatusDisplay(statusData) {
    // 更新CPU使用率
    if (elements.cpuUsage) {
        elements.cpuUsage.textContent = `${statusData.cpu || 0}%`;
    }
    
    // 更新内存使用率
    if (elements.memoryUsage) {
        elements.memoryUsage.textContent = `${statusData.memory || 0}%`;
    }
    
    // 更新磁盘使用率
    if (elements.diskUsage) {
        elements.diskUsage.textContent = `${statusData.disk || 0}%`;
    }
}

function updateSystemStatusFromSocket(statusData) {
    updateSystemStatusDisplay(statusData);
}

function updateProjectCount() {
    if (elements.projectCount) {
        elements.projectCount.textContent = `${projects.length} 个项目`;
    }
}

function updateRecentActivities(activities) {
    // 更新最近活动显示
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    activities.slice(0, 5).forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const iconMap = {
            'start': { icon: 'play', class: 'activity-success' },
            'stop': { icon: 'stop', class: 'activity-warning' },
            'deploy': { icon: 'code-branch', class: 'activity-primary' },
            'error': { icon: 'exclamation-circle', class: 'activity-danger' }
        };
        
        const config = iconMap[activity.type] || { icon: 'info-circle', class: 'activity-info' };
        
        const timestamp = new Date(activity.timestamp);
        const timeText = formatTime(timestamp);
        
        activityItem.innerHTML = `
            <i class="fas fa-${config.icon} ${config.class}"></i>
            <div class="activity-content">
                <p><strong>${activity.project}</strong> ${activity.message}</p>
                <span class="activity-time">${timeText}</span>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

function updateDeploymentProgress(progress) {
    // 更新部署进度显示
    const progressElement = document.getElementById('deployment-progress');
    if (!progressElement) return;
    
    progressElement.style.width = `${progress.percentage}%`;
    progressElement.textContent = `${progress.percentage}%`;
    
    if (progress.message) {
        const messageElement = document.getElementById('deployment-message');
        if (messageElement) {
            messageElement.textContent = progress.message;
        }
    }
    
    if (progress.status === 'completed') {
        showNotification('success', '部署完成！', 5000);
    } else if (progress.status === 'failed') {
        showNotification('error', '部署失败！', 5000);
    }
}

// 导出函数
window.initAPI = initAPI;
window.apiRequest = apiRequest;
window.fetchProjects = fetchProjects;
window.createProject = createProject;
window.updateProject = updateProject;
window.deleteProject = deleteProject;
window.startProjectAPI = startProjectAPI;
window.stopProjectAPI = stopProjectAPI;
window.restartProjectAPI = restartProjectAPI;
window.analyzeRepositoryAPI = analyzeRepositoryAPI;
window.deployProjectAPI = deployProjectAPI;
window.fetchSystemStatus = fetchSystemStatus;
window.fetchProjectMetrics = fetchProjectMetrics;
window.fetchConfiguration = fetchConfiguration;
window.updateConfiguration = updateConfiguration;
window.fetchProjectLogs = fetchProjectLogs;
window.clearProjectLogs = clearProjectLogs;
window.runDiagnosticsAPI = runDiagnosticsAPI;
window.fixIssuesAPI = fixIssuesAPI;

// 在初始化完成后调用
setTimeout(initAPI, 500);
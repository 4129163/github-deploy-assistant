/**
 * 部署恢复功能前端模块
 * 处理断点续传相关的前端逻辑
 */

class DeployResumeManager {
    constructor() {
        this.resumableDeployments = [];
        this.resumeCheckInterval = null;
        this.websocket = null;
    }

    /**
     * 初始化部署恢复功能
     */
    init() {
        this.loadResumableDeployments();
        this.setupEventListeners();
        this.startAutoCheck();
        
        console.log('部署恢复功能已初始化');
    }

    /**
     * 加载可恢复的部署
     */
    async loadResumableDeployments() {
        try {
            const response = await fetch('/api/deploy/resume-points');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                this.resumableDeployments = data.data || [];
                this.updateUI();
                return this.resumableDeployments;
            } else {
                throw new Error(data.error || '加载失败');
            }
        } catch (error) {
            console.error('加载可恢复部署失败:', error);
            this.resumableDeployments = [];
            this.showError('加载可恢复部署失败: ' + error.message);
            return [];
        }
    }

    /**
     * 更新UI显示
     */
    updateUI() {
        this.updateProjectList();
        this.updateResumePanel();
        this.updateBadges();
    }

    /**
     * 更新项目列表
     */
    updateProjectList() {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        // 获取所有项目卡片
        const projectCards = projectList.querySelectorAll('.project-card');
        
        projectCards.forEach(card => {
            const projectId = card.dataset.projectId;
            if (!projectId) return;
            
            // 检查是否有可恢复的部署
            const resumable = this.resumableDeployments.find(d => d.projectId === projectId);
            
            // 移除现有的恢复按钮
            const existingBtn = card.querySelector('.resume-deploy-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
            
            // 添加恢复按钮（如果可恢复）
            if (resumable) {
                const resumeBtn = this.createResumeButton(resumable);
                const actionsDiv = card.querySelector('.project-actions');
                if (actionsDiv) {
                    // 插入到操作按钮前面
                    actionsDiv.insertBefore(resumeBtn, actionsDiv.firstChild);
                }
                
                // 添加状态徽章
                this.addResumeBadge(card, resumable);
            }
        });
    }

    /**
     * 创建恢复按钮
     */
    createResumeButton(deployment) {
        const button = document.createElement('button');
        button.className = 'btn btn-warning btn-sm resume-deploy-btn';
        button.title = `继续部署 (中断于: ${this.getStageName(deployment.failedStage)})`;
        button.innerHTML = `
            <i class="fas fa-play-circle"></i>
            <span>继续部署</span>
        `;
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startResume(deployment);
        });
        
        return button;
    }

    /**
     * 添加恢复徽章
     */
    addResumeBadge(card, deployment) {
        // 移除现有的徽章
        const existingBadge = card.querySelector('.resume-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        const badge = document.createElement('span');
        badge.className = 'badge badge-warning resume-badge';
        badge.title = `部署可恢复 - 中断于: ${this.getStageName(deployment.failedStage)}`;
        badge.textContent = '可恢复';
        badge.style.marginLeft = '5px';
        badge.style.cursor = 'help';
        
        const titleElement = card.querySelector('.project-title');
        if (titleElement) {
            titleElement.appendChild(badge);
        }
    }

    /**
     * 更新恢复面板
     */
    updateResumePanel() {
        const panel = document.getElementById('resume-deploy-panel');
        if (!panel) return;
        
        if (this.resumableDeployments.length > 0) {
            panel.style.display = 'block';
            this.populateResumePanel(panel);
        } else {
            panel.style.display = 'none';
        }
    }

    /**
     * 填充恢复面板
     */
    populateResumePanel(panel) {
        const listContainer = panel.querySelector('.resume-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        this.resumableDeployments.forEach(deployment => {
            const item = this.createResumeListItem(deployment);
            listContainer.appendChild(item);
        });
    }

    /**
     * 创建恢复列表项
     */
    createResumeListItem(deployment) {
        const item = document.createElement('div');
        item.className = 'resume-list-item';
        item.dataset.stateId = deployment.stateId;
        
        const timeAgo = this.formatTimeAgo(deployment.failedTime);
        const stageName = this.getStageName(deployment.failedStage);
        
        item.innerHTML = `
            <div class="resume-item-header">
                <strong>${deployment.projectName}</strong>
                <span class="badge badge-warning">${stageName}</span>
            </div>
            <div class="resume-item-details">
                <div class="detail">
                    <i class="fas fa-clock"></i>
                    <span>${timeAgo}</span>
                </div>
                <div class="detail">
                    <i class="fas fa-code-branch"></i>
                    <span class="text-truncate">${deployment.repositoryUrl}</span>
                </div>
            </div>
            <div class="resume-item-actions">
                <button class="btn btn-sm btn-primary btn-resume" title="继续部署">
                    <i class="fas fa-play-circle"></i> 继续
                </button>
                <button class="btn btn-sm btn-outline-secondary btn-view" title="查看详情">
                    <i class="fas fa-info-circle"></i> 详情
                </button>
                <button class="btn btn-sm btn-outline-danger btn-clear" title="清除状态">
                    <i class="fas fa-trash"></i> 清除
                </button>
            </div>
        `;
        
        // 绑定事件
        const resumeBtn = item.querySelector('.btn-resume');
        const viewBtn = item.querySelector('.btn-view');
        const clearBtn = item.querySelector('.btn-clear');
        
        resumeBtn.addEventListener('click', () => this.startResume(deployment));
        viewBtn.addEventListener('click', () => this.viewDeploymentDetails(deployment));
        clearBtn.addEventListener('click', () => this.clearDeploymentState(deployment));
        
        return item;
    }

    /**
     * 更新徽章显示
     */
    updateBadges() {
        const count = this.resumableDeployments.length;
        const badge = document.getElementById('resume-count-badge');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
        
        // 更新标题徽章
        const titleBadge = document.querySelector('.resume-title-badge');
        if (titleBadge) {
            titleBadge.textContent = `(${count})`;
        }
    }

    /**
     * 开始恢复部署
     */
    async startResume(deployment) {
        if (!deployment || !deployment.stateId) {
            this.showError('无效的部署信息');
            return;
        }
        
        try {
            // 显示确认对话框
            const confirmed = await this.showConfirmDialog(
                '继续部署',
                `确定要继续部署项目 "${deployment.projectName}" 吗？<br>
                将从 ${this.getStageName(deployment.failedStage)} 阶段恢复。`,
                'warning'
            );
            
            if (!confirmed) return;
            
            // 显示加载状态
            this.showLoading('正在恢复部署...');
            
            // 调用恢复API
            const response = await fetch(`/api/deploy/resume/${deployment.stateId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('部署恢复已开始');
                
                // 启动部署日志
                if (window.deployLogManager) {
                    window.deployLogManager.startDeployLog(deployment.projectId, deployment.projectName);
                }
                
                // 刷新部署列表
                setTimeout(() => this.loadResumableDeployments(), 1000);
            } else {
                throw new Error(data.error || '恢复失败');
            }
        } catch (error) {
            console.error('开始恢复部署失败:', error);
            this.showError('开始恢复部署失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 查看部署详情
     */
    async viewDeploymentDetails(deployment) {
        try {
            const response = await fetch(`/api/deploy/state/${deployment.stateId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showDeploymentDetailsModal(data.data);
            } else {
                throw new Error(data.error || '获取详情失败');
            }
        } catch (error) {
            console.error('查看部署详情失败:', error);
            this.showError('查看部署详情失败: ' + error.message);
        }
    }

    /**
     * 显示部署详情模态框
     */
    showDeploymentDetailsModal(state) {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'deployment-details-modal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-info-circle"></i>
                            部署详情 - ${state.projectName}
                        </h5>
                        <button type="button" class="close" data-dismiss="modal">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="deployment-details-content">
                            <!-- 内容将通过JS填充 -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
                        <button type="button" class="btn btn-primary" id="resume-from-modal">
                            <i class="fas fa-play-circle"></i> 继续部署
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 填充内容
        this.populateDeploymentDetails(state);
        
        // 显示模态框
        $(modal).modal('show');
        
        // 绑定恢复按钮事件
        const resumeBtn = modal.querySelector('#resume-from-modal');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                $(modal).modal('hide');
                this.startResume({
                    stateId: state.stateId,
                    projectId: state.projectId,
                    projectName: state.projectName,
                    failedStage: state.currentStage
                });
            });
        }
        
        // 清理模态框
        $(modal).on('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    /**
     * 填充部署详情
     */
    populateDeploymentDetails(state) {
        const content = document.getElementById('deployment-details-content');
        if (!content) return;
        
        // 格式化时间
        const formatTime = (timeStr) => {
            if (!timeStr) return '未记录';
            return new Date(timeStr).toLocaleString('zh-CN');
        };
        
        // 创建阶段状态表格
        let stagesHtml = '';
        const stageOrder = ['init', 'clone', 'install', 'build', 'start', 'complete'];
        
        stageOrder.forEach(stageKey => {
            const stage = state.stages[stageKey];
            if (!stage) return;
            
            const statusClass = this.getStatusClass(stage.status);
            const stageName = this.getStageName(stageKey);
            
            stagesHtml += `
                <tr>
                    <td>${stageName}</td>
                    <td><span class="badge badge-${statusClass}">${stage.status}</span></td>
                    <td>${formatTime(stage.startTime)}</td>
                    <td>${formatTime(stage.endTime)}</td>
                    <td>${stage.checkpointData ? '有' : '无'}</td>
                </tr>
            `;
        });
        
        content.innerHTML = `
            <div class="deployment-details">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <h6>基本信息</h6>
                        <table class="table table-sm">
                            <tr><th>项目ID:</th><td>${state.projectId}</td></tr>
                            <tr><th>状态ID:</th><td>${state.stateId}</td></tr>
                            <tr><th>仓库URL:</th><td class="text-truncate">${state.repositoryUrl}</td></tr>
                            <tr><th>目标路径:</th><td>${state.targetPath}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>时间信息</h6>
                        <table class="table table-sm">
                            <tr><th>创建时间:</th><td>${formatTime(state.createdAt)}</td></tr>
                            <tr><th>最后更新:</th><td>${formatTime(state.lastUpdated)}</td></tr>
                            <tr><th>当前阶段:</th><td>${this.getStageName(state.currentStage)}</td></tr>
                            <tr><th>可恢复:</th><td>${state.isResumable ? '是' : '否'}</td></tr>
                        </table>
                    </div>
                </div>
                
                <h6>阶段状态</h6>
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>阶段</th>
                            <th>状态</th>
                            <th>开始时间</th>
                            <th>结束时间</th>
                            <th>检查点</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stagesHtml}
                    </tbody>
                </table>
                
                ${state.stages[state.currentStage]?.checkpointData ? `
                    <h6>检查点数据</h6>
                    <pre class="bg-light p-3" style="max-height: 200px; overflow: auto;">
                        ${JSON.stringify(state.stages[state.currentStage].checkpointData, null, 2)}
                    </pre>
                ` : ''}
            </div>
        `;
    }

    /**
     * 清除部署状态
     */
    async clearDeploymentState(deployment) {
        try {
            const confirmed = await this.showConfirmDialog(
                '清除部署状态',
                `确定要清除项目 "${deployment.projectName}" 的部署状态吗？<br>
                这将删除所有恢复数据，无法撤销。`,
                'danger'
            );
            
            if (!confirmed) return;
            
            const response = await fetch(`/api/deploy/state/${deployment.stateId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('部署状态已清除');
                this.loadResumableDeployments();
            } else {
                throw new Error(data.error || '清除失败');
            }
        } catch (error) {
            console.error('清除部署状态失败:', error);
            this.showError('清除部署状态失败: ' + error.message);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 手动刷新按钮
        const refreshBtn = document.getElementById('refresh-resume-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadResumableDeployments());
        }
        
        // 清理所有按钮
        const clearAllBtn = document.getElementById('clear-all-resume-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllResumableDeployments());
        }
        
        // WebSocket连接
        this.setupWebSocket();
    }

    /**
     * 设置WebSocket连接
     */
    setupWebSocket() {
        try {
            const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3000}/ws`;
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('部署恢复WebSocket连接已建立');
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket消息解析失败:', error);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('部署恢复WebSocket连接错误:', error);
            };
            
            this.websocket.onclose = () => {
                console.log('部署恢复WebSocket连接已关闭');
                // 尝试重连
                setTimeout(() => this.setupWebSocket(), 5000);
            };
        } catch (error) {
            console.error('部署恢复WebSocket连接失败:', error);
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'deploy_resume_event':
                this.handleResumeEvent(data);
                break;
            case 'deploy_resume_integrated_start':
                this.showNotification('部署恢复开始', `项目 "${data.projectName}" 的恢复已开始`, 'info');
                break;
        }
    }

    /**
     * 处理恢复事件
     */
    handleResumeEvent(event) {
        const { type, data, stateId } = event;
        
        switch (type) {
            case 'resume_started':
                this.showNotification('恢复开始', `项目 "${data.projectName}" 的恢复已开始`, 'info');
                break;
                
            case 'stage_resume_started':
                this.showNotification('阶段恢复', `开始恢复 ${data.stageName} 阶段`, 'info');
                break;
                
            case 'stage_resume_completed':
                this.showNotification('阶段完成', `${data.stageName} 阶段恢复完成: ${data.message}`, 'success');
                break;
                
            case 'resume_completed':
                if (data.success) {
                    this.showNotification('恢复完成', `项目恢复成功: ${data.message}`, 'success');
                    this.loadResumableDeployments();
                }
                break;
                
            case 'resume_failed':
                this.showNotification('恢复失败', `恢复失败: ${data.error}`, 'error');
                break;
        }
    }

    /**
     * 开始自动检查
     */
    startAutoCheck() {
        // 每30秒检查一次
        this.resumeCheckInterval = setInterval(() => {
            this.loadResumableDeployments();
        }, 30000);
    }

    /**
     * 停止自动检查
     */
    stopAutoCheck() {
        if (this.resumeCheckInterval) {
            clearInterval(this.resumeCheckInterval);
            this.resumeCheckInterval = null;
        }
    }

    /**
     * 清理所有可恢复的部署
     */
    async clearAllResumableDeployments() {
        try {
            const confirmed = await this.showConfirmDialog(
                '清除所有部署状态',
                '确定要清除所有可恢复的部署状态吗？<br>这将删除所有恢复数据，无法撤销。',
                'danger'
            );
            
            if (!confirmed) return;
            
            this.showLoading('正在清除所有部署状态...');
            
            // 逐个清除
            let clearedCount = 0;
            let failedCount = 0;
            
            for (const deployment of this.resumableDeployments) {
                try {
                    const response = await fetch(`/api/deploy/state/${deployment.stateId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            clearedCount++;
                        } else {
                            failedCount++;
                        }
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    failedCount++;
                }
            }
            
            this.hideLoading();
            
            if (failedCount === 0) {
                this.showSuccess(`成功清除 ${clearedCount} 个部署状态`);
            } else {
                this.showWarning(`清除完成: ${clearedCount} 成功, ${failedCount} 失败`);
            }
            
            this.loadResumableDeployments();
        } catch (error) {
            console.error('清除所有部署状态失败:', error);
            this.showError('清除所有部署状态失败: ' + error.message);
            this.hideLoading();
        }
    }

    // 工具方法
    getStageName(stage) {
        const stageNames = {
            'init': '初始化',
            'clone': '克隆仓库',
            'install': '安装依赖',
            'build': '构建项目',
            'start': '启动服务',
            'complete': '部署完成',
            'error': '部署错误'
        };
        
        return stageNames[stage] || stage;
    }

    getStatusClass(status) {
        const statusClasses = {
            'pending': 'secondary',
            'active': 'info',
            'completed': 'success',
            'failed': 'danger'
        };
        
        return statusClasses[status] || 'secondary';
    }

    formatTimeAgo(timeStr) {
        if (!timeStr) return '未知时间';
        
        const time = new Date(timeStr);
        const now = new Date();
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        return `${diffDays}天前`;
    }

    // UI工具方法
    showLoading(message = '加载中...') {
        // 实现加载指示器
        console.log('Loading:', message);
    }

    hideLoading() {
        // 隐藏加载指示器
        console.log('Loading hidden');
    }

    showSuccess(message) {
        // 显示成功消息
        console.log('Success:', message);
    }

    showError(message) {
        // 显示错误消息
        console.error('Error:', message);
    }

    showWarning(message) {
        // 显示警告消息
        console.warn('Warning:', message);
    }

    showNotification(title, message, type = 'info') {
        // 显示通知
        console.log(`Notification [${type}]: ${title} - ${message}`);
    }

    async showConfirmDialog(title, message, type = 'warning') {
        // 显示确认对话框
        return confirm(`${title}\n\n${message.replace(/<br>/g, '\n')}`);
    }
}

// 创建全局实例
window.deployResumeManager = new DeployResumeManager();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.deployResumeManager.init();
    });
} else {
    window.deployResumeManager.init();
}
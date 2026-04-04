/**
 * 部署实时日志流组件
 * 提供部署过程中的实时日志显示和进度跟踪
 */

// 部署阶段配置
const DEPLOY_STAGES = {
    INIT: 'init',
    CLONE: 'clone',
    INSTALL: 'install',
    BUILD: 'build',
    START: 'start',
    COMPLETE: 'complete',
    ERROR: 'error'
};

const STAGE_NAMES = {
    [DEPLOY_STAGES.INIT]: '初始化',
    [DEPLOY_STAGES.CLONE]: '克隆仓库',
    [DEPLOY_STAGES.INSTALL]: '安装依赖',
    [DEPLOY_STAGES.BUILD]: '构建项目',
    [DEPLOY_STAGES.START]: '启动服务',
    [DEPLOY_STAGES.COMPLETE]: '部署完成',
    [DEPLOY_STAGES.ERROR]: '部署错误'
};

const STAGE_ICONS = {
    [DEPLOY_STAGES.INIT]: 'fas fa-cog',
    [DEPLOY_STAGES.CLONE]: 'fas fa-code-branch',
    [DEPLOY_STAGES.INSTALL]: 'fas fa-box',
    [DEPLOY_STAGES.BUILD]: 'fas fa-hammer',
    [DEPLOY_STAGES.START]: 'fas fa-play',
    [DEPLOY_STAGES.COMPLETE]: 'fas fa-check-circle',
    [DEPLOY_STAGES.ERROR]: 'fas fa-exclamation-circle'
};

class DeployLogStream {
    constructor(projectId, projectName) {
        this.projectId = projectId;
        this.projectName = projectName;
        this.streamId = null;
        this.stages = {};
        this.currentStage = DEPLOY_STAGES.INIT;
        this.logs = [];
        this.progress = 0;
        this.isActive = false;
        this.startTime = null;
        this.endTime = null;
        this.websocket = null;
        
        // 初始化所有阶段
        Object.values(DEPLOY_STAGES).forEach(stage => {
            this.stages[stage] = {
                name: STAGE_NAMES[stage],
                icon: STAGE_ICONS[stage],
                status: 'pending', // pending, active, completed, failed
                startTime: null,
                endTime: null,
                logs: []
            };
        });
        
        this.initUI();
    }
    
    /**
     * 初始化UI
     */
    initUI() {
        // 创建部署日志面板
        this.createDeployLogPanel();
        
        // 绑定事件
        this.bindEvents();
    }
    
    /**
     * 创建部署日志面板
     */
    createDeployLogPanel() {
        // 检查是否已存在
        if (document.getElementById('deploy-log-panel')) {
            return;
        }
        
        const panelHTML = `
            <div class="deploy-log-panel" id="deploy-log-panel">
                <div class="panel-header" id="deploy-log-header">
                    <h3>
                        <i class="fas fa-terminal"></i>
                        <span id="deploy-log-title">部署实时日志 - ${this.projectName}</span>
                        <span class="progress-badge" id="deploy-progress">0%</span>
                        <span class="stage-badge" id="deploy-stage">${STAGE_NAMES[DEPLOY_STAGES.INIT]}</span>
                    </h3>
                    <div class="panel-controls">
                        <button class="btn btn-sm btn-light" id="deploy-pause-btn" title="暂停日志">
                            <i class="fas fa-pause"></i>
                        </button>
                        <button class="btn btn-sm btn-light" id="deploy-clear-btn" title="清空日志">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-light" id="deploy-export-btn" title="导出日志">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm btn-light" id="deploy-close-btn" title="关闭面板">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-sm btn-light" id="deploy-toggle-btn" title="展开/折叠">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                </div>
                <div class="panel-content" id="deploy-log-content">
                    <div class="log-stages" id="deploy-log-stages">
                        <!-- 阶段状态将通过JS动态生成 -->
                    </div>
                    <div class="log-container" id="deploy-log-container">
                        <!-- 日志内容将通过JS动态生成 -->
                    </div>
                    <div class="log-progress" id="deploy-progress-bar">
                        <div class="log-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('deploy-log-panel');
        this.content = document.getElementById('deploy-log-content');
        this.logContainer = document.getElementById('deploy-log-container');
        this.stagesContainer = document.getElementById('deploy-log-stages');
        this.progressBar = document.querySelector('.log-progress-bar');
        this.progressText = document.getElementById('deploy-progress');
        this.stageText = document.getElementById('deploy-stage');
        this.titleText = document.getElementById('deploy-log-title');
        
        // 初始化阶段显示
        this.renderStages();
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 面板头部点击切换展开/折叠
        document.getElementById('deploy-log-header').addEventListener('click', () => {
            this.togglePanel();
        });
        
        // 控制按钮
        document.getElementById('deploy-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel();
        });
        
        document.getElementById('deploy-pause-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePause();
        });
        
        document.getElementById('deploy-clear-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearLogs();
        });
        
        document.getElementById('deploy-export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportLogs();
        });
        
        document.getElementById('deploy-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closePanel();
        });
        
        // 阻止点击事件冒泡
        this.content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    /**
     * 渲染阶段状态
     */
    renderStages() {
        const stagesHTML = Object.values(DEPLOY_STAGES)
            .filter(stage => stage !== DEPLOY_STAGES.COMPLETE && stage !== DEPLOY_STAGES.ERROR)
            .map(stage => {
                const stageInfo = this.stages[stage];
                let className = 'stage-item';
                if (stageInfo.status === 'active') className += ' active pulsing';
                if (stageInfo.status === 'completed') className += ' completed';
                if (stageInfo.status === 'failed') className += ' failed';
                
                let duration = '';
                if (stageInfo.startTime && stageInfo.endTime) {
                    const durationMs = stageInfo.endTime - stageInfo.startTime;
                    duration = this.formatDuration(durationMs);
                }
                
                return `
                    <div class="${className}" data-stage="${stage}">
                        <i class="${stageInfo.icon} stage-icon"></i>
                        <span class="stage-name">${stageInfo.name}</span>
                        ${duration ? `<span class="stage-duration">${duration}</span>` : ''}
                    </div>
                `;
            }).join('');
        
        this.stagesContainer.innerHTML = stagesHTML;
    }
    
    /**
     * 开始部署日志流
     */
    start() {
        this.isActive = true;
        this.startTime = Date.now();
        this.currentStage = DEPLOY_STAGES.INIT;
        
        // 激活初始化阶段
        this.setStageActive(DEPLOY_STAGES.INIT);
        
        // 显示面板
        this.showPanel();
        
        // 连接WebSocket
        this.connectWebSocket();
        
        // 添加初始日志
        this.addLog(DEPLOY_STAGES.INIT, `开始部署项目: ${this.projectName}`, { time: this.startTime });
        
        console.log(`Deploy log stream started for project: ${this.projectName}`);
    }
    
    /**
     * 连接WebSocket
     */
    connectWebSocket() {
        try {
            const wsUrl = `ws://${window.location.hostname}:${window.location.port || 3000}/ws`;
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                this.addLog(DEPLOY_STAGES.INIT, 'WebSocket连接已建立', { level: 'success' });
                
                // 订阅项目日志
                this.websocket.send(JSON.stringify({
                    type: 'subscribe',
                    projectId: this.projectId
                }));
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
                console.error('WebSocket连接错误:', error);
                this.addLog(DEPLOY_STAGES.ERROR, 'WebSocket连接错误', { level: 'error' });
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket连接已关闭');
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }
    
    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'deploy_event':
                this.handleDeployEvent(data);
                break;
            case 'deploy_log':
                this.addLog(data.stage, data.message, data);
                break;
            case 'log':
                // 普通日志消息
                this.addLog(this.currentStage, data.data.message, {
                    level: data.data.level,
                    time: data.data.time
                });
                break;
            case 'deploy_status':
                this.streamId = data.streamId;
                this.updateStageStatus(data);
                break;
            case 'progress_update':
                this.updateProgress(data.progress);
                break;
        }
    }
    
    /**
     * 处理部署事件
     */
    handleDeployEvent(event) {
        switch (event.type) {
            case 'deploy_started':
                this.streamId = event.streamId;
                this.titleText.textContent = `部署实时日志 - ${event.projectName}`;
                break;
            case 'stage_update':
                this.setStageActive(event.stage);
                this.stageText.textContent = event.stageName;
                break;
            case 'deploy_completed':
                this.complete(event.success, event.message, event.duration);
                break;
        }
    }
    
    /**
     * 更新阶段状态
     */
    updateStageStatus(data) {
        if (data.stages) {
            data.stages.forEach(stageInfo => {
                if (stageInfo.endTime) {
                    this.setStageCompleted(stageInfo.stage, stageInfo.success);
                }
            });
            this.currentStage = data.currentStage;
            this.stageText.textContent = STAGE_NAMES[data.currentStage];
        }
    }
    
    /**
     * 设置阶段为激活状态
     */
    setStageActive(stage) {
        // 完成上一个阶段（如果存在且不是同一阶段）
        if (this.currentStage && this.currentStage !== stage) {
            this.setStageCompleted(this.currentStage, true);
        }
        
        this.currentStage = stage;
        this.stages[stage].status = 'active';
        this.stages[stage].startTime = Date.now();
        this.stageText.textContent = STAGE_NAMES[stage];
        
        this.renderStages();
    }
    
    /**
     * 设置阶段为完成状态
     */
    setStageCompleted(stage, success = true) {
        this.stages[stage].status = success ? 'completed' : 'failed';
        this.stages[stage].endTime = Date.now();
        this.renderStages();
    }
    
    /**
     * 更新进度
     */
    updateProgress(progress) {
        this.progress = progress;
        this.progressText.textContent = `${progress}%`;
        this.progressBar.style.width = `${progress}%`;
        
        if (progress === 100) {
            this.progressBar.classList.add('complete');
        }
    }
    
    /**
     * 添加日志
     */
    addLog(stage, message, options = {}) {
        const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            time: options.time || Date.now(),
            stage: stage,
            message: message,
            level: options.level || 'info'
        };
        
        this.logs.push(logEntry);
        this.renderLogEntry(logEntry);
        
        // 限制日志数量
        if (this.logs.length > 500) {
            this.logs = this.logs.slice(-500);
            this.cleanupOldLogs();
        }
        
        return logEntry;
    }
    
    /**
     * 渲染日志条目
     */
    renderLogEntry(logEntry) {
        const timeStr = new Date(logEntry.time).toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const logElement = document.createElement('div');
        logElement.className = `deploy-log-entry stage-${logEntry.stage}`;
        logElement.id = logEntry.id;
        logElement.innerHTML = `
            <span class="log-time">${timeStr}</span>
            <span class="log-stage">${STAGE_NAMES[logEntry.stage]}</span>
            <span class="log-message">${this.escapeHtml(logEntry.message)}</span>
        `;
        
        this.logContainer.appendChild(logElement);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
    
    /**
     * 清理旧日志
     */
    cleanupOldLogs() {
        const logElements = this.logContainer.querySelectorAll('.deploy-log-entry');
        const keepCount = 400;
        
        if (logElements.length > keepCount) {
            for (let i = 0; i < logElements.length - keepCount; i++) {
                logElements[i].remove();
            }
        }
    }
    
    /**
     * 完成部署
     */
    complete(success = true, message = '', duration = 0) {
        this.isActive = false;
        this.endTime = Date.now();
        
        // 完成当前阶段
        if (this.currentStage) {
            this.setStageCompleted(this.currentStage, success);
        }
        
        // 设置完成阶段
        const completeStage = success ? DEPLOY_STAGES.COMPLETE : DEPLOY_STAGES.ERROR;
        this.setStageActive(completeStage);
        this.setStageCompleted(completeStage, success);
        
        // 更新进度
        this.updateProgress(100);
        
        // 添加完成日志
        const durationText = this.formatDuration(duration || (this.endTime - this.startTime));
        const finalMessage = message || (success 
            ? `🎉 部署完成！总耗时: ${durationText}` 
            : `❌ 部署失败！总耗时: ${durationText}`);
        
        this.addLog(completeStage, finalMessage, {
            level: success ? 'success' : 'error',
            time: this.endTime
        });
        
        // 更新进度条颜色
        if (success) {
            this.progressBar.classList.add('complete');
        } else {
            this.progressBar.classList.remove('complete');
            this.progressBar.classList.add('error');
        }
        
        console.log(`Deploy log stream completed: ${success ? 'success' : 'failed'}`);
    }
    
    /**
     * 显示面板
     */
    showPanel() {
        this.panel.classList.add('active');
        setTimeout(() => {
            this.panel.classList.remove('collapsed');
        }, 10);
    }
    
    /**
     * 隐藏面板
     */
    hidePanel() {
        this.panel.classList.add('collapsed');
        setTimeout(() => {
            this.panel.classList.remove('active');
        }, 300);
    }
    
    /**
     * 切换面板展开/折叠
     */
    togglePanel() {
        if (this.panel.classList.contains('collapsed')) {
            this.panel.classList.remove('collapsed');
        } else {
            this.panel.classList.add('collapsed');
        }
    }
    
    /**
     * 切换暂停状态
     */
    togglePause() {
        const btn = document.getElementById('deploy-pause-btn');
        const icon = btn.querySelector('i');
        
        if (icon.classList.contains('fa-pause')) {
            icon.className = 'fas fa-play';
            btn.title = '继续日志';
        } else {
            icon.className = 'fas fa-pause';
            btn.title = '暂停日志';
        }
    }
    
    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
        this.logContainer.innerHTML = '';
        this.addLog(DEPLOY_STAGES.INIT, '日志已清空', { level: 'info' });
    }
    
    /**
     * 导出日志
     */
    exportLogs() {
        const logText = this.logs.map(log => {
            const timeStr = new Date(log.time).toLocaleString('zh-CN');
            return `${timeStr} [${STAGE_NAMES[log.stage]}] ${log.message}`;
        }).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deploy-logs-${this.projectName}-${new Date().toISOString().split('T')[0]}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog(DEPLOY_STAGES.INIT, '日志已导出', { level: 'info' });
    }
    
    /**
     * 关闭面板
     */
    closePanel() {
        this.hidePanel();
        setTimeout(() => {
            if (this.panel && this.panel.parentNode) {
                this.panel.parentNode.removeChild(this.panel);
            }
        }, 300);
    }
    
    /**
     * 格式化持续时间
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
        return `${Math.floor(ms / 3600000)}小时${Math.floor((ms % 3600000) / 60000)}分`;
    }
    
    /**
     * 转义HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 全局部署日志管理器
class DeployLogManager {
    constructor() {
        this.activeStreams = new Map();
    }
    
    /**
     * 开始部署日志流
     */
    startDeployLog(projectId, projectName) {
        // 如果已有活动流，先关闭
        if (this.activeStreams.has(projectId)) {
            this.activeStreams.get(projectId).closePanel();
        }
        
        const stream = new DeployLogStream(projectId, projectName);
        stream.start();
        this.activeStreams.set(projectId, stream);
        
        return stream;
    }
    
    /**
     * 获取部署日志流
     */
    getDeployLog(projectId) {
        return this.activeStreams.get(projectId);
    }
    
    /**
     * 结束部署日志流
     */
    endDeployLog(projectId, success = true, message = '') {
        const stream = this.activeStreams.get(projectId);
        if (stream) {
            stream.complete(success, message);
            // 10秒后自动关闭面板
            setTimeout(() => {
                stream.closePanel();
                this.activeStreams.delete(projectId);
            }, 10000);
        }
    }
}

// 导出全局实例
window.deployLogManager = new DeployLogManager();
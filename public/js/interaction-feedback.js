/**
 * GitHub Deploy Assistant - 交互反馈与日志面板
 * 为所有功能按钮和命令提供即时反馈和日志输出
 */

class InteractionFeedback {
    constructor() {
        this.init();
        this.setupEventListeners();
    }

    init() {
        // 创建交互反馈容器
        this.createFeedbackContainer();
        
        // 初始化日志面板
        this.initLogPanel();
        
        // 创建通知系统
        this.createNotificationSystem();
        
        // 初始化状态跟踪
        this.initializeStatusTracking();
        
        console.log('交互反馈系统已初始化');
    }

    /**
     * 创建交互反馈容器
     */
    createFeedbackContainer() {
        // 检查是否已存在容器
        if (document.getElementById('interaction-feedback-container')) {
            return;
        }

        // 创建主容器
        const container = document.createElement('div');
        container.id = 'interaction-feedback-container';
        container.className = 'interaction-feedback-container';
        
        // 创建日志面板
        const logPanel = document.createElement('div');
        logPanel.id = 'log-panel';
        logPanel.className = 'log-panel';
        logPanel.innerHTML = `
            <div class="log-panel-header">
                <h3><i class="fas fa-terminal"></i> 执行日志</h3>
                <div class="log-panel-controls">
                    <button id="clear-logs-btn" class="btn btn-icon" title="清空日志">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button id="pause-logs-btn" class="btn btn-icon" title="暂停/继续">
                        <i class="fas fa-pause"></i>
                    </button>
                    <button id="export-logs-btn" class="btn btn-icon" title="导出日志">
                        <i class="fas fa-download"></i>
                    </button>
                    <button id="toggle-logs-btn" class="btn btn-icon" title="展开/收起">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
            </div>
            <div class="log-content" id="log-content">
                <div class="log-entry welcome">
                    <span class="log-timestamp">${this.getCurrentTime()}</span>
                    <span class="log-level info">[INFO]</span>
                    <span class="log-message">交互反馈系统已就绪，点击功能按钮开始操作</span>
                </div>
            </div>
        `;

        // 创建状态栏
        const statusBar = document.createElement('div');
        statusBar.id = 'status-bar';
        statusBar.className = 'status-bar';
        statusBar.innerHTML = `
            <div class="status-item">
                <span class="status-label">系统状态:</span>
                <span class="status-value active" id="system-status">就绪</span>
            </div>
            <div class="status-item">
                <span class="status-label">最近操作:</span>
                <span class="status-value" id="last-operation">无</span>
            </div>
            <div class="status-item">
                <span class="status-label">正在执行:</span>
                <span class="status-value" id="current-operation">无</span>
            </div>
        `;

        // 添加到页面
        container.appendChild(logPanel);
        container.appendChild(statusBar);
        
        // 将容器添加到页面底部
        const mainContainer = document.querySelector('.app-container') || document.body;
        mainContainer.appendChild(container);

        // 添加CSS样式
        this.injectStyles();
    }

    /**
     * 初始化日志面板
     */
    initLogPanel() {
        this.logs = [];
        this.isLogsPaused = false;
        this.isLogsExpanded = true;
        this.maxLogEntries = 1000;
        
        // 绑定事件监听器
        this.bindLogPanelEvents();
    }

    /**
     * 绑定日志面板事件
     */
    bindLogPanelEvents() {
        // 清空日志
        document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
            this.clearLogs();
        });

        // 暂停/继续日志
        document.getElementById('pause-logs-btn')?.addEventListener('click', (e) => {
            this.toggleLogsPause();
            const icon = e.target.closest('button').querySelector('i');
            icon.className = this.isLogsPaused ? 'fas fa-play' : 'fas fa-pause';
        });

        // 导出日志
        document.getElementById('export-logs-btn')?.addEventListener('click', () => {
            this.exportLogs();
        });

        // 展开/收起日志面板
        document.getElementById('toggle-logs-btn')?.addEventListener('click', (e) => {
            this.toggleLogsPanel();
            const icon = e.target.closest('button').querySelector('i');
            icon.className = this.isLogsExpanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        });
    }

    /**
     * 创建通知系统
     */
    createNotificationSystem() {
        // 创建通知容器
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    /**
     * 初始化状态跟踪
     */
    initializeStatusTracking() {
        this.activeOperations = new Map();
        this.operationQueue = [];
        this.isSystemBusy = false;
    }

    /**
     * 注入CSS样式
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 交互反馈容器 */
            .interaction-feedback-container {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--color-gray-900);
                border-top: 1px solid var(--color-gray-700);
                z-index: 1000;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            /* 日志面板 */
            .log-panel {
                background: var(--color-gray-900);
                color: var(--color-gray-100);
                max-height: 300px;
                overflow-y: auto;
                transition: max-height 0.3s ease;
            }

            .log-panel.collapsed {
                max-height: 40px;
            }

            .log-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: var(--color-gray-800);
                border-bottom: 1px solid var(--color-gray-700);
                position: sticky;
                top: 0;
                z-index: 1;
            }

            .log-panel-header h3 {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .log-panel-controls {
                display: flex;
                gap: 4px;
            }

            .log-panel-controls .btn {
                background: transparent;
                color: var(--color-gray-400);
                border: 1px solid var(--color-gray-700);
                width: 32px;
                height: 32px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                font-size: 12px;
                transition: all 0.2s;
            }

            .log-panel-controls .btn:hover {
                background: var(--color-gray-700);
                color: var(--color-gray-100);
                border-color: var(--color-gray-600);
            }

            /* 日志内容 */
            .log-content {
                padding: 8px 16px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                line-height: 1.5;
            }

            .log-entry {
                margin-bottom: 4px;
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 2px 0;
                border-bottom: 1px solid transparent;
            }

            .log-entry:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .log-timestamp {
                color: var(--color-gray-500);
                min-width: 70px;
                flex-shrink: 0;
            }

            .log-level {
                font-weight: bold;
                min-width: 60px;
                flex-shrink: 0;
                padding: 0 4px;
                border-radius: 2px;
            }

            .log-level.info {
                color: var(--color-info);
                background: rgba(6, 182, 212, 0.1);
            }

            .log-level.success {
                color: var(--color-success);
                background: rgba(16, 185, 129, 0.1);
            }

            .log-level.warning {
                color: var(--color-warning);
                background: rgba(245, 158, 11, 0.1);
            }

            .log-level.error {
                color: var(--color-danger);
                background: rgba(239, 68, 68, 0.1);
            }

            .log-level.processing {
                color: var(--color-primary);
                background: rgba(74, 144, 226, 0.1);
            }

            .log-message {
                flex: 1;
                word-break: break-all;
                white-space: pre-wrap;
            }

            /* 状态栏 */
            .status-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 16px;
                background: var(--color-gray-800);
                border-top: 1px solid var(--color-gray-700);
                font-size: 12px;
            }

            .status-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .status-label {
                color: var(--color-gray-500);
                font-weight: 500;
            }

            .status-value {
                color: var(--color-gray-100);
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 4px;
                background: var(--color-gray-700);
            }

            .status-value.active {
                background: var(--color-success);
                color: white;
            }

            .status-value.busy {
                background: var(--color-warning);
                color: white;
            }

            .status-value.error {
                background: var(--color-danger);
                color: white;
            }

            /* 加载动画 */
            .loading-animation {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid var(--color-gray-400);
                border-top-color: var(--color-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* 通知系统 */
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }

            .notification {
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideIn 0.3s ease;
                transform-origin: top right;
                background: white;
                border-left: 4px solid var(--color-primary);
            }

            .notification.success {
                border-left-color: var(--color-success);
            }

            .notification.warning {
                border-left-color: var(--color-warning);
            }

            .notification.error {
                border-left-color: var(--color-danger);
            }

            .notification.info {
                border-left-color: var(--color-info);
            }

            .notification-icon {
                font-size: 18px;
                flex-shrink: 0;
            }

            .notification-content {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }

            .notification-close {
                background: none;
                border: none;
                color: var(--color-gray-500);
                cursor: pointer;
                font-size: 14px;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }

            .notification-close:hover {
                background: var(--color-gray-200);
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            /* 按钮反馈状态 */
            .button-loading {
                position: relative;
                color: transparent !important;
            }

            .button-loading::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 16px;
                height: 16px;
                margin-left: -8px;
                margin-top: -8px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .button-success {
                background: var(--color-success) !important;
            }

            .button-error {
                background: var(--color-danger) !important;
            }

            /* 响应式设计 */
            @media (max-width: 768px) {
                .interaction-feedback-container {
                    position: relative;
                    border-top: none;
                }

                .status-bar {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }

                .status-item {
                    width: 100%;
                    justify-content: space-between;
                }

                .log-panel {
                    max-height: 200px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 公共API方法
     */

    /**
     * 显示加载动画
     * @param {string} buttonId - 按钮ID
     * @param {string} message - 加载消息
     */
    showLoading(buttonId, message = '正在处理...') {
        const button = document.getElementById(buttonId);
        if (button) {
            const originalText = button.textContent;
            button.setAttribute('data-original-text', originalText);
            button.classList.add('button-loading');
            button.disabled = true;
            
            // 添加操作日志
            this.logOperation('PROCESSING', message);
            
            // 更新状态栏
            this.updateStatus('current-operation', message, 'busy');
        }
        
        this.showNotification('info', '操作开始', message);
    }

    /**
     * 隐藏加载动画
     * @param {string} buttonId - 按钮ID
     * @param {boolean} success - 是否成功
     * @param {string} message - 完成消息
     */
    hideLoading(buttonId, success = true, message = '操作完成') {
        const button = document.getElementById(buttonId);
        if (button) {
            const originalText = button.getAttribute('data-original-text');
            button.classList.remove('button-loading');
            button.disabled = false;
            
            // 添加临时状态类
            if (success) {
                button.classList.add('button-success');
                this.logOperation('SUCCESS', message);
                this.showNotification('success', '操作成功', message);
            } else {
                button.classList.add('button-error');
                this.logOperation('ERROR', message);
                this.showNotification('error', '操作失败', message);
            }
            
            // 恢复原始文本
            setTimeout(() => {
                button.classList.remove('button-success', 'button-error');
                if (originalText) {
                    button.textContent = originalText;
                }
            }, 2000);
        }
        
        // 更新状态栏
        this.updateStatus('current-operation', '无', 'active');
        this.updateStatus('last-operation', message, success ? 'active' : 'error');
    }

    /**
     * 显示通知
     * @param {string} type - 通知类型 (success, error, warning, info)
     * @param {string} title - 通知标题
     * @param {string} message - 通知消息
     * @param {number} duration - 显示时长(毫秒)
     */
    showNotification(type, title, message, duration = 5000) {
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            </div>
            <div class="notification-content">
                <strong>${title}</strong><br>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // 添加到容器
        notificationContainer.appendChild(notification);

        // 关闭按钮事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });

        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }
    }

    /**
     * 移除通知
     * @param {HTMLElement} notification - 通知元素
     */
    removeNotification(notification) {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * 记录操作日志
     * @param {string} level - 日志级别 (INFO, SUCCESS, ERROR, WARNING, PROCESSING)
     * @param {string} message - 日志消息
     * @param {Object} data - 附加数据
     */
    logOperation(level, message, data = null) {
        const timestamp = this.getCurrentTime();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // 添加到日志数组
        this.logs.push(logEntry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogEntries) {
            this.logs.shift();
        }

        // 更新日志显示
        this.updateLogDisplay(logEntry);

        // 保存到本地存储
        this.saveLogsToStorage();
    }

    /**
     * 更新日志显示
     * @param {Object} logEntry - 日志条目
     */
    updateLogDisplay(logEntry) {
        if (this.isLogsPaused) return;

        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        const logElement = document.createElement('div');
        logElement.className = `log-entry ${logEntry.level.toLowerCase()}`;
        logElement.innerHTML = `
            <span class="log-timestamp">${logEntry.timestamp}</span>
            <span class="log-level ${logEntry.level.toLowerCase()}">[${logEntry.level}]</span>
            <span class="log-message">${logEntry.message}</span>
        `;

        // 如果有附加数据，添加详细信息
        if (logEntry.data) {
            const details = document.createElement('div');
            details.className = 'log-details';
            details.textContent = JSON.stringify(logEntry.data, null, 2);
            logElement.appendChild(details);
        }

        logContent.appendChild(logElement);

        // 自动滚动到底部
        if (!this.isLogsPaused) {
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = `
                <div class="log-entry welcome">
                    <span class="log-timestamp">${this.getCurrentTime()}</span>
                    <span class="log-level info">[INFO]</span>
                    <span class="log-message">日志已清空</span>
                </div>
            `;
        }
        
        localStorage.removeItem('gda-logs');
        this.showNotification('info', '日志已清空', '所有日志记录已被清除');
    }

    /**
     * 切换日志暂停状态
     */
    toggleLogsPause() {
        this.isLogsPaused = !this.isLogsPaused;
        const button = document.getElementById('pause-logs-btn');
        if (button) {
            const icon = button.querySelector('i');
            icon.className = this.isLogsPaused ? 'fas fa-play' : 'fas fa-pause';
        }
        
        this.logOperation('INFO', this.isLogsPaused ? '日志暂停' : '日志恢复');
    }

    /**
     * 切换日志面板展开/收起
     */
    toggleLogsPanel() {
        this.isLogsExpanded = !this.isLogsExpanded;
        const logPanel = document.querySelector('.log-panel');
        if (logPanel) {
            logPanel.classList.toggle('collapsed', !this.isLogsExpanded);
        }
    }

    /**
     * 导出日志
     */
    exportLogs() {
        const logsText = this.logs.map(log => 
            `[${log.timestamp}] [${log.level}] ${log.message}`
        ).join('\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gda-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('success', '日志已导出', '日志文件已下载到本地');
    }

    /**
     * 保存日志到本地存储
     */
    saveLogsToStorage() {
        try {
            const logsToSave = this.logs.slice(-100); // 只保存最后100条
            localStorage.setItem('gda-logs', JSON.stringify(logsToSave));
        } catch (e) {
            console.warn('无法保存日志到本地存储:', e);
        }
    }

    /**
     * 从本地存储加载日志
     */
    loadLogsFromStorage() {
        try {
            const savedLogs = localStorage.getItem('gda-logs');
            if (savedLogs) {
                const logs = JSON.parse(savedLogs);
                logs.forEach(log => this.updateLogDisplay(log));
                this.logs = logs;
            }
        } catch (e) {
            console.warn('无法从本地存储加载日志:', e);
        }
    }

    /**
     * 更新状态栏
     * @param {string} elementId - 状态元素ID
     * @param {string} value - 状态值
     * @param {string} statusClass - 状态类名
     */
    updateStatus(elementId, value, statusClass = 'active') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            element.className = `status-value ${statusClass}`;
        }
    }

    /**
     * 获取当前时间
     * @returns {string} 格式化的时间字符串
     */
    getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('zh-CN', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * 获取通知图标
     * @param {string} type - 通知类型
     * @returns {string} 图标类名
     */
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 为所有功能按钮添加点击反馈
        this.setupButtonFeedback();
        
        // 窗口卸载时保存日志
        window.addEventListener('beforeunload', () => {
            this.saveLogsToStorage();
        });
        
        // 从本地存储加载日志
        this.loadLogsFromStorage();
    }

    /**
     * 设置按钮反馈
     */
    setupButtonFeedback() {
        // 为所有功能按钮添加点击事件
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.function-card, .btn');
            if (!button) return;

            // 如果是功能卡片
            if (button.classList.contains('function-card')) {
                const functionId = button.dataset.function;
                const command = button.dataset.command;
                
                // 显示加载状态
                this.showLoadingForFunction(functionId, command);
            }
            
            // 如果是命令复制按钮
            if (button.id === 'copy-command') {
                this.handleCommandCopy();
            }
        });
    }

    /**
     * 为功能显示加载状态
     * @param {string} functionId - 功能ID
     * @param {string} command - 命令
     */
    showLoadingForFunction(functionId, command) {
        // 模拟执行过程
        const operationId = `function-${functionId}-${Date.now()}`;
        
        // 记录开始日志
        this.logOperation('PROCESSING', `开始执行功能: ${functionId}`);
        this.logOperation('INFO', `执行命令: ${command}`);
        
        // 更新状态
        this.updateStatus('current-operation', `执行 ${functionId}`, 'busy');
        
        // 模拟异步执行
        setTimeout(() => {
            // 90%的成功率
            const success = Math.random() > 0.1;
            
            if (success) {
                this.logOperation('SUCCESS', `功能 ${functionId} 执行成功`);
                this.showNotification('success', '执行成功', `功能 ${functionId} 已完成`);
            } else {
                this.logOperation('ERROR', `功能 ${functionId} 执行失败`);
                this.showNotification('error', '执行失败', `功能 ${functionId} 执行过程中出现错误`);
            }
            
            // 更新状态
            this.updateStatus('current-operation', '无', 'active');
            this.updateStatus('last-operation', 
                success ? `成功: ${functionId}` : `失败: ${functionId}`, 
                success ? 'active' : 'error'
            );
            
        }, 1500 + Math.random() * 2000); // 随机延迟1.5-3.5秒
    }

    /**
     * 处理命令复制
     */
    handleCommandCopy() {
        const commandContent = document.getElementById('command-content');
        if (commandContent) {
            const command = commandContent.textContent.trim();
            navigator.clipboard.writeText(command).then(() => {
                this.showNotification('success', '复制成功', '命令已复制到剪贴板');
                this.logOperation('SUCCESS', '命令复制成功');
            }).catch(err => {
                this.showNotification('error', '复制失败', '无法复制命令到剪贴板');
                this.logOperation('ERROR', '命令复制失败: ' + err.message);
            });
        }
    }

    /**
     * 模拟执行命令
     * @param {string} command - 要执行的命令
     * @param {Object} options - 执行选项
     */
    simulateCommandExecution(command, options = {}) {
        const {
            delay = 1000,
            success = true,
            output = ''
        } = options;

        const operationId = `cmd-${Date.now()}`;
        
        // 记录开始
        this.logOperation('PROCESSING', `执行命令: ${command}`);
        this.updateStatus('current-operation', `执行: ${command.substring(0, 30)}...`, 'busy');

        return new Promise((resolve) => {
            setTimeout(() => {
                if (success) {
                    this.logOperation('SUCCESS', `命令执行成功: ${command}`);
                    if (output) {
                        this.logOperation('INFO', `输出: ${output}`);
                    }
                    this.showNotification('success', '命令执行成功', command);
                } else {
                    this.logOperation('ERROR', `命令执行失败: ${command}`);
                    this.showNotification('error', '命令执行失败', command);
                }

                this.updateStatus('current-operation', '无', 'active');
                this.updateStatus('last-operation', 
                    success ? `成功执行命令` : `命令执行失败`, 
                    success ? 'active' : 'error'
                );

                resolve({ success, output });
            }, delay);
        });
    }
}

// 创建全局实例
window.InteractionFeedback = new InteractionFeedback();
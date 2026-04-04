/**
 * AI智能诊断前端逻辑
 */

class AIDiagnose {
    constructor() {
        this.currentDiagnosisId = null;
        this.currentProjectId = null;
        this.socket = null;
        this.fixCommands = [];
        this.confirmationToken = null;
        this.executionResults = [];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadProjects();
        this.loadDiagnosisFromUrl();
        this.connectWebSocket();
    }
    
    bindEvents() {
        // 手动诊断按钮
        document.getElementById('manualDiagnoseBtn')?.addEventListener('click', () => this.manualDiagnose());
        
        // 一键修复按钮
        document.getElementById('quickFixBtn')?.addEventListener('click', () => this.showConfirmFixModal());
        
        // 手动执行按钮
        document.getElementById('manualFixBtn')?.addEventListener('click', () => this.copyCommandsToClipboard());
        
        // 重新部署按钮
        document.getElementById('redeployBtn')?.addEventListener('click', () => this.redeployProject());
        
        // 查看详情按钮
        document.getElementById('viewDetailsBtn')?.addEventListener('click', () => this.viewDiagnosisDetails());
        
        // 确认修复对话框
        const confirmCheck = document.getElementById('confirmationCheck');
        const confirmFixBtn = document.getElementById('confirmFixBtn');
        
        if (confirmCheck && confirmFixBtn) {
            confirmCheck.addEventListener('change', (e) => {
                confirmFixBtn.disabled = !e.target.checked;
            });
            
            confirmFixBtn.addEventListener('click', () => {
                this.executeFixCommands();
                bootstrap.Modal.getInstance(document.getElementById('confirmFixModal')).hide();
            });
        }
    }
    
    // 从URL参数加载诊断信息
    loadDiagnosisFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const diagnosisId = urlParams.get('diagnosis_id');
        const projectId = urlParams.get('project_id');
        
        if (diagnosisId) {
            this.loadDiagnosis(diagnosisId);
        } else if (projectId) {
            this.loadProjectDiagnoses(projectId);
        } else {
            this.loadRecentDiagnoses();
        }
    }
    
    // 加载项目列表
    async loadProjects() {
        try {
            const response = await api.get('/api/projects');
            if (response.success && response.data) {
                const select = document.getElementById('projectSelect');
                if (select) {
                    select.innerHTML = '<option value="">请选择项目...</option>' +
                        response.data.map(project => 
                            `<option value="${project.id}">${project.name}</option>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('加载项目列表失败:', error);
        }
    }
    
    // 加载诊断详情
    async loadDiagnosis(diagnosisId) {
        try {
            const response = await api.get(`/api/ai/diagnosis/${diagnosisId}`);
            if (response.success && response.data) {
                this.currentDiagnosisId = diagnosisId;
                this.currentProjectId = response.data.project_id;
                this.renderDiagnosis(response.data);
            } else {
                this.showError('加载诊断详情失败');
            }
        } catch (error) {
            console.error('加载诊断详情失败:', error);
            this.showError(`加载诊断详情失败: ${error.message}`);
        }
    }
    
    // 加载项目诊断历史
    async loadProjectDiagnoses(projectId) {
        try {
            const response = await api.get(`/api/ai/diagnosis/project/${projectId}?limit=20`);
            if (response.success && response.data) {
                this.renderHistory(response.data);
            }
        } catch (error) {
            console.error('加载诊断历史失败:', error);
        }
    }
    
    // 加载最近的诊断
    async loadRecentDiagnoses() {
        // 这里可以加载所有项目的最新诊断
        // 简化实现：先显示空状态
    }
    
    // 渲染诊断详情
    renderDiagnosis(diagnosis) {
        // 显示当前诊断区域
        document.getElementById('currentDiagnosisSection').classList.remove('d-none');
        
        // 更新基础信息
        document.getElementById('projectName').textContent = diagnosis.project_name || '未知项目';
        document.getElementById('failedCommand').textContent = diagnosis.failed_command || '未知';
        document.getElementById('diagnosisId').textContent = diagnosis.id;
        
        // 更新状态徽章
        this.updateStatusBadge(diagnosis.status);
        this.updateRiskBadge(diagnosis.risk_level);
        
        // 更新时间
        if (diagnosis.created_at) {
            const time = new Date(diagnosis.created_at).toLocaleString('zh-CN');
            document.getElementById('diagnosisTime').textContent = time;
        }
        
        // 解析AI诊断结果
        let aiDiagnosis = {};
        try {
            if (typeof diagnosis.ai_diagnosis === 'string') {
                aiDiagnosis = JSON.parse(diagnosis.ai_diagnosis);
            } else if (diagnosis.ai_diagnosis) {
                aiDiagnosis = diagnosis.ai_diagnosis;
            }
        } catch (e) {
            console.warn('解析AI诊断结果失败:', e);
        }
        
        // 更新分析结果
        const analysisEl = document.getElementById('errorAnalysis');
        if (aiDiagnosis.analysis) {
            analysisEl.textContent = aiDiagnosis.analysis;
            analysisEl.className = 'alert alert-info';
        } else {
            analysisEl.textContent = 'AI分析结果待生成...';
            analysisEl.className = 'alert alert-secondary';
        }
        
        // 更新修复建议
        const suggestionEl = document.getElementById('fixSuggestion');
        if (aiDiagnosis.suggestion) {
            suggestionEl.textContent = aiDiagnosis.suggestion;
            suggestionEl.className = 'alert alert-warning';
        } else {
            suggestionEl.textContent = '修复建议待生成...';
            suggestionEl.className = 'alert alert-secondary';
        }
        
        // 更新可自动修复状态
        const autoFixable = aiDiagnosis.auto_fixable === true;
        document.getElementById('autoFixable').textContent = autoFixable ? '是' : '否';
        document.getElementById('autoFixable').className = autoFixable ? 'text-success fw-bold' : 'text-danger fw-bold';
        
        // 如果有修复命令，显示修复命令区域
        if (aiDiagnosis.fix_commands && aiDiagnosis.fix_commands.length > 0) {
            this.fixCommands = aiDiagnosis.fix_commands;
            this.renderFixCommands(aiDiagnosis.fix_commands);
            this.validateCommands(aiDiagnosis.fix_commands);
            
            // 显示修复命令区域
            document.getElementById('fixCommandsSection').classList.remove('d-none');
            
            // 根据状态更新按钮状态
            if (diagnosis.status === 'CONFIRMED' || diagnosis.status === 'APPLIED') {
                document.getElementById('quickFixBtn').disabled = true;
                document.getElementById('quickFixBtn').innerHTML = '<i class="fas fa-check me-2"></i>已确认';
            }
            
            if (diagnosis.status === 'SUCCESS' || diagnosis.status === 'FAILED') {
                this.showFixResult(diagnosis);
            }
        } else {
            document.getElementById('fixCommandsSection').classList.add('d-none');
        }
    }
    
    // 渲染修复命令
    renderFixCommands(commands) {
        const container = document.getElementById('fixCommandsList');
        if (!container) return;
        
        container.innerHTML = commands.map((cmd, index) => `
            <div class="command-box">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <small class="text-muted">命令 ${index + 1}</small>
                    <button class="btn btn-sm btn-outline-secondary copy-cmd-btn" data-cmd="${cmd}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <pre>${this.escapeHtml(cmd)}</pre>
            </div>
        `).join('');
        
        // 绑定复制按钮事件
        container.querySelectorAll('.copy-cmd-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cmd = e.target.closest('button').dataset.cmd;
                this.copyToClipboard(cmd);
                this.showToast('命令已复制到剪贴板', 'success');
            });
        });
    }
    
    // 验证命令安全性
    async validateCommands(commands) {
        const container = document.getElementById('commandsValidation');
        if (!container) return;
        
        try {
            const response = await api.post('/api/ai/validate-commands', { commands });
            if (response.success && response.data) {
                const validation = response.data;
                
                container.innerHTML = `
                    <div class="command-validation">
                        <i class="fas fa-shield-alt me-1"></i>
                        <strong>命令安全性验证:</strong>
                        ${validation.all_safe ? 
                            '<span class="validation-safe">所有命令安全</span>' : 
                            '<span class="validation-unsafe">部分命令需要审核</span>'}
                        <div class="mt-1 small">
                            ${validation.results.map(result => `
                                <div class="${result.safe ? 'validation-safe' : 'validation-unsafe'}">
                                    <i class="fas fa-${result.safe ? 'check-circle' : 'exclamation-triangle'} me-1"></i>
                                    ${result.command.substring(0, 50)}${result.command.length > 50 ? '...' : ''}
                                    ${result.safe ? '' : ` - ${result.reason}`}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('验证命令失败:', error);
        }
    }
    
    // 更新状态徽章
    updateStatusBadge(status) {
        const badge = document.getElementById('diagnosisStatusBadge');
        if (!badge) return;
        
        const statusMap = {
            'PENDING': { text: '待分析', class: 'status-pending' },
            'ANALYZED': { text: '已分析', class: 'status-analyzed' },
            'CONFIRMED': { text: '已确认', class: 'status-confirmed' },
            'APPLIED': { text: '执行中', class: 'status-applied' },
            'SUCCESS': { text: '成功', class: 'status-success' },
            'FAILED': { text: '失败', class: 'status-failed' },
            'ROLLED_BACK': { text: '已回滚', class: 'status-rolled-back' }
        };
        
        const statusInfo = statusMap[status] || { text: status, class: 'status-pending' };
        badge.textContent = statusInfo.text;
        badge.className = `status-badge ${statusInfo.class}`;
    }
    
    // 更新风险徽章
    updateRiskBadge(riskLevel) {
        const badge = document.getElementById('diagnosisRiskBadge');
        if (!badge) return;
        
        const riskMap = {
            'LOW': { text: '低风险', class: 'risk-low' },
            'MEDIUM': { text: '中风险', class: 'risk-medium' },
            'HIGH': { text: '高风险', class: 'risk-high' }
        };
        
        const riskInfo = riskMap[riskLevel] || { text: '未知', class: 'risk-medium' };
        badge.textContent = riskInfo.text;
        badge.className = `risk-badge ${riskInfo.class}`;
    }
    
    // 显示修复结果
    showFixResult(diagnosis) {
        // 隐藏修复命令区域，显示结果区域
        document.getElementById('fixCommandsSection').classList.add('d-none');
        document.getElementById('fixResultSection').classList.remove('d-none');
        
        const resultAlert = document.getElementById('fixResultAlert');
        const appliedFix = diagnosis.applied_fix || [];
        const fixResult = diagnosis.fix_result || [];
        
        if (diagnosis.status === 'SUCCESS') {
            resultAlert.className = 'alert alert-success';
            resultAlert.innerHTML = `
                <i class="fas fa-check-circle me-2"></i>
                <strong>修复成功!</strong> 成功执行了 ${appliedFix.length} 个修复命令。
                ${fixResult.length > 0 ? `<div class="mt-2 small">${this.formatFixResults(fixResult)}</div>` : ''}
            `;
        } else if (diagnosis.status === 'FAILED') {
            resultAlert.className = 'alert alert-danger';
            resultAlert.innerHTML = `
                <i class="fas fa-times-circle me-2"></i>
                <strong>修复失败!</strong> 执行修复命令时出现问题。
                ${fixResult.length > 0 ? `<div class="mt-2 small">${this.formatFixResults(fixResult)}</div>` : ''}
            `;
        }
    }
    
    // 格式化修复结果
    formatFixResults(results) {
        return results.map((result, index) => `
            <div class="mb-2">
                <strong>命令 ${index + 1}:</strong> ${result.command.substring(0, 80)}${result.command.length > 80 ? '...' : ''}
                <div class="ms-3">
                    <span class="${result.success ? 'text-success' : 'text-danger'}">
                        ${result.success ? '✅ 成功' : '❌ 失败'} (退出码: ${result.exitCode})
                    </span>
                    ${result.error ? `<div class="text-danger small">${result.error}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    // 渲染历史记录
    renderHistory(diagnoses) {
        const container = document.getElementById('historyList');
        if (!container) return;
        
        if (!diagnoses || diagnoses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h5 class="mt-3">暂无历史诊断记录</h5>
                    <p class="text-muted">当部署失败时，AI会自动创建诊断记录</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = diagnoses.map(diagnosis => {
            let aiDiagnosis = {};
            try {
                if (typeof diagnosis.ai_diagnosis === 'string') {
                    aiDiagnosis = JSON.parse(diagnosis.ai_diagnosis);
                } else if (diagnosis.ai_diagnosis) {
                    aiDiagnosis = diagnosis.ai_diagnosis;
                }
            } catch (e) {}
            
            const time = new Date(diagnosis.created_at).toLocaleString('zh-CN');
            const riskClass = `risk-badge risk-${diagnosis.risk_level?.toLowerCase() || 'medium'}`;
            
            return `
                <div class="card diagnosis-card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h6 class="mb-1">
                                    <a href="?diagnosis_id=${diagnosis.id}" class="text-decoration-none">
                                        ${diagnosis.project_name || '未知项目'}
                                    </a>
                                </h6>
                                <small class="text-muted">${time} • ${diagnosis.failed_command || '未知命令'}</small>
                            </div>
                            <div>
                                <span class="${riskClass}">${diagnosis.risk_level || 'MEDIUM'}</span>
                            </div>
                        </div>
                        
                        ${aiDiagnosis.analysis ? `
                            <p class="mb-2 small">${aiDiagnosis.analysis.substring(0, 150)}${aiDiagnosis.analysis.length > 150 ? '...' : ''}</p>
                        ` : ''}
                        
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">诊断ID: ${diagnosis.id}</small>
                            <a href="?diagnosis_id=${diagnosis.id}" class="btn btn-sm btn-outline-primary">
                                查看详情 <i class="fas fa-arrow-right ms-1"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 手动诊断
    async manualDiagnose() {
        const projectId = document.getElementById('projectSelect').value;
        const errorLog = document.getElementById('errorLog').value;
        const failedCommand = document.getElementById('failedCommandInput').value;
        
        if (!projectId) {
            this.showError('请选择项目');
            return;
        }
        
        if (!errorLog.trim()) {
            this.showError('请输入错误日志');
            return;
        }
        
        try {
            const btn = document.getElementById('manualDiagnoseBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>分析中...';
            btn.disabled = true;
            
            const response = await api.post('/api/ai/deploy-diagnose', {
                project_id: projectId,
                error_log: errorLog,
                command: failedCommand || 'unknown'
            });
            
            if (response.success && response.data) {
                this.showToast('诊断请求已提交，正在分析...', 'success');
                
                // 重定向到诊断详情页面
                setTimeout(() => {
                    window.location.href = `?diagnosis_id=${response.data.diagnosis_id}`;
                }, 1500);
            } else {
                this.showError(response.error || '诊断失败');
            }
        } catch (error) {
            console.error('手动诊断失败:', error);
            this.showError(`诊断失败: ${error.message}`);
        } finally {
            const btn = document.getElementById('manualDiagnoseBtn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-search me-2"></i>开始诊断';
                btn.disabled = false;
            }
        }
    }
    
    // 显示确认修复对话框
    async showConfirmFixModal() {
        if (this.fixCommands.length === 0) {
            this.showError('没有可执行的修复命令');
            return;
        }
        
        // 生成确认令牌
        try {
            const response = await api.post(`/api/ai/diagnosis/${this.currentDiagnosisId}/generate-token`, {
                commands: this.fixCommands
            });
            
            if (response.success && response.data) {
                this.confirmationToken = response.data.token;
            }
        } catch (error) {
            console.error('生成确认令牌失败:', error);
            this.showError('无法生成安全令牌');
            return;
        }
        
        // 渲染确认命令列表
        const container = document.getElementById('confirmCommandsList');
        if (container) {
            container.innerHTML = this.fixCommands.map((cmd, index) => `
                <div class="command-box mb-2">
                    <small class="text-muted d-block mb-1">命令 ${index + 1}</small>
                    <pre class="mb-0">${this.escapeHtml(cmd)}</pre>
                </div>
            `).join('');
        }
        
        // 重置确认复选框
        const confirmCheck = document.getElementById('confirmationCheck');
        const confirmFixBtn = document.getElementById('confirmFixBtn');
        if (confirmCheck && confirmFixBtn) {
            confirmCheck.checked = false;
            confirmFixBtn.disabled = true;
        }
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('confirmFixModal'));
        modal.show();
    }
    
    // 执行修复命令
    async executeFixCommands() {
        if (!this.confirmationToken || this.fixCommands.length === 0) {
            this.showError('缺少必要的确认信息');
            return;
        }
        
        // 显示进度区域
        document.getElementById('fixCommandsSection').classList.add('d-none');
        document.getElementById('fixProgressSection').classList.remove('d-none');
        
        try {
            const response = await api.post(`/api/ai/diagnosis/${this.currentDiagnosisId}/apply`, {
                confirmation_token: this.confirmationToken,
                commands: this.fixCommands
            });
            
            if (response.success) {
                this.monitorFixProgress(response.data);
            } else {
                this.showError(response.error || '执行修复失败');
                this.hideProgressSection();
            }
        } catch (error) {
            console.error('执行修复命令失败:', error);
            this.showError(`执行修复失败: ${error.message}`);
            this.hideProgressSection();
        }
    }
    
    // 监控修复进度
    monitorFixProgress(data) {
        const progressBar = document.getElementById('fixProgressBar');
        const progressText = document.getElementById('progressText');
        const progressPercent = document.getElementById('progressPercent');
        const logContainer = document.getElementById('executionLog');
        
        let currentProgress = 0;
        const totalCommands = data.total_commands || this.fixCommands.length;
        
        // 清空日志
        if (logContainer) {
            logContainer.innerHTML = '';
        }
        
        // 更新进度
        const updateProgress = (progress, message) => {
            currentProgress = progress;
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            if (progressPercent) {
                progressPercent.textContent = `${progress}%`;
            }
            if (progressText) {
                progressText.textContent = message;
            }
        };
        
        // 添加日志
        const addLog = (message, type = 'info') => {
            if (!logContainer) return;
            
            const logLine = document.createElement('div');
            logLine.className = `log-line log-${type}`;
            logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        };
        
        // 初始状态
        updateProgress(0, '准备执行修复命令...');
        addLog('开始执行修复命令', 'info');
        
        // 模拟进度更新（实际应该通过WebSocket或轮询获取实时状态）
        // 这里简化处理，每2秒更新一次
        const interval = setInterval(() => {
            if (currentProgress >= 100) {
                clearInterval(interval);
                
                // 等待一会儿然后刷新页面
                setTimeout(() => {
                    location.reload();
                }, 2000);
                return;
            }
            
            // 模拟进度
            const increment = 100 / totalCommands;
            currentProgress = Math.min(currentProgress + increment, 100);
            updateProgress(Math.floor(currentProgress), `执行命令中... (${Math.floor(currentProgress)}%)`);
            
            // 模拟日志
            if (currentProgress < 100) {
                const cmdIndex = Math.floor(currentProgress / increment);
                if (cmdIndex < this.fixCommands.length) {
                    addLog(`执行命令: ${this.fixCommands[cmdIndex].substring(0, 60)}...`, 'info');
                }
            }
        }, 2000);
        
        // 10秒后超时
        setTimeout(() => {
            if (currentProgress < 100) {
                clearInterval(interval);
                addLog('执行超时，请刷新页面查看结果', 'warning');
                updateProgress(100, '执行完成（可能超时）');
                
                setTimeout(() => {
                    location.reload();
                }, 3000);
            }
        }, 30000);
    }
    
    // 隐藏进度区域
    hideProgressSection() {
        document.getElementById('fixProgressSection').classList.add('d-none');
    }
    
    // 复制命令到剪贴板
    copyCommandsToClipboard() {
        if (this.fixCommands.length === 0) {
            this.showError('没有可复制的命令');
            return;
        }
        
        const commandsText = this.fixCommands.join('\n');
        this.copyToClipboard(commandsText);
        this.showToast('所有命令已复制到剪贴板', 'success');
    }
    
    // 重新部署项目
    redeployProject() {
        if (!this.currentProjectId) {
            this.showError('无法确定项目ID');
            return;
        }
        
        // 重定向到部署页面
        window.location.href = `/deploy.html?project_id=${this.currentProjectId}`;
    }
    
    // 查看诊断详情
    viewDiagnosisDetails() {
        // 当前已经在详情页面，可以刷新或显示更多信息
        location.reload();
    }
    
    // 连接WebSocket
    connectWebSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket连接成功');
            });
            
            this.socket.on('deployment_error', (data) => {
                if (data.projectId === this.currentProjectId) {
                    this.showToast('检测到新的部署错误，正在分析...', 'info');
                    // 可以自动刷新或显示通知
                }
            });
            
            this.socket.on('ai_diagnosis_ready', (data) => {
                if (data.diagnosisId === this.currentDiagnosisId) {
                    this.showToast('AI诊断完成！', 'success');
                    // 刷新页面显示新的诊断结果
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            });
            
        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }
    
    // 工具方法
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }
    
    showToast(message, type = 'info') {
        // 简单的toast实现
        const toast = document.createElement('div');
        toast.className = `position-fixed top-0 end-0 p-3`;
        toast.style.zIndex = '1050';
        
        toast.innerHTML = `
            <div class="toast show align-items-center text-bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    showError(message) {
        this.showToast(message, 'danger');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.aiDiagnose = new AIDiagnose();
});
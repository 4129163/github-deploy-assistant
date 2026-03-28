/**
 * GitHub Deploy Assistant (GADA) - 前端应用
 */

// 全局状态
const state = {
    currentProject: null,
    currentTab: 'home',
    aiAnalysis: null
};

// API 基础 URL
const API_BASE = '/api';

// ============================================
// 工具函数
// ============================================

function $(selector) {
    return document.querySelector(selector);
}

function show(el) {
    el.classList.remove('hidden');
}

function hide(el) {
    el.classList.add('hidden');
}

function showLoading(text = '处理中...') {
    const loading = $('#loading');
    loading.querySelector('p').textContent = text;
    show(loading);
}

function hideLoading() {
    hide($('#loading'));
}

async function api(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    
    return data;
}

// ============================================
// 标签切换
// ============================================

function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // 更新按钮状态
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新内容
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            $(`#${tab}`).classList.add('active');
            
            state.currentTab = tab;
            
            // 加载数据
            if (tab === 'projects') {
                loadProjects();
            } else if (tab === 'config') {
                loadAIStatus();
            }
        });
    });
}

// ============================================
// 仓库分析
// ============================================

async function analyzeRepository() {
    const url = $('#repoUrl').value.trim();
    
    if (!url) {
        alert('请输入 GitHub 仓库地址');
        return;
    }
    
    showLoading('正在分析仓库...');
    
    try {
        const result = await api('/repo/analyze', {
            method: 'POST',
            body: JSON.stringify({ url })
        });
        
        state.aiAnalysis = result.data;
        displayAnalysisResult(result.data);
        
    } catch (error) {
        alert(`分析失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayAnalysisResult(data) {
    const container = $('#analysisResult');
    const repoInfo = $('#repoInfo');
    
    // 显示基本信息
    repoInfo.innerHTML = `
        <div class="repo-info">
            <div class="repo-info-item">
                <span class="repo-info-label">📛 名称:</span>
                <span>${data.info.name}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">📝 描述:</span>
                <span>${data.info.description || '无描述'}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">🔧 类型:</span>
                <span>${data.types.join(', ')}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">⭐ Stars:</span>
                <span>${data.info.stars}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">🍴 Forks:</span>
                <span>${data.info.forks}</span>
            </div>
            <div class="repo-info-item">
                <span class="repo-info-label">🌿 分支:</span>
                <span>${data.info.defaultBranch}</span>
            </div>
        </div>
    `;
    
    show(container);
    show($('#deploymentOptions'));
    
    // 显示 AI 分析
    if (data.aiAnalysis) {
        const aiDiv = $('#aiAnalysis');
        aiDiv.querySelector('.ai-content').innerHTML = marked.parse(data.aiAnalysis);
        show(aiDiv);
    }
}

// ============================================
// 克隆仓库
// ============================================

async function cloneRepository() {
    if (!state.aiAnalysis) return;
    
    showLoading('正在克隆仓库...');
    
    try {
        const result = await api('/repo/clone', {
            method: 'POST',
            body: JSON.stringify({
                url: state.aiAnalysis.url,
                name: state.aiAnalysis.info.name,
                types: state.aiAnalysis.types,
                packageJson: state.aiAnalysis.packageJson,
                envExample: state.aiAnalysis.envExample
            })
        });
        
        state.currentProject = result.data;
        return result.data;
        
    } catch (error) {
        alert(`克隆失败: ${error.message}`);
        return null;
    } finally {
        hideLoading();
    }
}

// ============================================
// 手动模式 - 部署指南
// ============================================

async function startManualMode() {
    const project = await cloneRepository();
    if (!project) return;
    
    showLoading('正在生成部署指南...');
    
    try {
        const result = await api(`/deploy/guide/${project.id}`);
        
        hide($('#analysisResult'));
        hide($('#deploymentOptions'));
        
        const guideDiv = $('#manualGuide');
        $('#guideContent').innerHTML = marked.parse(result.data.guide);
        show(guideDiv);
        
    } catch (error) {
        alert(`生成指南失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// ============================================
// 自动模式 - 自动部署
// ============================================

async function startAutoMode() {
    const project = await cloneRepository();
    if (!project) return;
    
    hide($('#analysisResult'));
    hide($('#deploymentOptions'));
    show($('#autoDeploy'));
    
    const logsDiv = $('#deployLogs');
    logsDiv.innerHTML = '<div class="log-line log-info">🚀 开始自动部署...</div>';
    
    try {
        const result = await api(`/deploy/auto/${project.id}`, {
            method: 'POST'
        });
        
        if (result.success) {
            displayDeployResult(true, '部署成功！');
        } else {
            displayDeployResult(false, '部署失败，请查看日志');
        }
        
    } catch (error) {
        displayDeployResult(false, error.message);
    }
}

function displayDeployResult(success, message) {
    const resultDiv = $('#deployResult');
    resultDiv.innerHTML = `
        <div style="padding: 20px; background: ${success ? '#d1fae5' : '#fee2e2'}; border-radius: 8px; margin-top: 16px;">
            <h3>${success ? '✅' : '❌'} ${message}</h3>
            ${success ? '<p>项目已成功部署！</p>' : '<p>请查看上方日志了解详细错误信息</p>'}
        </div>
    `;
    show(resultDiv);
}

// ============================================
// AI 问答
// ============================================

function initChatModal() {
    const modal = $('#chatModal');
    
    $('#askAIBtn').addEventListener('click', () => {
        show(modal);
        loadChatHistory();
    });
    
    modal.querySelector('.close-btn').addEventListener('click', () => {
        hide(modal);
    });
    
    $('#sendChatBtn').addEventListener('click', sendChatMessage);
    $('#chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

async function loadChatHistory() {
    if (!state.currentProject) return;
    
    try {
        const result = await api(`/ai/conversations/${state.currentProject.id}`);
        const messagesDiv = $('#chatMessages');
        
        messagesDiv.innerHTML = result.data.map(msg => `
            <div class="chat-message ${msg.role}">
                ${msg.content}
            </div>
        `).join('');
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        console.error('Load chat history failed:', error);
    }
}

async function sendChatMessage() {
    const input = $('#chatInput');
    const message = input.value.trim();
    
    if (!message || !state.currentProject) return;
    
    input.value = '';
    
    // 显示用户消息
    const messagesDiv = $('#chatMessages');
    messagesDiv.innerHTML += `<div class="chat-message user">${message}</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // 显示加载
    messagesDiv.innerHTML += `<div class="chat-message assistant">思考中...</div>`;
    
    try {
        const result = await api(`/ai/ask/${state.currentProject.id}`, {
            method: 'POST',
            body: JSON.stringify({ question: message })
        });
        
        // 更新助手回复
        messagesDiv.lastElementChild.textContent = result.data.answer;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        messagesDiv.lastElementChild.textContent = `错误: ${error.message}`;
    }
}

// ============================================
// 项目列表
// ============================================

async function loadProjects() {
    try {
        const result = await api('/project/list');
        const container = $('#projectsList');
        
        if (result.data.length === 0) {
            container.innerHTML = '<p class="empty">暂无项目，请在首页添加</p>';
            return;
        }
        
        container.innerHTML = result.data.map(p => `
            <div class="project-item">
                <div class="info">
                    <h4>${p.name}</h4>
                    <p>${p.repo_url}</p>
                </div>
                <span class="status status-${p.status}">${p.status}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load projects failed:', error);
    }
}

// ============================================
// AI 配置
// ============================================

async function loadAIStatus() {
    try {
        const result = await api('/ai/status');
        const container = $('#aiStatus');
        
        container.innerHTML = Object.entries(result.data.providers).map(([key, info]) => `
            <div class="ai-status-item">
                <span class="status-dot ${info.configured ? 'configured' : 'not-configured'}"></span>
                <span>${info.name}: ${info.configured ? '已配置' : '未配置'}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load AI status failed:', error);
    }
}

async function parseAIConfig() {
    const text = $('#aiConfigText').value.trim();
    
    if (!text) {
        alert('请输入配置信息');
        return;
    }
    
    try {
        const result = await api('/ai/parse-config', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        
        const configs = result.data.configs;
        const container = $('#parsedConfigs');
        const list = $('#configsList');
        
        if (configs.length === 0) {
            list.innerHTML = '<p>未识别到有效的配置信息</p>';
        } else {
            list.innerHTML = configs.map(c => `
                <div class="ai-status-item">
                    <span class="status-dot configured"></span>
                    <span>${c.provider}: ${c.key.substring(0, 10)}...</span>
                </div>
            `).join('');
        }
        
        show(container);
        
    } catch (error) {
        alert(`解析失败: ${error.message}`);
    }
}

// ============================================
// 初始化
// ============================================

function init() {
    // 标签切换
    initTabs();
    
    // 分析按钮
    $('#analyzeBtn').addEventListener('click', analyzeRepository);
    
    // 部署模式按钮
    $('#manualModeBtn').addEventListener('click', startManualMode);
    $('#autoModeBtn').addEventListener('click', startAutoMode);
    
    // AI 问答
    initChatModal();
    
    // 配置解析
    $('#parseConfigBtn').addEventListener('click', parseAIConfig);
    
    console.log('🚀 GitHub Deploy Assistant initialized');
}

// 简单的 Markdown 解析器（替代 marked）
const marked = {
    parse: (text) => {
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>')
            .replace(/\n/g, '<br>');
    }
};

// 启动
document.addEventListener('DOMContentLoaded', init);

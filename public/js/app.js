/**
 * GADA - GitHub Deploy Assistant
 * 主前端逻辑
 */

const API = '/api';
const state = {
  currentProject: null,
  currentAnalysis: null,
  ws: null,
  deployLogLines: [],
  progressValue: 0
};

// ============================================
// 工具函数
// ============================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

async function api(url, opts = {}) {
  const res = await fetch(API + url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showLoading(text = '处理中...') {
  $('#loadingText').textContent = text;
  show($('#globalLoading'));
}
function hideLoading() { hide($('#globalLoading')); }

function showStep(id) {
  $$('.wizard-step').forEach(s => hide(s));
  show($('#' + id));
}

function appendLog(msg, level = 'info') {
  const el = $('#deployLog');
  if (!el) return;
  const line = document.createElement('span');
  line.className = 'log-line' + (level === 'error' ? ' log-error' : level === 'success' ? ' log-success' : '');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setProgress(pct, text) {
  const fill = $('#progressFill');
  if (fill) fill.style.width = pct + '%';
  const t = $('#progressText');
  if (t) t.textContent = text || '';
}

// ============================================
// 主题切换
// ============================================
function initTheme() {
  const btn = $('#themeToggle');
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

// ============================================
// Tab 切换
// ============================================
function initTabs() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab').forEach(t => { t.classList.remove('active'); hide(t); });
      const tab = $('#' + btn.dataset.tab);
      show(tab); tab.classList.add('active');
      if (btn.dataset.tab === 'projects') loadProjects();
      if (btn.dataset.tab === 'system') loadSystemStatus();
      if (btn.dataset.tab === 'ai') loadProviders();
    });
  });
}

// ============================================
// WebSocket
// ============================================
function initWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${proto}://${location.host}`);
  state.ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log') {
        const lvl = msg.data.message?.includes('错误') || msg.data.message?.includes('失败') ? 'error' : 'info';
        appendLog(msg.data.message, lvl);
        state.progressValue = Math.min(state.progressValue + 5, 90);
        setProgress(state.progressValue, msg.data.message);
      } else if (msg.type === 'deploy_done') {
        if (msg.data.success) {
          setProgress(100, '安装完成！');
          setTimeout(() => showDone(state.currentProject, '自动安装成功！'), 800);
        } else {
          setProgress(state.progressValue, '安装遇到问题，请查看日志');
        }
      }
    } catch (_) {}
  };
  state.ws.onclose = () => setTimeout(initWebSocket, 3000);
}

// ============================================
// 环境检测
// ============================================
async function loadSystemStatus() {
  try {
    const res = await api('/system/env');
    const env = res.data.env;
    const icons = { node: '🟢', npm: '📦', git: '🔀', python: '🐍', docker: '🐳' };
    const names = { node: 'Node.js', npm: 'npm', git: 'Git', python: 'Python', docker: 'Docker' };
    const container = $('#envChecks');
    container.innerHTML = Object.entries(env).map(([k, v]) => `
      <div class="env-card ${v.installed ? 'ok' : v.required ? 'missing' : 'optional'}">
        <div class="env-icon">${icons[k] || '⚙️'}</div>
        <div>
          <div class="env-name">${names[k] || k}</div>
          <div class="env-version">${v.installed ? v.version : (v.required ? '❌ 未安装（必需）' : '未安装（可选）')}</div>
          ${!v.installed ? `<div class="env-install"><a href="${v.installUrl}" target="_blank">点击下载安装</a></div>` : ''}
        </div>
      </div>`).join('');

    // 更新顶栏徽章
    const badge = $('#envBadge');
    if (res.data.ready) {
      badge.textContent = '环境就绪';
      badge.className = 'badge ok';
    } else {
      badge.textContent = '环境缺失';
      badge.className = 'badge error';
    }

    // 运行中进程
    const prRes = await api('/process');
    const pl = $('#runningProcesses');
    if (prRes.data.length === 0) {
      pl.innerHTML = '<p style="color:var(--text3)">暂无运行中的项目</p>';
    } else {
      pl.innerHTML = prRes.data.map(p => `
        <div class="process-item">
          <div class="process-info">
            <div class="process-dot"></div>
            <div>
              <div class="process-name">项目 #${p.projectId}</div>
              <div class="process-meta">PID: ${p.pid} · 端口: ${p.port} · ${p.status}</div>
            </div>
          </div>
          <div class="process-actions">
            <button class="btn btn-danger" onclick="stopProcess('${p.projectId}')">停止</button>
          </div>
        </div>`).join('');
    }
  } catch (err) {
    console.error('loadSystemStatus:', err);
  }
}

async function stopProcess(projectId) {
  try {
    await api(`/process/${projectId}/stop`, { method: 'POST' });
    loadSystemStatus();
  } catch (err) { alert('停止失败: ' + err.message); }
}

// ============================================
// 仓库分析
// ============================================
async function analyzeRepo() {
  const url = $('#repoUrl').value.trim();
  if (!url) { alert('请输入 GitHub 仓库地址'); return; }

  showStep('step-analyzing');
  $('#analyzingText').textContent = '正在读取仓库信息...';
  $('#analyzingSubtext').textContent = '连接 GitHub...';

  try {
    $('#analyzingSubtext').textContent = '分析项目结构和配置文件...';
    const res = await api('/repo/analyze', { method: 'POST', body: JSON.stringify({ url }) });
    state.currentAnalysis = res.data;
    showAnalysisResult(res.data);
  } catch (err) {
    showStep('step-input');
    alert('分析失败: ' + err.message);
  }
}

function showAnalysisResult(data) {
  $('#repoTitle').textContent = data.name || data.fullName || '未知项目';

  // 基本信息
  $('#repoMeta').innerHTML = `
    <div class="repo-meta-row">🔗 <strong>${data.fullName || ''}</strong></div>
    ${data.description ? `<div class="repo-meta-row">📝 ${data.description}</div>` : ''}
    ${data.language ? `<div class="repo-meta-row">💻 ${data.language}</div>` : ''}
    ${data.stars !== undefined ? `<div class="repo-meta-row">⭐ ${data.stars} stars · 🍴 ${data.forks} forks</div>` : ''}
  `;

  // 项目类型
  const types = data.types || [];
  $('#projectTypes').innerHTML = types.length
    ? types.map(t => `<span class="type-tag">${t}</span>`).join('')
    : '<span style="color:var(--text3)">未能识别项目类型</span>';

  // AI 分析
  if (data.aiAnalysis) {
    $('#aiAnalysisContent').innerHTML = marked.parse ? marked.parse(data.aiAnalysis) : data.aiAnalysis;
    show($('#aiAnalysisCard'));
  } else if (data.aiError) {
    $('#aiAnalysisContent').innerHTML = `<p style="color:var(--text3);font-size:.85rem">⚠️ ${data.aiError}</p>`;
    show($('#aiAnalysisCard'));
  }

  // README
  if (data.readme) {
    const content = $('#readmeContent');
    content.innerHTML = marked.parse ? marked.parse(data.readme) : data.readme;
    content.classList.add('open');
  }

  showStep('step-result');
}

// ============================================
// 部署
// ============================================
async function startAutoDeploy() {
  const analysis = state.currentAnalysis;
  if (!analysis) return;

  showLoading('正在克隆仓库...');
  try {
    // 克隆仓库
    const cloneRes = await api('/repo/clone', {
      method: 'POST',
      body: JSON.stringify({
        url: analysis.url || analysis.cloneUrl,
        name: analysis.name,
        types: analysis.types,
        packageJson: analysis.packageJson,
        envExample: analysis.envExample
      })
    });
    state.currentProject = cloneRes.data;
    hideLoading();

    // 开始部署
    state.deployLogLines = [];
    state.progressValue = 10;
    $('#deployLog').innerHTML = '';
    setProgress(10, '开始安装依赖...');
    showStep('step-deploying');

    const deployRes = await api(`/deploy/auto/${cloneRes.data.id}`, { method: 'POST' });
    if (deployRes.success) {
      setProgress(100, '安装完成！');
      setTimeout(() => showDone(cloneRes.data, '项目已成功安装！'), 800);
    } else {
      setProgress(state.progressValue, '安装遇到问题，请查看日志');
    }
  } catch (err) {
    hideLoading();
    alert('部署失败: ' + err.message);
    showStep('step-result');
  }
}

async function startManualMode() {
  const analysis = state.currentAnalysis;
  if (!analysis) return;

  showLoading('正在克隆仓库...');
  try {
    const cloneRes = await api('/repo/clone', {
      method: 'POST',
      body: JSON.stringify({
        url: analysis.url || analysis.cloneUrl,
        name: analysis.name,
        types: analysis.types
      })
    });
    state.currentProject = cloneRes.data;

    const guideRes = await api(`/deploy/guide/${cloneRes.data.id}`);
    hideLoading();

    $('#manualContent').innerHTML = marked.parse ? marked.parse(guideRes.data.guide) : guideRes.data.guide;
    showStep('step-manual');
  } catch (err) {
    hideLoading();
    alert('获取教程失败: ' + err.message);
  }
}

function showDone(project, msg) {
  $('#doneMessage').textContent = msg + (project?.name ? ` (${project.name})` : '');
  showStep('step-done');
}

// ============================================
// 项目列表
// ============================================
async function loadProjects() {
  try {
    const res = await api('/project');
    const q = ($('#projectSearch')?.value || '').toLowerCase();
    const list = res.data.filter(p => !q || p.name.toLowerCase().includes(q) || (p.repo_url || '').toLowerCase().includes(q));
    const container = $('#projectList');
    if (list.length === 0) {
      container.innerHTML = '<p style="color:var(--text3)">还没有安装任何项目</p>';
      return;
    }
    container.innerHTML = list.map(p => {
      const procRes = null; // 静态渲染，进程状态从系统页获取
      return `
      <div class="project-card">
        <div class="project-card-header">
          <div>
            <div class="project-name">${p.name}</div>
            <div class="project-url">${p.repo_url || ''}</div>
          </div>
          <span class="project-status status-${p.status}">${statusLabel(p.status)}</span>
        </div>
        <div class="project-card-footer">
          <button class="btn btn-primary" onclick="startProject(${p.id})">▶ 启动</button>
          <button class="btn btn-secondary" onclick="stopProject(${p.id})">⏹ 停止</button>
          <button class="btn btn-ghost" onclick="openChat(${p.id})">💬 问AI</button>
          <button class="btn btn-secondary" onclick="uninstallProject(${p.id}, '${p.name}')">🗑 卸载</button>
        </div>
      </div>`;
    }).join('');
  } catch (err) { console.error('loadProjects:', err); }
}

function statusLabel(s) {
  const map = { deployed: '已部署', running: '运行中', failed: '失败', cloned: '已克隆', stopped: '已停止', rolled_back: '已回滚' };
  return map[s] || s;
}

async function startProject(id) {
  try {
    showLoading('正在启动...');
    const res = await api(`/process/${id}/start`, { method: 'POST' });
    hideLoading();
    alert(res.message);
    loadProjects();
  } catch (err) { hideLoading(); alert('启动失败: ' + err.message); }
}

async function stopProject(id) {
  try {
    await api(`/process/${id}/stop`, { method: 'POST' });
    loadProjects();
  } catch (err) { alert('停止失败: ' + err.message); }
}

async function deleteProject(id) {
  if (!confirm('确认删除这个项目？')) return;
  try {
    await api(`/project/${id}`, { method: 'DELETE' });
    loadProjects();
  } catch (err) { alert('删除失败: ' + err.message); }
}

async function uninstallProject(id, name) {
  // 先获取卸载预览
  showLoading('分析卸载内容...');
  let preview;
  try {
    const res = await api(`/project/${id}/uninstall-preview`);
    preview = res.data;
    hideLoading();
  } catch (err) {
    hideLoading();
    alert('获取卸载信息失败: ' + err.message);
    return;
  }

  // 构建确认弹窗内容
  const itemList = preview.items.map(i => `• ${i.desc}${i.size ? ' (' + i.size + ')' : ''}`).join('\n');
  const msg = `确认卸载项目 "${name}"？\n\n将会删除：\n${itemList}\n\n占用空间合计: ${preview.totalSize}\n\n此操作不可恢复！`;

  if (!confirm(msg)) return;

  const keepBackups = preview.items.some(i => i.type === 'backups')
    ? confirm('是否保留备份文件？（点击「确定」保留，「取消」一并删除）')
    : false;

  showLoading('正在卸载...');
  try {
    const res = await api(`/project/${id}/uninstall`, {
      method: 'DELETE',
      body: JSON.stringify({ keepBackups, keepData: false })
    });
    hideLoading();
    const steps = res.data.results.map(r => `${r.success ? '✅' : '❌'} ${r.msg}`).join('\n');
    alert(`✅ ${res.message}\n\n${steps}`);
    loadProjects();
  } catch (err) {
    hideLoading();
    alert('卸载失败: ' + err.message);
  }
}

// ============================================
// AI 提供商管理
// ============================================
async function loadProviders() {
  try {
    const res = await api('/ai/providers');
    const container = $('#providerList');
    container.innerHTML = res.data.map(p => `
      <div class="provider-card">
        <div class="provider-header">
          <div class="provider-name">${p.name}</div>
          <span class="provider-status ${p.configured ? 'configured' : 'unconfigured'}">
            ${p.configured ? '✅ 已配置' : '未配置'}
          </span>
        </div>
        <div class="provider-model">默认模型: ${p.defaultModel}</div>
        <div class="provider-actions">
          ${!p.builtin ? `<button class="btn btn-danger" onclick="removeProvider('${p.key}')">删除</button>` : ''}
          <button class="btn btn-secondary" onclick="testProvider('${p.key}')">测试连接</button>
        </div>
      </div>`).join('');
  } catch (err) { console.error('loadProviders:', err); }
}

async function removeProvider(key) {
  if (!confirm(`确认删除提供商 "${key}"？`)) return;
  try {
    await api(`/ai/providers/${key}`, { method: 'DELETE' });
    loadProviders();
  } catch (err) { alert('删除失败: ' + err.message); }
}

async function testProvider(key) {
  showLoading('测试连接中...');
  try {
    const res = await api('/ai/providers/test', { method: 'POST', body: JSON.stringify({ key }) });
    hideLoading();
    alert('✅ ' + res.message + '\n\n回复: ' + res.data.response);
  } catch (err) { hideLoading(); alert('连接失败: ' + err.message); }
}

function initCustomProviderForm() {
  $('#addProviderBtn').addEventListener('click', () => show($('#customProviderForm')));
  $('#cancelProviderBtn').addEventListener('click', () => hide($('#customProviderForm')));
  $('#testProviderBtn').addEventListener('click', async () => {
    const key = $('#cpKey').value.trim();
    const baseURL = $('#cpUrl').value.trim();
    const apiKey = $('#cpKey2').value.trim();
    const defaultModel = $('#cpModel').value.trim();
    const res2 = $('#testResult');
    try {
      showLoading('测试中...');
      const r = await api('/ai/providers/test', { method: 'POST', body: JSON.stringify({ key: key || undefined, baseURL, apiKey, defaultModel }) });
      hideLoading();
      res2.className = 'test-result ok'; res2.textContent = '✅ ' + r.message; show(res2);
    } catch (err) { hideLoading(); res2.className = 'test-result error'; res2.textContent = '❌ ' + err.message; show(res2); }
  });
  $('#saveProviderBtn').addEventListener('click', async () => {
    try {
      const body = { key: $('#cpKey').value.trim(), name: $('#cpName').value.trim(), baseURL: $('#cpUrl').value.trim(), apiKey: $('#cpKey2').value.trim(), defaultModel: $('#cpModel').value.trim(), models: [$('#cpModel').value.trim()] };
      await api('/ai/providers', { method: 'POST', body: JSON.stringify(body) });
      hide($('#customProviderForm'));
      loadProviders();
    } catch (err) { alert('保存失败: ' + err.message); }
  });
}

// ============================================
// AI 对话
// ============================================
let chatProjectId = null;

function openChat(projectId) {
  chatProjectId = projectId;
  $('#chatMessages').innerHTML = '';
  show($('#chatModal'));
  $('#chatInput').focus();
}

function initChatModal() {
  $('#closeChatBtn').addEventListener('click', () => hide($('#chatModal')));
  $('#sendChatBtn').addEventListener('click', sendChat);
  $('#chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });
  $('#openChatBtn').addEventListener('click', () => openChat(state.currentProject?.id));
}

async function sendChat() {
  const input = $('#chatInput');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';

  const msgs = $('#chatMessages');
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user'; userMsg.textContent = q;
  msgs.appendChild(userMsg);

  try {
    let res;
    if (chatProjectId) {
      res = await api(`/ai/ask/${chatProjectId}`, { method: 'POST', body: JSON.stringify({ question: q }) });
    } else {
      res = await api('/ai/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: q }] }) });
    }
    const aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg assistant';
    aiMsg.innerHTML = marked.parse ? marked.parse(res.data.answer || res.data.response || '') : (res.data.answer || res.data.response || '');
    msgs.appendChild(aiMsg);
    msgs.scrollTop = msgs.scrollHeight;
  } catch (err) {
    const errMsg = document.createElement('div');
    errMsg.className = 'chat-msg assistant'; errMsg.textContent = '错误: ' + err.message;
    msgs.appendChild(errMsg);
  }
}

// ============================================
// README 折叠
// ============================================
function initReadmeToggle() {
  $('#readmeToggle').addEventListener('click', () => {
    const body = $('#readmeContent');
    const icon = $('#readmeToggle .toggle-icon');
    body.classList.toggle('open');
    icon.textContent = body.classList.contains('open') ? '▲' : '▼';
  });
}

// ============================================
// 初始化
// ============================================
function init() {
  initTheme();
  initTabs();
  initWebSocket();
  initChatModal();
  initCustomProviderForm();
  initReadmeToggle();

  $('#analyzeBtn').addEventListener('click', analyzeRepo);
  $('#repoUrl').addEventListener('keypress', e => { if (e.key === 'Enter') analyzeRepo(); });
  $('#backBtn').addEventListener('click', () => showStep('step-input'));
  $('#backFromManual').addEventListener('click', () => showStep('step-result'));
  $('#autoDeployBtn').addEventListener('click', startAutoDeploy);
  $('#manualDeployBtn').addEventListener('click', startManualMode);
  $('#deployAgainBtn').addEventListener('click', () => { showStep('step-input'); $('#repoUrl').value = ''; });
  $('#startProjectBtn').addEventListener('click', () => { if (state.currentProject) startProject(state.currentProject.id); });
  $('#viewProjectBtn').addEventListener('click', () => {
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    $('[data-tab="projects"]').classList.add('active');
    $$('.tab').forEach(t => { t.classList.remove('active'); hide(t); });
    show($('#projects')); $('#projects').classList.add('active');
    loadProjects();
  });
  $('#projectSearch').addEventListener('input', loadProjects);

  // 初始环境检测
  api('/system/env').then(res => {
    const badge = $('#envBadge');
    if (res.data.ready) { badge.textContent = '环境就绪'; badge.className = 'badge ok'; }
    else { badge.textContent = '环境缺失'; badge.className = 'badge warn'; }
  }).catch(() => {});

  console.log('🚀 GADA initialized');
}

document.addEventListener('DOMContentLoaded', init);

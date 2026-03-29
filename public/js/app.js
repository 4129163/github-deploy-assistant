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
      if (btn.dataset.tab === 'scan') { /* 手动点扫描按钮 */ }
    });
  });
}

// ============================================
// WebSocket
// ============================================
function initWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${proto}://${location.host}`);
  state.ws.onopen = () => {
    // 重连后，如果有正在部署的项目，重新订阅补发历史日志
    if (state.currentProject) {
      state.ws.send(JSON.stringify({ type: 'subscribe', projectId: String(state.currentProject.id) }));
    }
  };
  state.ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log') {
        const lvl = /错误|失败|error|Error/.test(msg.data.message) ? 'error'
          : /成功|完成|done/.test(msg.data.message) ? 'success' : 'info';
        appendLog(msg.data.message, lvl);
        state.progressValue = Math.min(state.progressValue + 5, 90);
        setProgress(state.progressValue, msg.data.message);
      } else if (msg.type === 'log_replay') {
        // 断线重连后补发历史日志
        const el = $('#deployLog');
        if (el) {
          el.innerHTML = '<span style="color:var(--text3);font-size:.8rem">[历史日志回放]</span>\n';
          msg.data.forEach(m => m.data?.message && appendLog(m.data.message, 'info'));
        }
      } else if (msg.type === 'deploy_done') {
        if (msg.data.success) {
          setProgress(100, '安装完成！');
          setTimeout(() => showDone(state.currentProject, '项目已成功安装！'), 800);
        } else {
          setProgress(state.progressValue, '安装遇到问题，请查看日志');
        }
      } else if (msg.type === 'process_started') {
        // 项目启动，前端更新端口显示
        appendLog(`▶ 进程已启动，端口: ${msg.data.port}，PID: ${msg.data.pid}`, 'success');
      } else if (msg.type === 'process_stopped') {
        appendLog(`⏹ 进程已停止 (exit code: ${msg.data.code})`, 'info');
      } else if (msg.type === 'process_error') {
        appendLog(`❌ 进程错误: ${msg.data.error}`, 'error');
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
  initQuickConfig();

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
  $('#scanBtn').addEventListener('click', runScan);

  // 初始环境检测
  api('/system/env').then(res => {
    const badge = $('#envBadge');
    if (res.data.ready) { badge.textContent = '环境就绪'; badge.className = 'badge ok'; }
    else { badge.textContent = '环境缺失'; badge.className = 'badge warn'; }
  }).catch(() => {});

  // 检测 AI 提供商是否配置
  api('/ai/providers').then(res => {
    const configured = (res.data || []).filter(p => p.configured);
    if (configured.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'ai-hint-banner';
      hint.innerHTML = `⚠️ 尚未配置 AI 提供商，AI 分析功能不可用。
        <a href="#" onclick="document.querySelector('[data-tab=ai]').click();return false;">前往「AI 设置」配置 API Key</a>`;
      document.querySelector('.main-content')?.prepend(hint);
    }
  }).catch(() => {});

  console.log('🚀 GADA initialized');
}

document.addEventListener('DOMContentLoaded', init);

// ============================================
// 扫描本地项目
// ============================================
async function runScan() {
  const btn = $('#scanBtn');
  btn.disabled = true;
  btn.textContent = '🔍 扫描中...';
  const statsEl = $('#scanStats');
  const listEl = $('#scanList');
  listEl.innerHTML = '<p style="color:var(--text3)">扫描中，请稍候...</p>';
  hide(statsEl);

  try {
    const res = await api('/scan');
    const { total, inDatabase, notInDatabase, projects } = res.data;

    // 统计卡片
    statsEl.innerHTML = `
      <div class="scan-stat"><div class="scan-stat-num">${total}</div><div class="scan-stat-label">发现项目</div></div>
      <div class="scan-stat"><div class="scan-stat-num" style="color:var(--success)">${inDatabase}</div><div class="scan-stat-label">已由 GADA 管理</div></div>
      <div class="scan-stat"><div class="scan-stat-num" style="color:var(--warning)">${notInDatabase}</div><div class="scan-stat-label">未管理（新发现）</div></div>
    `;
    show(statsEl);

    if (projects.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text3)">workspace 目录下没有发现任何项目</p>';
    } else {
      const typeIcons = { nodejs: '🟢', python: '🐍', docker: '🐳', go: '🔵', rust: '🦀', java: '☕', static: '🌐' };
      listEl.innerHTML = projects.map(p => `
        <div class="scan-card ${p.inDatabase ? 'in-db' : 'not-in-db'}">
          <div class="scan-card-header">
            <div>
              <div class="scan-name">${p.name}</div>
              <div class="scan-path">${p.path}</div>
            </div>
            <span class="scan-badge ${p.inDatabase ? 'managed' : 'unmanaged'}">
              ${p.inDatabase ? '✅ 已管理' : '⚠️ 未管理'}
            </span>
          </div>
          <div class="scan-tags">
            ${p.types.length ? p.types.map(t => `<span class="type-tag">${typeIcons[t] || '📦'} ${t}</span>`).join('') : '<span style="color:var(--text3);font-size:.82rem">未识别类型</span>'}
            ${p.hasGit ? '<span class="type-tag">🔀 Git</span>' : ''}
            ${p.hasNodeModules ? '<span class="type-tag">📦 node_modules</span>' : ''}
            ${p.hasVenv ? '<span class="type-tag">🐍 venv</span>' : ''}
          </div>
          ${p.pkgDesc ? `<div class="scan-meta">${p.pkgDesc}</div>` : ''}
          ${p.dbStatus ? `<div class="scan-meta">状态: ${p.dbStatus}</div>` : ''}
          <div class="scan-card-footer">
            ${!p.inDatabase ? `<button class="btn btn-primary" onclick="importProject('${p.name}', '${p.path}', ${JSON.stringify(p.types)})">📥 导入管理</button>` : ''}
            ${p.inDatabase ? `<button class="btn btn-secondary" onclick="uninstallProject(${p.dbId}, '${p.name}')">🗑 卸载</button>` : ''}
            ${!p.inDatabase ? `<button class="btn btn-danger" onclick="forceRemoveDir('${p.path}', '${p.name}')">🗑 直接删除</button>` : ''}
          </div>
        </div>`).join('');
    }
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--danger)">扫描失败: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 开始扫描';
  }
}

async function importProject(name, dirPath, types) {
  const repoUrl = prompt(`输入 "${name}" 的 GitHub 仓库地址（可选，直接按回车跳过）:`) || '';
  try {
    showLoading('导入中...');
    const res = await api('/scan/import', { method: 'POST', body: JSON.stringify({ name, dirPath, types, repoUrl }) });
    hideLoading();
    alert('✅ ' + res.message);
    runScan();
  } catch (err) { hideLoading(); alert('导入失败: ' + err.message); }
}

async function forceRemoveDir(dirPath, name) {
  if (!confirm(`直接删除目录 "${name}"？\n路径: ${dirPath}\n\n注意：此操作不可恢复，且不会停止进程！`)) return;
  try {
    showLoading('删除中...');
    await api('/scan/remove', { method: 'DELETE', body: JSON.stringify({ dirPath }) });
    hideLoading();
    alert(`✅ "${name}" 已删除`);
    runScan();
  } catch (err) { hideLoading(); alert('删除失败: ' + err.message); }
}

// ============================================
// 一键粘贴 AI 配置
// ============================================
function initQuickConfig() {
  const btn = $('#quickConfigBtn');
  const clearBtn = $('#quickConfigClearBtn');
  const textarea = $('#quickConfigText');
  const result = $('#quickConfigResult');

  if (!btn) return;

  clearBtn.addEventListener('click', () => {
    textarea.value = '';
    hide(result);
    textarea.focus();
  });

  btn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }

    btn.disabled = true;
    btn.textContent = '识别中...';
    hide(result);

    try {
      const res = await api('/ai/quick-config', { method: 'POST', body: JSON.stringify({ text }) });
      show(result);

      if (res.success) {
        result.className = 'quick-config-result ok';
        const items = res.data.results.map(r =>
          `<div class="result-item">${r.success ? '✅' : '❌'} <strong>${r.name}</strong>${r.model ? ' · ' + r.model : ''}${r.baseURL ? '<br><span style="font-size:.78rem;opacity:.7">' + r.baseURL + '</span>' : ''}</div>`
        ).join('');
        result.innerHTML = `<strong>${res.message}</strong><br><br>${items}<br><div style="font-size:.8rem;opacity:.7">配置已立即生效。重新粘贴新 Key 会自动覆盖，无需手动删除旧配置。</div>`;
        textarea.value = '';
        // 刷新提供商列表
        setTimeout(loadProviders, 500);
        // 移除 AI 未配置横幅
        document.querySelector('.ai-hint-banner')?.remove();
      } else {
        result.className = 'quick-config-result error';
        result.innerHTML = `<strong>${res.error || '识别失败'}</strong><br><br>支持格式：<ul style="margin:.5rem 0 0 1rem;font-size:.82rem"><li>纯 Key：sk-xxx</li><li>含地址：baseURL: https://xxx.com/v1<br>apiKey: sk-xxx</li><li>JSON 格式</li><li>直接粘贴中转站说明文字</li></ul>`;
      }
    } catch (err) {
      show(result);
      result.className = 'quick-config-result error';
      result.innerHTML = `❌ ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = '⚡ 识别并应用';
    }
  });

  // 支持 Ctrl+Enter 快捷键触发
  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btn.click();
  });
}

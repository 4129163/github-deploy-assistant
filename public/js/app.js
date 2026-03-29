// ===== Toast 通知系统 =====
function toast(msg, type = 'info', duration = 3000) {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  tc.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, duration);
}

function copyLog() {
  const log = document.getElementById('deployLog');
  if (!log) return;
  navigator.clipboard.writeText(log.innerText).then(() => toast('日志已复制', 'ok')).catch(() => toast('复制失败', 'err'));
}

function copyDoneUrl() {
  const link = document.getElementById('doneUrlLink');
  if (!link) return;
  navigator.clipboard.writeText(link.href).then(() => toast('地址已复制', 'ok')).catch(() => toast('复制失败', 'err'));
}

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
      } else if (msg.type === 'health_alert') {
        // 健康检查失败告警
        const note = `⚠️ 项目 ${msg.data.projectId} 健康检查失败 (${msg.data.error})`;
        console.warn(note);
        // 如果当前在项目列表页，刷新状态
        if ($('#projects')?.classList.contains('active')) loadProjects();
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
  } catch (err) { toast('停止失败: ' + err.message, 'err'); }
}

// ============================================
// 仓库分析
// ============================================
async function analyzeRepo() {
  const url = $('#repoUrl').value.trim();
  if (!url) { toast('请输入 GitHub 仓库地址', 'err'); return; }

  showStep('step-analyzing');
  // 分析步骤动画
  const steps = ['astep-fetch', 'astep-detect', 'astep-ai'];
  steps.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('active','done'); } });
  function setStep(idx) {
    steps.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active','done');
      if (i < idx) el.classList.add('done');
      else if (i === idx) el.classList.add('active');
    });
  }
  setStep(0);
  $('#analyzingText').textContent = '正在读取仓库信息...';
  $('#analyzingSubtext').textContent = '连接 GitHub...';

  try {
    setStep(1);
    $('#analyzingText').textContent = '分析项目结构...';
    $('#analyzingSubtext').textContent = '检测语言、框架、依赖';
    const res = await api('/repo/analyze', { method: 'POST', body: JSON.stringify({ url }) });
    setStep(2);
    $('#analyzingText').textContent = 'AI 智能分析中...';
    $('#analyzingSubtext').textContent = '生成部署方案';
    state.currentAnalysis = res.data;
    showAnalysisResult(res.data);
  } catch (err) {
    showStep('step-input');
    toast('分析失败: ' + err.message, 'err');
  }
}

function showAnalysisResult(data) {
  $('#repoTitle').textContent = data.name || data.fullName || '未知项目';
  // 更新类型 badge
  const typeBadge = $('#repoTypeBadge');
  if (typeBadge) {
    const types = data.projectTypes || [];
    typeBadge.textContent = types.length ? types.join(' · ') : '';
    typeBadge.style.display = types.length ? '' : 'none';
  }

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
    toast('部署失败: ' + err.message, 'err');
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
    toast('获取教程失败: ' + err.message, 'err');
  }
}

function showDone(project, msg) {
  $('#doneMessage').textContent = msg + (project?.name ? ` (${project.name})` : '');
  // 显示访问地址
  const urlSection = $('#doneAccessUrl');
  const urlLink = $('#doneUrlLink');
  if (urlSection && urlLink && project?.port) {
    const url = `http://localhost:${project.port}`;
    urlLink.href = url;
    urlLink.textContent = url;
    urlSection.classList.remove('hidden');
  } else if (urlSection) {
    urlSection.classList.add('hidden');
  }
  showStep('step-done');
}

// ============================================
// 项目列表
// ============================================
async function loadProjects() {
  try {
    const res = await api('/project');
    const q = ($('#projectSearch')?.value || '').toLowerCase();
    const statusFilter = $('#projectFilter')?.value || '';
    const list = res.data.filter(p => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.repo_url || '').toLowerCase().includes(q);
      const matchS = !statusFilter || p.status === statusFilter;
      return matchQ && matchS;
    });
    const container = $('#projectList');
    if (list.length === 0) {
      container.innerHTML = '<p style="color:var(--text3)">还没有安装任何项目</p>';
      return;
    }
    container.innerHTML = list.map(p => {
      const isFailed = ['failed'].includes(p.status);
      const tags = (p.tags || '').split(',').filter(Boolean);
      return `
      <div class="project-card">
        <div class="project-card-header">
          <div style="flex:1;min-width:0">
            <div class="project-name">${p.name}</div>
            <div class="project-url">${p.repo_url || ''}</div>
            ${tags.length ? `<div class="project-tags">${tags.map(t => `<span class="project-tag">${t}</span>`).join('')}</div>` : ''}
            ${p.notes ? `<div class="project-notes">${p.notes}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.35rem;flex-shrink:0">
            <span class="project-status status-${p.status}">${statusLabel(p.status)}</span>
            <button class="btn btn-ghost" style="font-size:.75rem;padding:.1rem .4rem" onclick="editProjectMeta(${p.id},'${p.name.replace(/'/g,"\\'")}')">✏️ 备注</button>
          </div>
        </div>
        <div class="project-card-footer">
          <button class="btn btn-primary" onclick="startProject(${p.id})">▶ 启动</button>
          <button class="btn btn-secondary" onclick="stopProject(${p.id})">⏹ 停止</button>
          ${isFailed ? `<button class="btn btn-secondary" onclick="retryDeploy(${p.id})">🔄 重试</button>` : ''}
          <button class="btn btn-ghost" onclick="pullProject(${p.id})">⬇️ 更新</button>
          <button class="btn btn-ghost" onclick="openChat(${p.id})">💬 问AI</button>
          <button class="btn btn-secondary" onclick="uninstallProject(${p.id}, '${p.name.replace(/'/g,"\\'")}')">🗑 卸载</button>
          ${p.port ? `<a href="http://localhost:${p.port}" target="_blank" class="btn btn-primary" style="font-size:.78rem">🌐 打开</a>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (err) { console.error('loadProjects:', err); }
  // 更新侧边栏项目计数
  try {
    const all = await api('/project/list');
    const cnt = (all.data || []).length;
    const badge = $('#projectCountBadge');
    const label = $('#projectsTotalLabel');
    if (badge) { if (cnt > 0) { badge.textContent = cnt; badge.style.display = 'flex'; } else badge.style.display = 'none'; }
    if (label) label.textContent = `共 ${cnt} 个`;
  } catch (_) {}
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
    toast(res.message, 'info');
    loadProjects();
  } catch (err) { hideLoading(); toast('启动失败: ' + err.message, 'err'); }
}

async function stopProject(id) {
  try {
    await api(`/process/${id}/stop`, { method: 'POST' });
    loadProjects();
  } catch (err) { toast('停止失败: ' + err.message, 'err'); }
}

async function deleteProject(id) {
  if (!confirm('确认删除这个项目？')) return;
  try {
    await api(`/project/${id}`, { method: 'DELETE' });
    loadProjects();
  } catch (err) { toast('删除失败: ' + err.message, 'err'); }
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
    toast('获取卸载信息失败: ' + err.message, 'err');
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
    toast(`✅ ${res.message}\n\n${steps}`, 'info');
    loadProjects();
  } catch (err) {
    hideLoading();
    toast('卸载失败: ' + err.message, 'err');
  }
}

// ============================================
// AI 提供商管理
// ============================================
async function loadProviders() {
  try {
    const [res, defRes] = await Promise.all([
      api('/ai/providers'),
      api('/ai/providers/default').catch(() => ({ data: { default: 'openai' } }))
    ]);
    const currentDefault = defRes.data.default;
    const container = $('#providerList');
    const providers = res.data;
    if (providers.length === 0) {
      container.innerHTML = '<p style="color:var(--text3)">暂无提供商</p>';
      return;
    }
    // 已配置的显示在前，未配置的折叠
    const configured = providers.filter(p => p.configured);
    const unconfigured = providers.filter(p => !p.configured);

    const renderCard = (p) => {
      const isDefault = p.key === currentDefault || p.key === currentDefault + '_override';
      return `
      <div class="provider-card ${isDefault ? 'provider-default' : ''} ${!p.configured ? 'provider-unconfigured' : ''}">
        <div class="provider-card-top">
          <div class="provider-left">
            <div class="provider-name">${p.name}</div>
            <div class="provider-model">${p.defaultModel || '未设置模型'}</div>
            ${p.baseURL ? `<div class="provider-url">${p.baseURL}</div>` : ''}
          </div>
          <div class="provider-right">
            ${isDefault ? '<span class="provider-badge default">⚡ 使用中</span>' : `<button class="btn btn-ghost provider-set-default" onclick="setDefaultProvider('${p.key}')">设为默认</button>`}
            ${!p.builtin ? `<button class="provider-delete-btn" title="删除" onclick="removeProvider('${p.key}')">✕</button>` : ''}
          </div>
        </div>
        <div class="provider-footer">
          <span class="provider-status-dot ${p.configured ? 'dot-ok' : 'dot-no'}"></span>
          <span style="font-size:.8rem;color:var(--text2)">${p.configured ? '已配置 API Key' : '未配置 API Key'}</span>
          <button class="btn btn-ghost" style="margin-left:auto;font-size:.8rem" onclick="testProvider('${p.key}')">🔗 测试</button>
        </div>
      </div>`;
    };

    // 已配置在前，未配置折叠在「更多提供商」
    let html = configured.map(renderCard).join('');
    if (unconfigured.length > 0) {
      html += `<div class="unconfigured-section">
        <details>
          <summary style="cursor:pointer;color:var(--text2);font-size:.85rem;padding:.5rem 0">▶ 更多可用提供商（${unconfigured.length} 个未配置）</summary>
          <div class="provider-grid" style="margin-top:.75rem">${unconfigured.map(renderCard).join('')}</div>
        </details>
      </div>`;
    }
    if (!html) html = '<p style="color:var(--text3)">暂无已配置的提供商，请在上方粘贴 API Key</p>';
    container.innerHTML = html;
  } catch (err) { console.error('loadProviders:', err); }
}

async function setDefaultProvider(key) {
  try {
    await api('/ai/providers/default', { method: 'POST', body: JSON.stringify({ key }) });
    loadProviders();
  } catch (err) { toast('切换失败: ' + err.message, 'err'); }
}

async function removeProvider(key) {
  if (!confirm(`确认删除提供商？删除后需重新配置才能使用。`)) return;
  try {
    await api(`/ai/providers/${key}`, { method: 'DELETE' });
    loadProviders();
  } catch (err) { toast('删除失败: ' + err.message, 'err'); }
}

async function testProvider(key) {
  showLoading('测试连接中...');
  try {
    const res = await api('/ai/providers/test', { method: 'POST', body: JSON.stringify({ key }) });
    hideLoading();
    toast('✅ ' + res.message + '\n\n回复: ' + res.data.response, 'info');
  } catch (err) { hideLoading(); toast('连接失败: ' + err.message, 'err'); }
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
    } catch (err) { toast('保存失败: ' + err.message, 'err'); }
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
  const _pf = $('#projectFilter');
  if (_pf) _pf.addEventListener('change', loadProjects);
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
    // 更新侧边栏 AI 状态指示点
    const dot = $('#aiStatusDot');
    if (dot) dot.style.background = configured.length > 0 ? 'var(--success)' : 'var(--warning)';
    if (configured.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'ai-hint-banner';
      hint.innerHTML = `⚠️ 尚未配置 AI 提供商，AI 分析功能不可用。
        <a href="#" onclick="document.querySelector('[data-tab=ai]').click();return false;">前往「AI 设置」配置 API Key</a>`;
      document.querySelector('.main-content')?.prepend(hint);
    }
  }).catch(() => {});

  // 快捷示例点击
  document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.dataset.url;
      const input = $('#repoUrl');
      if (input) { input.value = url; input.focus(); updateClearBtn(); }
    });
  });

  // URL 清除按钮
  function updateClearBtn() {
    const input = $('#repoUrl');
    const btn = $('#clearUrlBtn');
    if (!input || !btn) return;
    if (input.value.trim()) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }
  $('#repoUrl').addEventListener('input', updateClearBtn);
  const _clearBtn = $('#clearUrlBtn');
  if (_clearBtn) _clearBtn.addEventListener('click', () => {
    $('#repoUrl').value = ''; updateClearBtn(); $('#repoUrl').focus();
  });

  // 清除对话历史按钮
  const _clearChat = $('#clearChatBtn');
  if (_clearChat) _clearChat.addEventListener('click', async () => {
    if (!state.currentProject) return;
    if (!confirm('清除本项目的全部对话历史？')) return;
    try {
      await api(`/ai/conversations/${state.currentProject.id}`, { method: 'DELETE' });
      document.getElementById('chatMessages').innerHTML = '';
      toast('对话历史已清除', 'ok');
    } catch (err) { toast('清除失败: ' + err.message, 'err'); }
  });

  // 加载近期项目（首页展示）
  loadRecentProjects();

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
    toast('✅ ' + res.message, 'info');
    runScan();
  } catch (err) { hideLoading(); toast('导入失败: ' + err.message, 'err'); }
}

async function forceRemoveDir(dirPath, name) {
  if (!confirm(`直接删除目录 "${name}"？\n路径: ${dirPath}\n\n注意：此操作不可恢复，且不会停止进程！`)) return;
  try {
    showLoading('删除中...');
    await api('/scan/remove', { method: 'DELETE', body: JSON.stringify({ dirPath }) });
    hideLoading();
    toast(`✅ "${name}" 已删除`, 'info');
    runScan();
  } catch (err) { hideLoading(); toast('删除失败: ' + err.message, 'err'); }
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

// ============================================
// Fix 10: 重试部署
// ============================================
async function retryDeploy(id) {
  if (!confirm('重新尝试部署这个项目？')) return;
  state.deployLogLines = [];
  state.progressValue = 10;
  const el = $('#deployLog');
  if (el) el.innerHTML = '';
  setProgress(10, '重试部署中...');
  showStep('step-deploying');
  try {
    const res = await api(`/deploy/retry/${id}`, { method: 'POST' });
    if (res.success) {
      setProgress(100, '重试成功！');
      setTimeout(() => showDone({ id }, '项目重新部署成功！'), 800);
    } else {
      setProgress(state.progressValue, '重试失败，请查看日志');
    }
  } catch (err) {
    setProgress(state.progressValue, '重试出错: ' + err.message);
  }
}

// ============================================
// Fix 11: 项目备注/标签编辑
// ============================================
async function editProjectMeta(id, name) {
  const notes = prompt(`为「${name}」添加备注（可留空）:`) ?? null;
  if (notes === null) return; // 取消
  const tags = prompt('添加标签（多个用逗号分隔，如: AI,Python,好用）:') ?? '';
  try {
    await api(`/project/${id}`, { method: 'PUT', body: JSON.stringify({ notes, tags }) });
    loadProjects();
  } catch (err) { toast('保存失败: ' + err.message, 'err'); }
}

// ============================================
// Fix 12: 前端健康状态展示（系统页轮询）
// ============================================
async function loadHealthStatus() {
  try {
    const res = await api('/system/health');
    const statuses = res.data;
    // 给系统页的进程列表更新健康状态
    Object.entries(statuses).forEach(([pid, s]) => {
      const el = document.querySelector(`[data-project-id="${pid}"] .health-status`);
      if (!el) return;
      el.textContent = s.status === 'healthy' ? `✅ ${s.latency}ms` : s.status === 'unhealthy' ? '❌ 不健康' : '⏳ 检查中';
    });
  } catch (_) {}
}

// WebSocket 接收健康告警
// (已在 initWebSocket onmessage 中处理 health_alert)

// ============================================
// Fix 11: Git Pull 更新项目
// ============================================
async function pullProject(id) {
  if (!confirm('拉取最新代码？这会用 git pull 更新项目文件，不会影响运行中的进程。')) return;
  state.deployLogLines = [];
  state.progressValue = 20;
  const el = $('#deployLog');
  if (el) el.innerHTML = '';
  setProgress(20, '拉取最新代码...');
  showStep('step-deploying');
  try {
    const res = await api(`/deploy/pull/${id}`, { method: 'POST' });
    setProgress(100, res.message || '更新完成');
    setTimeout(() => {
      showStep('step-done');
      $('#doneMessage').textContent = res.message || '代码已更新到最新版本';
    }, 800);
  } catch (err) {
    setProgress(state.progressValue, '更新失败: ' + err.message);
    appendLog('❌ ' + err.message, 'error');
  }
}


// ============================================
// 首页近期项目
// ============================================
async function loadRecentProjects() {
  try {
    const res = await api('/project');
    const projects = (res.data || []).slice(0, 5);
    const section = document.getElementById('recentProjectsSection');
    const list = document.getElementById('recentProjectsList');
    if (!section || !list || projects.length === 0) return;
    list.innerHTML = projects.map(p => `
      <div class="recent-item" onclick="quickLaunch(${p.id})">
        <span style="font-size:1.1rem">${p.status === 'running' ? '🟢' : p.status === 'failed' ? '🔴' : '⚪'}</span>
        <span class="recent-item-name">${p.name}</span>
        <span class="recent-item-status status-${p.status}">${statusLabel(p.status)}</span>
        <span style="color:var(--text3);font-size:.8rem">→</span>
      </div>
    `).join('');
    section.classList.remove('hidden');
  } catch (_) {}
}

async function quickLaunch(id) {
  // 切换到项目管理页
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="projects"]').classList.add('active');
  $$('.tab').forEach(t => { t.classList.remove('active'); hide(t); });
  show($('#projects')); $('#projects').classList.add('active');
  await loadProjects();
}

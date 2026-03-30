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

// ============================================
// 全身自检
// ============================================
async function runSelfCheck() {
  const btn = $('#selfCheckBtn');
  const panel = $('#selfCheckPanel');
  const resultEl = $('#selfCheckResult');
  const summaryEl = $('#selfCheckSummary');

  btn.disabled = true;
  btn.textContent = '⏳ 检查中...';
  show(panel);
  resultEl.innerHTML = '<div style="color:var(--text3);padding:1rem">正在执行全身自检，请稍候...</div>';
  summaryEl.textContent = '';

  try {
    const res = await api('/selfcheck');
    const { results, summary } = res.data;

    const statusIcon = { PASS: '✅', WARN: '⚠️', FAIL: '❌', FIXED: '🔧' };
    const statusColor = { PASS: 'var(--green,#22c55e)', WARN: 'var(--yellow,#eab308)', FAIL: 'var(--red,#ef4444)', FIXED: 'var(--blue,#3b82f6)' };

    // 按模块分组
    const groups = {};
    for (const r of results) {
      if (!groups[r.module]) groups[r.module] = [];
      groups[r.module].push(r);
    }

    let html = '';
    for (const [mod, items] of Object.entries(groups)) {
      const modFail = items.filter(i => i.status === 'FAIL').length;
      const modWarn = items.filter(i => i.status === 'WARN').length;
      const modFixed = items.filter(i => i.status === 'FIXED').length;
      const modBadge = modFail > 0 ? `<span style="color:#ef4444;font-size:.75rem">❌ ${modFail} 失败</span>`
        : modWarn > 0 ? `<span style="color:#eab308;font-size:.75rem">⚠️ ${modWarn} 警告</span>`
        : modFixed > 0 ? `<span style="color:#3b82f6;font-size:.75rem">🔧 ${modFixed} 已修复</span>`
        : `<span style="color:#22c55e;font-size:.75rem">全部通过</span>`;
      html += `<div style="margin-bottom:1rem;background:var(--card-bg,#1e1e2e);border-radius:.75rem;overflow:hidden">`;
      html += `<div style="padding:.6rem 1rem;background:var(--sidebar-bg,#181825);display:flex;justify-content:space-between;align-items:center">`;
      html += `<span style="font-weight:600;font-size:.9rem">${mod}</span>${modBadge}</div>`;
      html += `<div style="padding:.5rem 0">`;
      for (const item of items) {
        const icon = statusIcon[item.status] || '';
        const color = statusColor[item.status] || 'inherit';
        html += `<div style="display:flex;gap:.75rem;padding:.35rem 1rem;font-size:.85rem">`;
        html += `<span style="width:1.5rem;text-align:center">${icon}</span>`;
        html += `<span style="min-width:180px;color:var(--text2)">${item.item}</span>`;
        html += `<span style="color:${color};flex:1">${item.detail || ''}</span>`;
        if (item.fix) html += `<span style="color:var(--text3);font-size:.8rem">${item.fix}</span>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    }
    resultEl.innerHTML = html;

    const allOk = summary.failed === 0 && summary.warned === 0;
    summaryEl.innerHTML = `<span style="color:#22c55e">✅ ${summary.passed}</span>　`
      + (summary.warned > 0 ? `<span style="color:#eab308">⚠️ ${summary.warned}</span>　` : '')
      + (summary.failed > 0 ? `<span style="color:#ef4444">❌ ${summary.failed}</span>　` : '')
      + (summary.fixed > 0 ? `<span style="color:#3b82f6">🔧 ${summary.fixed}</span>　` : '')
      + `<span style="color:var(--text3)">共 ${summary.total} 项</span>`;

    if (allOk) {
      toast('🩺 全身自检通过，系统状态正常', 'ok');
    } else if (summary.failed > 0) {
      toast(`🩺 自检发现 ${summary.failed} 个问题，请查看报告`, 'err');
    } else {
      toast(`🩺 自检完成，${summary.warned} 个警告，${summary.fixed} 个已自动修复`, 'warn');
    }
  } catch (err) {
    resultEl.innerHTML = `<div style="color:#ef4444;padding:1rem">自检失败: ${err.message}</div>`;
    toast('自检请求失败: ' + err.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '🩺 全身自检';
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
          <button class="btn btn-ghost" id="updateBtn_${p.id}" onclick="checkAndUpdate(${p.id}, '${p.name.replace(/'/g,"\\'")}')">🔔 检测更新</button>
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
  $('#selfCheckBtn').addEventListener('click', runSelfCheck);
  const _refreshSystem = $('#refreshSystemBtn');
  if (_refreshSystem) _refreshSystem.addEventListener('click', loadSystemStatus);

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
  initRecommend();
  // search tab init happens on tab switch
  document.querySelector('[data-tab="search"]').addEventListener('click', () => {
    if (!window._searchInited) { initSearch(); window._searchInited = true; }
  });
  document.querySelector('[data-tab="device"]').addEventListener('click', () => {
    if (!window._deviceInited) { initDevice(); window._deviceInited = true; }
  });
  document.querySelector('[data-tab="software"]').addEventListener('click', () => {
    if (!window._softwareInited) { initSoftware(); window._softwareInited = true; }
  });

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

// 检测更新并弹窗确认
async function checkAndUpdate(id, name) {
  const btn = $(`#updateBtn_${id}`);
  if (btn) { btn.disabled = true; btn.textContent = '检测中...'; }
  try {
    const res = await api(`/deploy/check-update/${id}`);
    const d = res.data;
    if (btn) { btn.disabled = false; btn.textContent = d.has_update ? '⬆️ 有新版本' : '✅ 已最新'; }
    if (!d.has_update) {
      toast(`「${name}」已是最新版本（${d.local_commit?.hash || ''}）`, 'ok');
      return;
    }
    // 构建更新日志
    const changes = (d.recent_changes || []).map(c =>
      `• [${c.hash}] ${c.message} — ${c.author} (${new Date(c.date).toLocaleDateString('zh-CN')})`
    ).join('\n');
    const msg = `「${name}」有 ${d.commits_behind} 个新提交可以更新：\n\n${changes}\n\n当前版本：${d.local_commit?.hash} ${d.local_commit?.message}\n最新版本：${d.remote_commit?.hash} ${d.remote_commit?.message}\n\n是否立即更新？（会自动检测是否需要重装依赖）`;
    if (!confirm(msg)) return;
    // 执行更新
    if (btn) { btn.disabled = true; btn.textContent = '更新中...'; }
    showUpdateModal(id, name);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔔 检测更新'; }
    toast('检测失败: ' + err.message, 'err');
  }
}

async function showUpdateModal(id, name) {
  // 跳转到部署日志视图并执行更新
  state.deployLogLines = [];
  state.progressValue = 10;
  const el = $('#deployLog');
  if (el) el.innerHTML = '';
  setProgress(10, `正在更新「${name}」...`);
  showStep('step-deploying');
  try {
    const res = await api(`/deploy/update/${id}`, { method: 'POST', body: JSON.stringify({ reinstall: false }) });
    setProgress(100, res.message || '更新完成');
    setTimeout(() => {
      showStep('step-done');
      $('#doneMessage').textContent = `✅ ${res.message || '已更新到最新版本'}${res.data?.deps_updated ? '，依赖已重新安装' : ''}`;
      loadProjects();
    }, 800);
  } catch (err) {
    setProgress(state.progressValue, '更新失败');
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

// ============================================
// 项目推荐
// ============================================
const RECOMMEND_DATA = {
  hot: [
    { name: 'ollama', desc: '本地运行大语言模型，支持 Llama/Mistral 等', url: 'https://github.com/ollama/ollama', stars: '80k+', lang: 'Go' },
    { name: 'stable-diffusion-webui', desc: 'AI 图片生成神器，本地运行 SD 模型', url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', stars: '140k+', lang: 'Python' },
    { name: 'ChatGPT-Next-Web', desc: '一键部署私人 ChatGPT 网页应用', url: 'https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web', stars: '75k+', lang: 'TypeScript' },
    { name: 'lobe-chat', desc: '开源现代化 AI 聊天框架，支持多模型', url: 'https://github.com/lobehub/lobe-chat', stars: '45k+', lang: 'TypeScript' },
    { name: 'gpt4free', desc: '免费使用各种 AI 模型的聚合接口', url: 'https://github.com/xtekky/gpt4free', stars: '62k+', lang: 'Python' },
    { name: 'Langchain-Chatchat', desc: '基于 LangChain 的本地知识库问答', url: 'https://github.com/chatchat-space/Langchain-Chatchat', stars: '32k+', lang: 'Python' },
    { name: 'open-webui', desc: 'Ollama 的好看前端，像 ChatGPT 一样用本地模型', url: 'https://github.com/open-webui/open-webui', stars: '45k+', lang: 'Svelte' },
    { name: 'vaultwarden', desc: '轻量级自托管密码管理器 Bitwarden 服务端', url: 'https://github.com/dani-garcia/vaultwarden', stars: '38k+', lang: 'Rust' },
    { name: 'n8n', desc: '可视化工作流自动化工具，自托管 Zapier', url: 'https://github.com/n8n-io/n8n', stars: '48k+', lang: 'TypeScript' },
    { name: 'immich', desc: '自托管照片视频备份管理，替代 Google Photos', url: 'https://github.com/immich-app/immich', stars: '50k+', lang: 'TypeScript' },
  ],
  fun: [
    { name: 'shan-shui-inf', desc: '用算法生成无限水墨山水画', url: 'https://github.com/LingDong-/shan-shui-inf', stars: '5k+', lang: 'JavaScript' },
    { name: 'cmatrix', desc: '终端里跑「黑客帝国」数字瀑布动画', url: 'https://github.com/abishekvashok/cmatrix', stars: '4k+', lang: 'C' },
    { name: 'gameboy.live', desc: '在浏览器里直接玩 GameBoy 游戏，支持联机', url: 'https://github.com/HFO4/gameboy.live', stars: '4k+', lang: 'Go' },
    { name: 'rembg', desc: 'AI 一键抠图，完全本地运行', url: 'https://github.com/danielgatis/rembg', stars: '16k+', lang: 'Python' },
    { name: 'musicn', desc: '命令行下载高品质音乐', url: 'https://github.com/zonemeen/musicn', stars: '4k+', lang: 'JavaScript' },
    { name: 'OpenVoice', desc: 'AI 声音克隆，复刻任意人声', url: 'https://github.com/myshell-ai/OpenVoice', stars: '29k+', lang: 'Python' },
    { name: 'bark', desc: 'AI 文字转超真实语音，支持大笑/哭泣等情绪', url: 'https://github.com/suno-ai/bark', stars: '36k+', lang: 'Python' },
    { name: 'LLaVA', desc: '给 AI 看图说话，本地多模态大模型', url: 'https://github.com/haotian-liu/LLaVA', stars: '20k+', lang: 'Python' },
    { name: 'screenshot-to-code', desc: '截图变代码，粘贴设计稿直接生成网页', url: 'https://github.com/abi/screenshot-to-code', stars: '57k+', lang: 'Python' },
    { name: 'ComfyUI', desc: 'SD 最强节点式工作流界面，玩法无限', url: 'https://github.com/comfyanonymous/ComfyUI', stars: '55k+', lang: 'Python' },
  ],
  tool: [
    { name: 'FileBrowser', desc: '网页版文件管理器，自托管私有网盘', url: 'https://github.com/filebrowser/filebrowser', stars: '26k+', lang: 'Go' },
    { name: 'uptime-kuma', desc: '好看的自托管服务监控面板', url: 'https://github.com/louislam/uptime-kuma', stars: '55k+', lang: 'JavaScript' },
    { name: 'photoprism', desc: 'AI 驱动的私人相册，自动分类整理', url: 'https://github.com/photoprism/photoprism', stars: '35k+', lang: 'Go' },
    { name: 'Stirling-PDF', desc: '自托管 PDF 全能处理工具', url: 'https://github.com/Stirling-Tools/Stirling-PDF', stars: '46k+', lang: 'Java' },
    { name: 'glances', desc: '跨平台系统监控工具，支持网页查看', url: 'https://github.com/nicolargo/glances', stars: '26k+', lang: 'Python' },
    { name: 'homer', desc: '简洁的自托管服务导航首页', url: 'https://github.com/bastienwirtz/homer', stars: '9k+', lang: 'Vue' },
    { name: 'linkding', desc: '极简自托管书签管理器', url: 'https://github.com/sissbruecker/linkding', stars: '6k+', lang: 'Python' },
    { name: 'memos', desc: '轻量自托管碎片笔记，像 Twitter 一样记录想法', url: 'https://github.com/usememos/memos', stars: '30k+', lang: 'Go' },
    { name: 'Docmost', desc: '开源 Notion 替代品，自托管团队 Wiki', url: 'https://github.com/docmost/docmost', stars: '10k+', lang: 'TypeScript' },
    { name: 'actual', desc: '自托管个人财务记账软件', url: 'https://github.com/actualbudget/actual', stars: '15k+', lang: 'JavaScript' },
  ],
  ai: [
    { name: 'LocalAI', desc: '本地运行 AI 模型的 OpenAI 兼容 API', url: 'https://github.com/mudler/LocalAI', stars: '23k+', lang: 'Go' },
    { name: 'text-generation-webui', desc: '本地大模型聊天 WebUI，支持几乎所有模型格式', url: 'https://github.com/oobabooga/text-generation-webui', stars: '40k+', lang: 'Python' },
    { name: 'llama.cpp', desc: 'CPU 上跑大模型，量化推理极致优化', url: 'https://github.com/ggerganov/llama.cpp', stars: '65k+', lang: 'C++' },
    { name: 'privateGPT', desc: '本地知识库问答，100% 离线，数据不出门', url: 'https://github.com/zylon-ai/private-gpt', stars: '53k+', lang: 'Python' },
    { name: 'AnythingLLM', desc: '一站式本地 AI 知识库管理工具', url: 'https://github.com/Mintplex-Labs/anything-llm', stars: '25k+', lang: 'JavaScript' },
    { name: 'Flowise', desc: '拖拽式构建 AI 工作流，零代码搭 LLM 应用', url: 'https://github.com/FlowiseAI/Flowise', stars: '32k+', lang: 'JavaScript' },
    { name: 'Dify', desc: '开源 LLM 应用开发平台，快速构建 AI 产品', url: 'https://github.com/langgenius/dify', stars: '55k+', lang: 'Python' },
    { name: 'SillyTavern', desc: 'AI 角色扮演聊天前端，支持各种本地/云端模型', url: 'https://github.com/SillyTavern/SillyTavern', stars: '9k+', lang: 'JavaScript' },
    { name: 'Jan', desc: '桌面端本地 AI 助手，像 ChatGPT 一样好用', url: 'https://github.com/janhq/jan', stars: '23k+', lang: 'TypeScript' },
    { name: 'MaxKB', desc: '基于大模型的知识库问答系统，开箱即用', url: 'https://github.com/1Panel-dev/MaxKB', stars: '12k+', lang: 'Python' },
  ],
};

let currentRecCat = 'hot';
let recShuffleOffset = 0;
const REC_PAGE_SIZE = 6;

function renderRecommend() {
  const list = $('#recommendList');
  if (!list) return;
  const all = RECOMMEND_DATA[currentRecCat] || [];
  const start = (recShuffleOffset * REC_PAGE_SIZE) % all.length;
  const items = [];
  for (let i = 0; i < REC_PAGE_SIZE; i++) {
    items.push(all[(start + i) % all.length]);
  }
  const langColor = { Python:'#3572A5', JavaScript:'#f1e05a', TypeScript:'#2b7489', Go:'#00ADD8', Rust:'#dea584', 'C++':'#f34b7d', C:'#555555', Java:'#b07219', Svelte:'#ff3e00', Vue:'#41b883' };
  list.innerHTML = items.map(p => `
    <div class="rec-card" onclick="fillUrl('${p.url}')" title="点击填入地址">
      <div class="rec-top">
        <span class="rec-name">${p.name}</span>
        <span class="rec-stars">⭐ ${p.stars}</span>
      </div>
      <div class="rec-desc">${p.desc}</div>
      <div class="rec-footer">
        <span class="rec-lang" style="background:${langColor[p.lang] || '#555'}22;color:${langColor[p.lang] || '#888'}">${p.lang}</span>
        <span class="rec-action">点击部署 →</span>
      </div>
    </div>`).join('');
}

function fillUrl(url) {
  const input = $('#repoUrl');
  if (!input) return;
  input.value = url;
  input.focus();
  const btn = $('#clearUrlBtn');
  if (btn) btn.classList.remove('hidden');
  toast('已填入地址，点击「开始分析」部署', 'ok');
}

function initRecommend() {
  renderRecommend();
  $$('.rec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.rec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRecCat = btn.dataset.cat;
      recShuffleOffset = 0;
      renderRecommend();
    });
  });
  const shuffleBtn = $('#recShuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    recShuffleOffset++;
    renderRecommend();
  });
}
// ============================================
// 自然语言搜索
// ============================================
let currentSearchId = null;
let currentSearchRepos = [];
let filteredRepos = [];

async function initSearch() {
  $('#searchSubmitBtn').addEventListener('click', doSearch);
  $('#searchQuery').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
  document.querySelectorAll('.search-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $('#searchQuery').value = chip.dataset.q;
      doSearch();
    });
  });
  $('#filterType').addEventListener('change', applyFilters);
  $('#filterLang').addEventListener('change', applyFilters);
  $('#filterPlatform').addEventListener('change', applyFilters);
  $('#filterActivity').addEventListener('change', applyFilters);
  $('#filterMaturity').addEventListener('change', applyFilters);
  $('#filterResetBtn').addEventListener('click', resetFilters);
  $('#exportCsvBtn').addEventListener('click', () => exportSearch('csv'));
  $('#exportMdBtn').addEventListener('click', () => exportSearch('md'));
  $('#saveRecordBtn').addEventListener('click', saveSearchRecord);
  $('#refreshHistoryBtn').addEventListener('click', loadSearchHistory);
  loadSearchHistory();
}

async function doSearch() {
  const query = $('#searchQuery').value.trim();
  if (!query) { toast('请输入搜索内容', 'warn'); return; }
  const loading = $('#searchLoading');
  const result = $('#searchResult');
  show(loading); hide(result);
  const btn = $('#searchSubmitBtn');
  btn.disabled = true; btn.textContent = '搜索中...';
  try {
    const res = await api('/search/query', {
      method: 'POST',
      body: JSON.stringify({ query, maxResults: 20 }),
    });
    const data = res.data;
    currentSearchId = data.id;
    currentSearchRepos = data.repos || [];
    filteredRepos = [...currentSearchRepos];
    $('#searchSummary').innerHTML = `<p>${data.summary || ''}</p>`;
    $('#searchRecommendation').innerHTML = data.recommendation
      ? `<div class="search-rec-box"><span class="search-rec-label">🏆 智能推荐</span>${data.recommendation}</div>` : '';
    buildFilterOptions(currentSearchRepos);
    renderSearchTable(filteredRepos);
    hide(loading); show(result);
    loadSearchHistory();
    toast('搜索完成，共 ' + currentSearchRepos.length + ' 个结果', 'ok');
  } catch (err) {
    hide(loading);
    toast('搜索失败: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🔍 搜索';
  }
}

function buildFilterOptions(repos) {
  const types = [...new Set(repos.map(r => r.category_type).filter(Boolean))];
  const langs = [...new Set(repos.map(r => r.tech_stack || r.language).filter(Boolean))];
  const platforms = [...new Set(repos.flatMap(r => (r.platform_support || '').split('/').map(p => p.trim())).filter(Boolean))];
  const activities = [...new Set(repos.map(r => r.activity).filter(Boolean))];
  const maturities = [...new Set(repos.map(r => r.maturity).filter(Boolean))];
  const fill = (id, opts, label) => {
    const el = $(id); const cur = el.value;
    el.innerHTML = `<option value="">全部${label}</option>` + opts.map(o => `<option value="${o}">${o}</option>`).join('');
    if (opts.includes(cur)) el.value = cur;
  };
  fill('#filterType', types, '类型');
  fill('#filterLang', langs, '语言');
  fill('#filterPlatform', platforms, '平台');
  fill('#filterActivity', activities, '活跃度');
  fill('#filterMaturity', maturities, '成熟度');
}

function applyFilters() {
  const type = $('#filterType').value;
  const lang = $('#filterLang').value;
  const platform = $('#filterPlatform').value;
  const activity = $('#filterActivity').value;
  const maturity = $('#filterMaturity').value;
  filteredRepos = currentSearchRepos.filter(r => {
    if (type && r.category_type !== type) return false;
    if (lang && (r.tech_stack || r.language) !== lang) return false;
    if (platform && !(r.platform_support || '').includes(platform)) return false;
    if (activity && r.activity !== activity) return false;
    if (maturity && r.maturity !== maturity) return false;
    return true;
  });
  renderSearchTable(filteredRepos);
}

function resetFilters() {
  ['#filterType','#filterLang','#filterPlatform','#filterActivity','#filterMaturity'].forEach(id => $(id).value = '');
  filteredRepos = [...currentSearchRepos];
  renderSearchTable(filteredRepos);
}

const actColor = { '活跃':'#22c55e', '维护中':'#eab308', '停滞/归档':'#ef4444' };
const matBadge = { '生产可用':'✅', '实验性/个人项目':'🧪' };

function renderSearchTable(repos) {
  const tbody = $('#searchTableBody');
  if (!tbody) return;
  if (repos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:2rem">暂无匹配结果</td></tr>';
    return;
  }
  tbody.innerHTML = repos.map((r, i) => `
    <tr>
      <td style="color:var(--text3)">${i+1}</td>
      <td><a href="${r.url}" target="_blank" class="search-link">${r.name}</a></td>
      <td style="white-space:nowrap">⭐ ${r.stars.toLocaleString()}</td>
      <td>${r.tech_stack || r.language || '-'}</td>
      <td><span class="tag">${r.category_type || '-'}</span></td>
      <td style="font-size:.8rem">${r.platform_support || '-'}</td>
      <td><span style="color:${actColor[r.activity]||'inherit'};font-size:.8rem">${r.activity || '-'}</span></td>
      <td style="font-size:.8rem">${r.scenario || '-'}</td>
      <td style="font-size:.8rem">${matBadge[r.maturity] || ''} ${r.maturity || '-'}</td>
      <td class="search-desc" title="${r.description}">${(r.description||'').slice(0,50)}${r.description&&r.description.length>50?'...':''}</td>
      <td><button class="btn btn-primary btn-sm" onclick="deployFromSearch('${r.url}')">部署</button></td>
    </tr>`).join('');
}

function deployFromSearch(url) {
  document.querySelector('[data-tab="home"]').click();
  setTimeout(() => { $('#repoUrl').value = url; $('#analyzeBtn').click(); }, 200);
}

async function exportSearch(fmt) {
  if (!currentSearchId) { toast('暂无搜索结果', 'warn'); return; }
  try {
    const url = `/api/search/export/${currentSearchId}?fmt=${fmt}`;
    const a = document.createElement('a');
    a.href = url; a.download = `search_${currentSearchId}.${fmt === 'csv' ? 'csv' : 'md'}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('导出成功', 'ok');
  } catch (err) { toast('导出失败: ' + err.message, 'err'); }
}

function saveSearchRecord() {
  if (!currentSearchId) { toast('暂无搜索结果', 'warn'); return; }
  toast('记录已自动保存到 search-records/ 目录', 'ok');
}

async function loadSearchHistory() {
  const list = $('#searchHistoryList');
  if (!list) return;
  try {
    const res = await api('/search/history');
    const items = res.data || [];
    if (items.length === 0) {
      list.innerHTML = '<p style="color:var(--text3);font-size:.85rem">暂无搜索历史</p>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="history-item">
        <div class="history-item-main" onclick="loadHistoryRecord(${item.id})">
          <span class="history-query">${item.query}</span>
          <span class="history-meta">${item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}</span>
        </div>
        <div class="history-item-actions">
          <a href="/api/search/export/${item.id}?fmt=csv" download class="btn btn-ghost btn-sm">CSV</a>
          <a href="/api/search/export/${item.id}?fmt=md" download class="btn btn-ghost btn-sm">MD</a>
          <button class="btn btn-danger btn-sm" onclick="deleteHistoryRecord(${item.id})">删除</button>
        </div>
        ${item.save_path ? `<div class="history-save-path">💾 已保存至：${item.save_path}</div>` : ''}
      </div>`).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:var(--text3);font-size:.85rem">加载历史失败</p>';
  }
}

async function loadHistoryRecord(id) {
  try {
    const res = await api('/search/history/' + id);
    const data = res.data;
    currentSearchId = data.id;
    currentSearchRepos = data.repos || [];
    filteredRepos = [...currentSearchRepos];
    $('#searchQuery').value = data.query || '';
    $('#searchSummary').innerHTML = `<p>${data.summary || ''}</p>`;
    $('#searchRecommendation').innerHTML = data.recommendation
      ? `<div class="search-rec-box"><span class="search-rec-label">🏆 智能推荐</span>${data.recommendation}</div>` : '';
    buildFilterOptions(currentSearchRepos);
    renderSearchTable(filteredRepos);
    show($('#searchResult'));
    toast('已加载历史记录', 'ok');
  } catch (err) { toast('加载失败: ' + err.message, 'err'); }
}

async function deleteHistoryRecord(id) {
  if (!confirm('确定删除这条搜索记录？')) return;
  try {
    await api('/search/history/' + id, { method: 'DELETE' });
    toast('已删除', 'ok');
    loadSearchHistory();
  } catch (err) { toast('删除失败: ' + err.message, 'err'); }
}
// ============================================
// 设备状态扫描
// ============================================
let deviceScanData = null;

function initDevice() {
  $('#deviceScanBtn').addEventListener('click', () => doDeviceScan(false));
  $('#deviceScanWithSpeedBtn').addEventListener('click', () => doDeviceScan(true));
  $('#deviceSpeedBtn').addEventListener('click', doSpeedTest);
}

async function doDeviceScan(withSpeed) {
  const loading = $('#deviceLoading');
  const result = $('#deviceResult');
  const placeholder = $('#devicePlaceholder');
  const loadingText = $('#deviceLoadingText');

  loadingText.textContent = withSpeed ? '正在扫描设备并测速（测速约需10秒）...' : '正在扫描设备，请稍候...';
  show(loading); hide(result); hide(placeholder);
  ['#deviceScanBtn','#deviceScanWithSpeedBtn','#deviceSpeedBtn'].forEach(id => $(id).disabled = true);

  try {
    const res = await api('/device/scan' + (withSpeed ? '?speed=1' : ''));
    deviceScanData = res.data;
    renderDeviceScan(deviceScanData);
    hide(loading); show(result);
    toast('扫描完成，耗时 ' + deviceScanData.scan_duration_ms + 'ms', 'ok');
  } catch (err) {
    hide(loading); show(placeholder);
    toast('扫描失败: ' + err.message, 'err');
  } finally {
    ['#deviceScanBtn','#deviceScanWithSpeedBtn','#deviceSpeedBtn'].forEach(id => $(id).disabled = false);
  }
}

async function doSpeedTest() {
  const btn = $('#deviceSpeedBtn');
  btn.disabled = true; btn.textContent = '测速中...';
  try {
    const res = await api('/device/speedtest');
    const d = res.data;
    const msg = d.download_mbps ? `下载: ${d.download_mbps} Mbps` : '';
    const lat = d.latency_ms ? `延迟: ${d.latency_ms}ms` : '';
    toast('测速完成 — ' + [msg, lat].filter(Boolean).join(' | '), 'ok');
    if (deviceScanData) {
      deviceScanData.network_speed = d;
      renderNetworkSpeed(d);
    }
  } catch (err) {
    toast('测速失败: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '⚡ 测速';
  }
}

function renderDeviceScan(data) {
  renderDeviceTips(data.optimization_tips || []);
  renderDeviceOverview(data);
  renderDeviceDetails(data);
}

function renderDeviceTips(tips) {
  const el = $('#deviceTips');
  if (!tips.length) { el.innerHTML = ''; return; }
  const levelColor = { error:'#ef4444', warn:'#eab308', info:'#3b82f6', ok:'#22c55e' };
  const levelIcon = { error:'❌', warn:'⚠️', info:'ℹ️', ok:'✅' };
  el.innerHTML = `<div class="device-tips">${tips.map(t =>
    `<div class="device-tip" style="border-left:3px solid ${levelColor[t.level]||'#888'}">
      <span>${levelIcon[t.level]||'•'}</span>
      <span>${t.message}</span>
    </div>`).join('')}</div>`;
}

function pct(v) {
  const color = v >= 90 ? '#ef4444' : v >= 75 ? '#eab308' : '#22c55e';
  return `<div class="device-pct-bar"><div class="device-pct-fill" style="width:${v}%;background:${color}"></div></div><span style="color:${color};font-weight:700">${v}%</span>`;
}

function renderDeviceOverview(data) {
  const el = $('#deviceOverview');
  const s = data.system || {};
  const cpu = data.cpu || {};
  const mem = data.memory || {};
  const disk = (data.disk?.disks || [])[0] || {};
  const net = data.network || {};
  const spd = data.network_speed || {};

  el.innerHTML = `
    <div class="dov-card">
      <div class="dov-icon">🖥️</div>
      <div class="dov-title">系统</div>
      <div class="dov-val">${s.os || '-'}</div>
      <div class="dov-sub">${s.virtualization || ''} · 运行 ${s.uptime || '-'}</div>
    </div>
    <div class="dov-card">
      <div class="dov-icon">⚙️</div>
      <div class="dov-title">CPU</div>
      <div class="dov-val">${cpu.cores || '-'} 核心</div>
      <div class="dov-sub">${pct(cpu.usage_percent || 0)} 使用率</div>
      <div class="dov-sub">负载 ${cpu.load_1m || 0} / ${cpu.load_5m || 0} / ${cpu.load_15m || 0}</div>
    </div>
    <div class="dov-card">
      <div class="dov-icon">🧠</div>
      <div class="dov-title">内存</div>
      <div class="dov-val">${mem.total || '-'}</div>
      <div class="dov-sub">${pct(mem.used_percent || 0)} 已用 ${mem.used || '-'}</div>
      <div class="dov-sub">可用 ${mem.available || '-'}</div>
    </div>
    <div class="dov-card">
      <div class="dov-icon">💾</div>
      <div class="dov-title">磁盘</div>
      <div class="dov-val">${disk.total || '-'}</div>
      <div class="dov-sub">${pct(disk.used_percent || 0)} 已用 ${disk.used || '-'}</div>
      <div class="dov-sub">挂载点 ${disk.mount || '-'}</div>
    </div>
    <div class="dov-card">
      <div class="dov-icon">🌐</div>
      <div class="dov-title">网络</div>
      <div class="dov-val">${net.public_ip || '-'}</div>
      <div class="dov-sub">${(net.interfaces||[]).map(i=>i.address).filter(Boolean).join(' / ')}</div>
      <div class="dov-sub">DNS: ${(net.dns_servers||[]).join(', ')||'-'}</div>
    </div>
    <div class="dov-card" id="speedCard">
      <div class="dov-icon">⚡</div>
      <div class="dov-title">网速</div>
      ${renderNetworkSpeedHTML(spd)}
    </div>`;
}

function renderNetworkSpeedHTML(spd) {
  if (spd.status === 'skipped') return `<div class="dov-val" style="font-size:.85rem">未测试</div><div class="dov-sub">点击「⚡ 测速」</div>`;
  if (spd.status === 'ok') return `<div class="dov-val">${spd.download_mbps ? spd.download_mbps + ' Mbps' : '-'}</div><div class="dov-sub">延迟 ${spd.latency_ms || '-'} ms</div>`;
  return `<div class="dov-val" style="color:#eab308">测速中/失败</div>`;
}

function renderNetworkSpeed(spd) {
  const card = $('#speedCard');
  if (card) card.innerHTML = `<div class="dov-icon">⚡</div><div class="dov-title">网速</div>${renderNetworkSpeedHTML(spd)}`;
}

function renderDeviceDetails(data) {
  const el = $('#deviceDetails');
  const sections = [];

  // 系统详情
  const s = data.system || {};
  sections.push(detailSection('🖥️ 系统详情', [
    ['主机名', s.hostname],['操作系统', s.os],['内核版本', s.kernel],
    ['架构', s.arch],['虚拟化', s.virtualization],
    ['Node.js', s.node_version],['启动时间', s.boot_time],['运行时长', s.uptime],
  ]));

  // CPU
  const cpu = data.cpu || {};
  sections.push(detailSection('⚙️ CPU 详情', [
    ['型号', cpu.model],['核心数', cpu.cores],['主频', cpu.speed_mhz ? cpu.speed_mhz + ' MHz' : '-'],
    ['当前使用率', cpu.usage_percent + '%'],['温度', cpu.temperature],
    ['1分钟负载', cpu.load_1m],['5分钟负载', cpu.load_5m],['15分钟负载', cpu.load_15m],
  ]));

  // 内存
  const mem = data.memory || {};
  sections.push(detailSection('🧠 内存详情', [
    ['总内存', mem.total],['已使用', mem.used + ' (' + mem.used_percent + '%)'],
    ['可用', mem.available],['缓存/缓冲', mem.buff_cache],
    ['Swap总量', mem.swap_total],['Swap已用', mem.swap_used + ' (' + mem.swap_percent + '%)'],
  ]));

  // 磁盘
  const disks = data.disk?.disks || [];
  sections.push(`<div class="detail-section">
    <div class="detail-title">💾 磁盘详情</div>
    <div class="detail-body">
      <table class="search-table"><thead><tr><th>挂载点</th><th>总量</th><th>已用</th><th>可用</th><th>使用率</th></tr></thead>
      <tbody>${disks.map(d => `<tr><td>${d.mount}</td><td>${d.total}</td><td>${d.used}</td><td>${d.available}</td><td>${pct(d.used_percent)}</td></tr>`).join('')}</tbody>
      </table>
    </div></div>`);

  // 网络
  const net = data.network || {};
  const traffic = net.traffic || [];
  sections.push(`<div class="detail-section">
    <div class="detail-title">🌐 网络详情</div>
    <div class="detail-body">
      <table class="search-table"><thead><tr><th>接口</th><th>接收</th><th>接收包</th><th>发送</th><th>发送包</th></tr></thead>
      <tbody>${traffic.map(t => `<tr><td>${t.interface}</td><td>${t.rx_bytes}</td><td>${t.rx_packets}</td><td>${t.tx_bytes}</td><td>${t.tx_packets}</td></tr>`).join('')}</tbody>
      </table>
    </div></div>`);

  // Top 进程
  const procs = data.processes || {};
  sections.push(`<div class="detail-section">
    <div class="detail-title">📊 进程 Top 10（CPU）<span style="float:right;font-size:.8rem;color:var(--text3)">总进程: ${procs.total_processes || 0}</span></div>
    <div class="detail-body">
      <table class="search-table"><thead><tr><th>PID</th><th>CPU</th><th>内存</th><th>命令</th></tr></thead>
      <tbody>${(procs.top_cpu||[]).map(p => `<tr><td>${p.pid}</td><td>${p.cpu}</td><td>${p.mem}</td><td style="font-size:.8rem;color:var(--text3)">${p.command}</td></tr>`).join('')}</tbody>
      </table>
    </div></div>`);

  // 环境
  const env = data.env || {};
  const envRows = Object.entries(env).map(([k, v]) => [
    k, v.installed ? ('✅ ' + (v.version||'').split('\n')[0]) : '❌ 未安装'
  ]);
  sections.push(detailSection('🛠️ 环境工具', envRows));

  // 安全
  const sec = data.security || {};
  sections.push(detailSection('🔒 安全信息', [
    ['防火墙', sec.firewall],
    ['开放端口', (sec.open_ports||[]).join(', ') || '无'],
    ['最近登录', (sec.last_logins||[]).join(' | ')],
  ]));

  el.innerHTML = sections.join('');
}

function detailSection(title, rows) {
  return `<div class="detail-section">
    <div class="detail-title">${title}</div>
    <div class="detail-body">
      <table class="detail-table">
        <tbody>${rows.map(([k,v]) => `<tr><td class="dk">${k}</td><td class="dv">${v||'-'}</td></tr>`).join('')}</tbody>
      </table>
    </div></div>`;
}
// ============================================
// 软件管理
// ============================================
let softwareData = null;
let currentSwTab = 'env';

function initSoftware() {
  $('#softwareScanBtn').addEventListener('click', doSoftwareScan);
  $('#selfUninstallBtn').addEventListener('click', doSelfUninstall);
  $('#softwareSearch').addEventListener('input', renderSoftwareList);
  $$('.sw-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.sw-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSwTab = btn.dataset.sw;
      renderSoftwareList();
    });
  });
}

async function doSoftwareScan() {
  const loading = $('#softwareLoading');
  const result = $('#softwareResult');
  const placeholder = $('#softwarePlaceholder');
  show(loading); hide(result); hide(placeholder);
  $('#softwareScanBtn').disabled = true;
  $('#softwareScanBtn').textContent = '扫描中...';
  try {
    const res = await api('/software/scan');
    softwareData = res.data;
    renderSoftwareSummary(softwareData);
    renderSoftwareList();
    hide(loading); show(result);
    toast('扫描完成，耗时 ' + softwareData.scan_duration_ms + 'ms', 'ok');
  } catch (err) {
    hide(loading); show(placeholder);
    toast('扫描失败: ' + err.message, 'err');
  } finally {
    $('#softwareScanBtn').disabled = false;
    $('#softwareScanBtn').textContent = '🔍 一键扫描';
  }
}

function renderSoftwareSummary(data) {
  const s = data.summary;
  $('#softwareSummary').innerHTML = `
    <div class="software-summary-cards">
      <div class="sw-sum-card" onclick="switchSwTab('env')"><div class="sw-sum-num">${s.env_tools}</div><div class="sw-sum-label">🛠️ 开发环境工具</div></div>
      <div class="sw-sum-card" onclick="switchSwTab('apt')"><div class="sw-sum-num">${s.apt_packages}</div><div class="sw-sum-label">📦 APT 手动安装包</div></div>
      <div class="sw-sum-card" onclick="switchSwTab('snap')"><div class="sw-sum-num">${s.snap_packages}</div><div class="sw-sum-label">🔵 Snap 包</div></div>
      <div class="sw-sum-card" onclick="switchSwTab('npm')"><div class="sw-sum-num">${s.npm_global}</div><div class="sw-sum-label">🟩 npm 全局包</div></div>
      <div class="sw-sum-card" onclick="switchSwTab('pip')"><div class="sw-sum-num">${s.pip_packages}</div><div class="sw-sum-label">🐍 pip 包</div></div>
      <div class="sw-sum-card" onclick="switchSwTab('gada')"><div class="sw-sum-num">${s.gada_projects}</div><div class="sw-sum-label">🚀 GADA 项目</div></div>
    </div>
    <div style="font-size:.8rem;color:var(--text3);margin-top:.5rem">扫描时间: ${data.scanned_at} · 耗时 ${data.scan_duration_ms}ms</div>`;
}

function switchSwTab(tab) {
  $$('.sw-tab').forEach(b => { b.classList.toggle('active', b.dataset.sw === tab); });
  currentSwTab = tab;
  renderSoftwareList();
}

function renderSoftwareList() {
  if (!softwareData) return;
  const q = ($('#softwareSearch').value || '').toLowerCase();
  const el = $('#softwareList');
  const count = $('#softwareCount');

  let items = [];
  const tab = currentSwTab;

  if (tab === 'env') items = softwareData.env_tools || [];
  else if (tab === 'apt') items = softwareData.apt_packages || [];
  else if (tab === 'snap') items = softwareData.snap_packages || [];
  else if (tab === 'npm') items = softwareData.npm_global || [];
  else if (tab === 'pip') items = softwareData.pip_packages || [];
  else if (tab === 'gada') items = softwareData.gada_projects || [];

  if (q) items = items.filter(i => (i.name||'').toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
  count.textContent = `共 ${items.length} 项`;

  if (items.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);padding:2rem;text-align:center">暂无数据</p>';
    return;
  }

  if (tab === 'env') {
    // 按 category 分组
    const groups = {};
    items.forEach(i => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });
    el.innerHTML = Object.entries(groups).map(([cat, tools]) => `
      <div class="sw-group">
        <div class="sw-group-title">${cat}</div>
        ${tools.map(t => swEnvCard(t)).join('')}
      </div>`).join('');
  } else if (tab === 'gada') {
    el.innerHTML = items.map(p => `
      <div class="sw-item">
        <div class="sw-item-info">
          <span class="sw-item-name">${p.name}</span>
          <span class="sw-item-ver">${p.type || '-'}</span>
          <span class="sw-item-path">${p.path || '-'}</span>
        </div>
        <div class="sw-item-actions">
          <span class="tag">${p.status || '-'}</span>
          <span style="font-size:.78rem;color:var(--text3)">在项目管理页卸载</span>
        </div>
      </div>`).join('');
  } else {
    el.innerHTML = `
      <div class="sw-table-wrap">
        <table class="search-table">
          <thead><tr><th>名称</th><th>版本</th>${tab==='apt'?'<th>说明</th>':''}<th>操作</th></tr></thead>
          <tbody>${items.map(i => `
            <tr>
              <td><span class="sw-item-name">${i.name}</span></td>
              <td style="font-size:.82rem;color:var(--text3)">${i.version||'-'}</td>
              ${tab==='apt'?`<td style="font-size:.78rem;color:var(--text3);max-width:300px">${i.description||''}</td>`:''}
              <td>
                <button class="btn btn-danger btn-sm" onclick="uninstallSoftwareItem('${i.manager}','${i.name}','${i.apt_package||i.name}','${(i.uninstall_cmd||'').replace(/'/g,"\'")}')">
                  🗑 卸载
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

function swEnvCard(t) {
  return `
    <div class="sw-env-card">
      <div class="sw-env-info">
        <span class="sw-item-name">${t.name}</span>
        <span class="sw-item-ver">${t.version ? t.version.split(' ').slice(0,3).join(' ') : '未安装'}</span>
        <span class="sw-item-path">${t.path || ''}</span>
      </div>
      <div class="sw-env-actions">
        <span class="tag">${t.install_manager || 'system'}</span>
        <button class="btn btn-danger btn-sm" onclick="uninstallSoftwareItem('${t.install_manager}','${t.id}','${t.apt_package||t.id}','${(t.uninstall_hint||'').replace(/'/g,"\\'")}')">🗑 卸载</button>
      </div>
    </div>`;
}

async function uninstallSoftwareItem(manager, name, apt_package, uninstall_cmd) {
  const PROTECTED = ['bash','apt','dpkg','sudo','coreutils','systemd','ssh','node','npm','git'];
  if (PROTECTED.includes(name)) {
    toast(`「${name}」是关键组件，不建议卸载`, 'warn');
    return;
  }
  if (!confirm(`确定卸载「${name}」？\n卸载后可能需要重新安装才能恢复。\n\n执行命令: ${uninstall_cmd}`)) return;
  try {
    toast(`正在卸载 ${name}...`, 'info');
    const res = await api('/software/uninstall', {
      method: 'POST',
      body: JSON.stringify({ manager, name, apt_package, uninstall_cmd }),
    });
    if (res.success) {
      toast(`✅ ${name} 卸载完成`, 'ok');
      doSoftwareScan(); // 重新扫描
    } else {
      toast(res.data?.message || '卸载失败', 'warn');
    }
  } catch (err) {
    toast('卸载失败: ' + err.message, 'err');
  }
}

async function doSelfUninstall() {
  const keepData = confirm('是否保留 workspace 数据（已部署的项目文件）？\n\n点「确定」= 保留数据\n点「取消」= 彻底删除所有数据');
  if (!confirm(`⚠️ 即将卸载 GADA 自身！\n\n这将：\n• 停止所有运行中的项目\n• 删除数据库和日志\n${keepData ? '• 保留 workspace 项目文件' : '• 删除 workspace 所有项目文件'}\n• 服务将停止运行\n\n确认卸载？`)) return;
  try {
    toast('开始卸载 GADA...', 'warn');
    const res = await api('/software/self-uninstall', {
      method: 'POST',
      body: JSON.stringify({ keep_data: keepData }),
    });
    if (res.success) {
      const steps = res.data.steps || [];
      alert('GADA 已卸载完成！\n\n' + steps.join('\n') + '\n\n主程序目录请手动删除：\n' + res.data.gada_dir);
    }
  } catch (_) {
    alert('GADA 已卸载，服务已停止。请手动删除主程序目录。');
  }
}

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
  let res, data;
  try {
    res = await fetch(API + url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  } catch (netErr) {
    throw new Error('网络请求失败，请检查服务是否正在运行（' + netErr.message + '）');
  }
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`服务器返回了无效数据（HTTP ${res.status}）`);
  }
  if (!res.ok) {
    const msg = data.error || data.message || `请求失败（HTTP ${res.status}）`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
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
// 部署模式切换（链接 / 自然语言）
// ============================================
let _deployMode = 'link';

function setDeployMode(mode) {
  _deployMode = mode;
  const input = $('#repoUrl');
  const hint = $('#urlHint');
  const icon = $('#urlPrefixIcon');
  const linkBtn = $('#modeLinkBtn');
  const nlBtn = $('#modeNlBtn');
  const analyzeBtn = $('#analyzeBtn');
  if (mode === 'link') {
    input.placeholder = 'https://github.com/用户名/项目名';
    if (hint) hint.innerHTML = '支持任意公开 GitHub 仓库链接 · 例：<code>https://github.com/owner/repo</code>';
    if (icon) icon.textContent = '🔗';
    if (analyzeBtn) analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span> 开始分析';
    linkBtn?.classList.replace('btn-ghost','btn-primary');
    nlBtn?.classList.replace('btn-primary','btn-ghost');
  } else {
    input.placeholder = '描述你想部署的项目，例如：部署一个可以调用 GPT 的聊天网站';
    if (hint) hint.innerHTML = 'AI 会自动搜索最合适的 GitHub 仓库并开始部署 · 支持中文描述';
    if (icon) icon.textContent = '💬';
    if (analyzeBtn) analyzeBtn.innerHTML = '<span class="btn-icon">⚡</span> 一键部署';
    nlBtn?.classList.replace('btn-ghost','btn-primary');
    linkBtn?.classList.replace('btn-primary','btn-ghost');
  }
  input.value = '';
  input.focus();
}

// ============================================
// 仓库分析
// ============================================
async function analyzeRepo() {
  const input = $('#repoUrl').value.trim();
  if (!input) { toast(_deployMode === 'nl' ? '请描述你想部署的项目' : '请输入 GitHub 仓库地址', 'err'); return; }

  // 自然语言模式：先搜索再部署
  if (_deployMode === 'nl') {
    await naturalLangDeployFromDesc(input);
    return;
  }

  const url = input;

  showStep('step-analyzing');

  // 部署前综合检测（网络+AI）
  try {
    const pre = await api('/diagnose/preflight');
    if (pre.data && !pre.data.ready && pre.data.issues?.length > 0) {
      const msg = pre.data.suggestions.slice(0, 3).join('\n');
      if (!confirm(`⚠️ 检测到以下问题，继续可能导致部署失败：\n\n${msg}\n\n是否仍要继续？`)) {
        showStep('step-input');
        return;
      }
    }
  } catch (_) {} // 检测失败不阻塞

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

// 自然语言描述 → AI 搜索最佳仓库 → 一键部署
async function naturalLangDeployFromDesc(desc) {
  showStep('step-analyzing');
  const steps = ['astep-fetch', 'astep-detect', 'astep-ai'];
  steps.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active','done'); });
  function setStep(idx) {
    steps.forEach((id, i) => {
      const el = document.getElementById(id); if (!el) return;
      el.classList.remove('active','done');
      if (i < idx) el.classList.add('done');
      else if (i === idx) el.classList.add('active');
    });
  }
  setStep(0);
  $('#analyzingText').textContent = 'AI 理解你的需求...';
  $('#analyzingSubtext').textContent = '正在搜索最合适的 GitHub 仓库';

  try {
    // 1. 自然语言搜索
    const searchRes = await api('/search/query', {
      method: 'POST',
      body: JSON.stringify({ query: desc, maxResults: 5 }),
    });
    const repos = searchRes.data?.repos || [];
    if (!repos.length) {
      showStep('step-input');
      toast('未找到匹配的仓库，请换个描述或直接粘贴链接', 'warn');
      return;
    }

    const best = repos[0];
    setStep(1);
    $('#analyzingText').textContent = `找到最佳匹配: ${best.name}`;
    $('#analyzingSubtext').textContent = `⭐ ${best.stars?.toLocaleString() || 0} · ${best.description?.slice(0,60) || ''}`;

    // 询问用户确认
    if (!confirm(`AI 推荐最佳匹配:\n\n📦 ${best.name}\n⭐ ${best.stars?.toLocaleString() || 0} Stars\n📝 ${best.description || ''}\n\n是否继续部署这个项目？`)) {
      showStep('step-input');
      return;
    }

    // 2. 分析仓库
    setStep(2);
    $('#analyzingText').textContent = 'AI 分析仓库结构...';
    $('#analyzingSubtext').textContent = '生成部署方案';
    const analyzeRes = await api('/repo/analyze', { method: 'POST', body: JSON.stringify({ url: best.url }) });
    state.currentAnalysis = analyzeRes.data;
    showAnalysisResult(analyzeRes.data);
    toast(`已找到「${best.name}」，请确认部署方案`, 'ok');
  } catch (err) {
    showStep('step-input');
    toast('自然语言部署失败: ' + err.message, 'err');
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

  // 分析完成后，异步进行代码风险扫描（不阻塞用户）
  if (state.currentProject?.id) {
    setTimeout(() => runRiskScan(state.currentProject.id), 500);
  }
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
      const batchMode = window._batchMode || false;
      return `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-header">
          ${batchMode ? `<input type="checkbox" class="batch-cb" data-id="${p.id}" onchange="updateBatchCount()" style="margin-right:.5rem;margin-top:.2rem;cursor:pointer">` : ''}
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
          <button class="btn btn-ghost" onclick="showWebhookModal(${p.id}, '${p.name.replace(/'/g,"\\'")}')">🔔 Webhook</button>
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
  document.querySelector('[data-tab="envguide"]').addEventListener('click', () => {
    if (!window._envGuideInited) { initEnvGuide(); window._envGuideInited = true; }
    $('#envSearch').addEventListener('input', renderEnvList);
  });
  document.querySelector('[data-tab="envcheck"]').addEventListener('click', () => {
    if (!window._envCheckInited) { window._envCheckInited = true; }
  });
  document.querySelector('[data-tab="templates"]').addEventListener('click', () => {
    if (!window._tplInited) { initTemplates(); window._tplInited = true; }
  });
  document.querySelector('[data-tab="logs"]').addEventListener('click', () => {
    if (!window._logsInited) { initLogs(); window._logsInited = true; }
  });
  document.querySelector('[data-tab="monitor"]').addEventListener('click', () => {
    if (!window._monitorInited) { initMonitor(); window._monitorInited = true; }
  });

  // 新功能 Tab 初始化
  document.querySelector('[data-tab="share"]')?.addEventListener('click', () => {
    fillProjectSelects();
  });
  document.querySelector('[data-tab="remote"]')?.addEventListener('click', () => {
    fillProjectSelects(); loadRemoteHosts();
  });
  document.querySelector('[data-tab="webhookx"]')?.addEventListener('click', () => {
    fillProjectSelects(); loadWebhookxList();
  });
  document.querySelector('[data-tab="private"]')?.addEventListener('click', () => {
    loadPrivTokens();
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
      <td>
        <button class="btn btn-primary btn-sm" onclick="deployFromSearch('${r.url}')">🚀 部署</button>
        <button class="btn btn-ghost btn-sm" onclick="naturalLangDeploy('${r.url}','${r.name.replace(/'/g,"\\'")}')">⚡ 一键</button>
      </td>
    </tr>`).join('');
}

function deployFromSearch(url) {
  document.querySelector('[data-tab="home"]').click();
  setTimeout(() => { $('#repoUrl').value = url; $('#analyzeBtn').click(); }, 200);
}

// 自然语言部署：搜索结果一键直接触发部署（跳过手动分析步骤）
async function naturalLangDeploy(url, name) {
  if (!confirm(`一键部署「${name}」？\n\n将自动：\n1. 克隆仓库\n2. AI 分析并生成部署方案\n3. 自动安装依赖\n4. 完成部署\n\n点「确定」开始`)) return;

  // 切换到首页部署视图
  document.querySelector('[data-tab="home"]').click();
  await new Promise(r => setTimeout(r, 200));

  // 填入 URL，直接跳过分析，触发自动部署
  $('#repoUrl').value = url;
  showLoading(`正在一键部署「${name}」...`);
  showStep('step-deploying');

  try {
    // 1. 分析仓库
    const analyzeRes = await api('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ repoUrl: url }),
    });
    state.currentProject = analyzeRes.data;
    appendLog('✅ 分析完成，开始部署...');
    setProgress(20, '分析完成，开始自动部署...');

    // 2. 自动部署
    const deployRes = await api('/deploy/auto/' + analyzeRes.data.id, {
      method: 'POST',
      body: JSON.stringify({ mode: 'auto' }),
    });

    if (deployRes.success) {
      setProgress(100, '部署成功！');
      setTimeout(() => {
        showStep('step-done');
        $('#doneMessage').textContent = `✅ 「${name}」已成功部署！`;
        hideLoading();
        loadProjects();
      }, 800);
    } else {
      appendLog('❌ 自动部署失败，请查看日志', 'error');
      hideLoading();
    }
  } catch (err) {
    appendLog('❌ ' + err.message, 'error');
    hideLoading();
    toast('一键部署失败: ' + err.message, 'err');
  }
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
// ============================================
// 环境指南
// ============================================
let envGuideData = null;
let envCategoryActive = 'all';

async function initEnvGuide() {
  show($('#envLoading'));
  try {
    const res = await api('/envguide/list');
    envGuideData = res.data;
    renderEnvCategories(res.data.categories);
    renderEnvList();
  } catch (err) {
    toast('加载失败: ' + err.message, 'err');
  } finally {
    hide($('#envLoading'));
  }
}

function renderEnvCategories(categories) {
  const el = $('#envCategoryFilter');
  el.innerHTML = `<button class="sw-tab active" data-cat="all" onclick="filterEnvCat('all',this)">全部</button>` +
    categories.map(c =>
      `<button class="sw-tab" data-cat="${c}" onclick="filterEnvCat('${c}',this)">${c}</button>`
    ).join('');
}

function filterEnvCat(cat, btn) {
  envCategoryActive = cat;
  $$('#envCategoryFilter .sw-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEnvList();
}

function renderEnvList() {
  if (!envGuideData) return;
  const q = ($('#envSearch').value || '').toLowerCase();
  const el = $('#envList');

  let tools = envGuideData.tools;
  if (envCategoryActive !== 'all') tools = tools.filter(t => t.category === envCategoryActive);
  if (q) tools = tools.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.desc.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );

  if (tools.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);padding:2rem;text-align:center">没有找到匹配的工具</p>';
    return;
  }

  // 按分类重新分组（只包含过滤后的）
  const groups = {};
  tools.forEach(t => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });

  el.innerHTML = Object.entries(groups).map(([cat, items]) =>
    `<div class="envg-group">
      <div class="sw-group-title">${cat} <span style="color:var(--text3);font-weight:400">(${items.length})</span></div>
      <div class="envg-grid">${items.map(t => envToolCard(t)).join('')}</div>
    </div>`
  ).join('');
}

function envToolCard(t) {
  const osTag = (t.os || []).map(o => `<span class="env-os-tag">${o}</span>`).join('');
  return `
    <div class="envg-card">
      <div class="envg-card-top">
        <span class="envg-icon">${t.icon}</span>
        <div class="envg-info">
          <div class="envg-name">${t.name}</div>
          <div class="envg-cat">${t.category}</div>
        </div>
      </div>
      <div class="envg-desc">${t.desc}</div>
      <div class="envg-os">${osTag}</div>
      <div class="envg-actions">
        <a href="${t.website}" target="_blank" class="btn btn-ghost btn-sm">🌐 官网</a>
        <button class="btn btn-primary btn-sm" onclick="showEnvTutorial('${t.id}')">📖 教程</button>
      </div>
    </div>`;
}

async function showEnvTutorial(id) {
  const modal = $('#envTutorialModal');
  const title = $('#tutorialTitle');
  const content = $('#tutorialContent');

  // 先从缓存取
  const tool = (envGuideData?.tools || []).find(t => t.id === id);
  if (!tool) return;

  title.textContent = `${tool.icon} ${tool.name} 安装教程`;
  content.innerHTML = renderTutorial(tool);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function renderTutorial(tool) {
  const steps = tool.tutorial?.steps || [];
  const tips = tool.tutorial?.tips || [];

  const stepsHTML = steps.map((s, i) => `
    <div class="tut-step">
      <div class="tut-step-num">${i + 1}</div>
      <div class="tut-step-body">
        <div class="tut-step-title">${s.title}</div>
        <div class="tut-step-detail">${formatTutDetail(s.detail)}</div>
      </div>
    </div>`).join('');

  const tipsHTML = tips.length ? `
    <div class="tut-tips">
      <div class="tut-tips-title">💡 小贴士</div>
      ${tips.map(t => `<div class="tut-tip">• ${t}</div>`).join('')}
    </div>` : '';

  const links = `
    <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;gap:.75rem;align-items:center">
      <a href="${tool.website}" target="_blank" class="btn btn-primary btn-sm">🌐 访问官网</a>
      <span style="font-size:.8rem;color:var(--text3)">支持系统：${(tool.os || []).join(' / ')}</span>
    </div>`;

  return stepsHTML + tipsHTML + links;
}

function formatTutDetail(text) {
  // 代码命令用 code 标签包裹（检测冒号+空格后的内容，或独立行）
  return text
    .replace(/\n/g, '<br>')
    .replace(/：([^<]+命令[^<]*)?(`[^`]+`)/g, '：<code>$2</code>')
    .replace(/(?:^|(?<=：|：\s))((?:[a-z][\w.-]*\s[\w\s./~-]*|[~/$][\w/.-]+)[^<\n]{0,80})/gm, (m) => {
      // 简单规则：包含典型命令模式的行
      if (/^(sudo|npm|pip|brew|curl|bash|sh|git|node|python|cargo|go|ruby|php|docker|apt|snap|nvm|pyenv|conda|yarn|pnpm|bun|deno|rustup|gem|composer|mvn|gradle|sdk)\b/.test(m.trim())) {
        return `<code class="tut-cmd">${m.trim()}</code>`;
      }
      return m;
    });
}

function closeEnvTutorial() {
  const modal = $('#envTutorialModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// 点遮罩关闭
document.addEventListener('click', e => {
  if (e.target.id === 'envTutorialModal') closeEnvTutorial();
});
// ============================================
// 批量操作
// ============================================
window._batchMode = false;
window._selectedIds = new Set();

function toggleBatchMode(on) {
  window._batchMode = on;
  window._selectedIds.clear();
  const toolbar = $('#batchToolbar');
  if (toolbar) toolbar.style.display = on ? 'flex' : 'none';
  updateBatchCount();
  loadProjects(); // 重新渲染，加/去掉 checkbox
}

function toggleSelectAll(checked) {
  $$('.batch-cb').forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.dataset.id);
    if (checked) window._selectedIds.add(id);
    else window._selectedIds.delete(id);
  });
  updateBatchCount();
}

function updateBatchCount() {
  $$('.batch-cb').forEach(cb => {
    const id = parseInt(cb.dataset.id);
    if (cb.checked) window._selectedIds.add(id);
    else window._selectedIds.delete(id);
  });
  const cnt = window._selectedIds.size;
  const el = $('#batchCount');
  if (el) el.textContent = `已选 ${cnt} 项`;
  // 全选框状态同步
  const all = $$('.batch-cb');
  const selectAllCb = $('#selectAllProjects');
  if (selectAllCb && all.length > 0) {
    selectAllCb.indeterminate = cnt > 0 && cnt < all.length;
    selectAllCb.checked = cnt === all.length;
  }
}

async function batchAction(action) {
  const ids = [...window._selectedIds];
  if (ids.length === 0) { toast('请先选择项目', 'warn'); return; }

  const actionLabel = { start: '启动', stop: '停止', update: '检测更新', uninstall: '卸载' }[action];
  if (action === 'uninstall') {
    if (!confirm(`确定卸载选中的 ${ids.length} 个项目？此操作不可撤销。`)) return;
  }

  toast(`正在批量${actionLabel} ${ids.length} 个项目...`, 'info');
  let ok = 0, fail = 0;

  for (const id of ids) {
    try {
      if (action === 'start') {
        await api(`/process/start/${id}`, { method: 'POST' });
        ok++;
      } else if (action === 'stop') {
        await api(`/process/stop/${id}`, { method: 'POST' });
        ok++;
      } else if (action === 'update') {
        // 只检测不自动更新，逐个弹窗太烦，直接触发更新
        const res = await api(`/deploy/check-update/${id}`);
        if (res.data.has_update) {
          await api(`/deploy/update/${id}`, { method: 'POST', body: JSON.stringify({ reinstall: false }) });
        }
        ok++;
      } else if (action === 'uninstall') {
        await api(`/project/${id}`, { method: 'DELETE' });
        ok++;
      }
    } catch (err) {
      fail++;
      logger && logger.warn ? null : console.warn(`Batch ${action} failed for ${id}:`, err.message);
    }
  }

  toast(`批量${actionLabel}完成：成功 ${ok}，失败 ${fail}`, ok > 0 ? 'ok' : 'err');
  window._selectedIds.clear();
  await loadProjects();
}

// ============================================
// AI 故障自愈
// ============================================
async function aiAutoHeal(projectId, errorLog) {
  const healBtn = $(`#healBtn_${projectId}`);
  if (healBtn) { healBtn.disabled = true; healBtn.textContent = 'AI 分析中...'; }
  try {
    const res = await api(`/ai/heal/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ error_log: errorLog }),
    });
    const d = res.data;
    if (!d.suggestion) { toast('AI 未能生成修复建议', 'warn'); return; }

    // 弹出修复建议
    const modal = $('#healModal');
    if (!modal) { showHealModalFallback(d); return; }
    $('#healModalTitle').textContent = `🩺 AI 故障分析 - 项目 #${projectId}`;
    $('#healModalContent').innerHTML = `
      <div class="heal-analysis">${d.analysis || ''}</div>
      <div class="heal-suggestion">
        <div class="heal-suggestion-title">💡 修复建议</div>
        <pre class="heal-cmd">${d.suggestion}</pre>
      </div>
      ${d.auto_fixable ? `<button class="btn btn-primary" onclick="applyHealFix(${projectId},'${encodeURIComponent(d.fix_command || '')}')">⚡ 一键应用修复</button>` : '<p style="color:var(--text3);font-size:.85rem">此问题需手动处理，请按上方建议操作。</p>'}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (err) {
    toast('AI 分析失败: ' + err.message, 'err');
  } finally {
    if (healBtn) { healBtn.disabled = false; healBtn.textContent = '🩺 AI 修复'; }
  }
}

function showHealModalFallback(d) {
  alert(`AI 故障分析\n\n${d.analysis || ''}\n\n修复建议:\n${d.suggestion}`);
}

async function applyHealFix(projectId, encodedCmd) {
  const cmd = decodeURIComponent(encodedCmd);
  if (!confirm(`即将执行修复命令:\n${cmd}\n\n确认执行？`)) return;
  try {
    const res = await api(`/ai/heal/${projectId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ fix_command: cmd }),
    });
    toast(res.message || '修复命令已执行', 'ok');
    document.getElementById('healModal')?.classList.add('hidden');
    await loadProjects();
  } catch (err) {
    toast('修复失败: ' + err.message, 'err');
  }
}

function closeHealModal() {
  document.getElementById('healModal')?.classList.add('hidden');
  document.getElementById('healModal')?.classList.remove('flex');
}
// ============================================
// 环境检测页
// ============================================
async function doEnvDetect() {
  const loading = $('#envCheckLoading');
  const result = $('#envCheckResult');
  const placeholder = $('#envCheckPlaceholder');
  const btn = $('#envDetectBtn');

  show(loading); hide(result); hide(placeholder);
  btn.disabled = true; btn.textContent = '检测中...';

  try {
    const res = await api('/env/detect');
    renderEnvCheck(res.data);
    hide(loading); show(result);
    const ok = res.data.results.filter(r => r.installed).length;
    const total = res.data.results.length;
    toast(`检测完成：${ok}/${total} 已安装`, ok === total ? 'ok' : 'warn');
  } catch (err) {
    hide(loading); show(placeholder);
    toast('检测失败: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '🔍 一键检测';
  }
}

function renderEnvCheck(data) {
  const results = data.results || [];
  const installed = results.filter(r => r.installed);
  const missing = results.filter(r => !r.installed);
  const platform = data.platform || 'linux';
  const platformLabel = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' }[platform] || platform;

  $('#envCheckSummary').innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
      <div class="sw-sum-card" style="min-width:100px">
        <div class="sw-sum-num" style="color:#22c55e">${installed.length}</div>
        <div class="sw-sum-label">✅ 已安装</div>
      </div>
      <div class="sw-sum-card" style="min-width:100px">
        <div class="sw-sum-num" style="color:#ef4444">${missing.length}</div>
        <div class="sw-sum-label">❌ 未安装</div>
      </div>
      <div style="font-size:.83rem;color:var(--text3)">系统平台: ${platformLabel}</div>
    </div>
    ${missing.length > 0 ? `<div style="margin-top:.75rem;padding:.65rem 1rem;background:var(--primary-light);border-radius:var(--radius-sm);font-size:.85rem;color:var(--primary)">
      ⚠️ 缺少 ${missing.map(m=>m.name).join('、')}，可能影响部分项目部署
    </div>` : '<div style="margin-top:.5rem;padding:.5rem 1rem;background:#f0fdf4;border-radius:var(--radius-sm);font-size:.85rem;color:#16a34a">✅ 所有工具均已安装，部署环境就绪！</div>'}`;

  $('#envCheckList').innerHTML = results.map(r => envCheckCard(r, platform)).join('');
}

function envCheckCard(r, platform) {
  const statusColor = r.installed ? '#22c55e' : '#ef4444';
  const statusIcon = r.installed ? '✅' : '❌';
  const installBtnHtml = !r.installed && r.install_cmd
    ? `<button class="btn btn-primary btn-sm" onclick="installEnvTool('${r.id}','${r.name}')">⬇️ 安装</button>`
    : !r.installed ? `<a href="#" onclick="switchSwTabToGuide('${r.id}')" class="btn btn-ghost btn-sm">📖 查看教程</a>` : '';

  return `
    <div class="sw-env-card" style="border-left:3px solid ${statusColor}">
      <div class="sw-env-info">
        <div style="display:flex;align-items:center;gap:.5rem">
          <span>${statusIcon}</span>
          <span class="sw-item-name">${r.name}</span>
          ${r.installed ? `<span class="sw-item-ver">${r.version || ''}</span>` : '<span style="font-size:.78rem;color:#ef4444">未安装</span>'}
        </div>
        ${!r.installed && r.install_cmd ? `<div style="font-size:.75rem;color:var(--text3);margin-top:.2rem;font-family:monospace">${r.install_cmd}</div>` : ''}
        ${r.install_note && !r.installed ? `<div style="font-size:.72rem;color:var(--text3);margin-top:.15rem">💡 ${r.install_note}</div>` : ''}
      </div>
      <div class="sw-env-actions">${installBtnHtml}</div>
    </div>`;
}

async function installEnvTool(toolId, toolName) {
  if (!confirm(`安装 ${toolName}？\n\n将在后台执行安装命令，可能需要 1-2 分钟。\n\n注意：Linux/macOS 可自动安装，Windows 需手动操作。`)) return;
  const btn = event.target;
  btn.disabled = true; btn.textContent = '安装中...';
  try {
    toast(`正在安装 ${toolName}...`, 'info');
    const res = await api('/env/install', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId }),
    });
    const d = res.data;
    if (d.manual) {
      alert(`Windows 自动安装说明:\n\n${d.message}`);
    } else {
      toast(d.message, d.success ? 'ok' : 'warn');
    }
    if (d.success || !d.manual) await doEnvDetect(); // 重新检测
  } catch (err) {
    toast('安装失败: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '⬇️ 安装';
  }
}

function switchSwTabToGuide(toolId) {
  // 跳转到环境指南 Tab 并搜索对应工具
  document.querySelector('[data-tab="envguide"]')?.click();
  setTimeout(() => {
    const input = $('#envSearch');
    if (input) { input.value = toolId; renderEnvList(); }
  }, 300);
}
// ============================================
// 部署模板
// ============================================
let tplData = null;
let tplCategoryActive = 'all';

async function initTemplates() {
  show($('#tplLoading'));
  $('#tplSearch').addEventListener('input', renderTplList);
  try {
    const res = await api('/templates/list');
    tplData = res.data;
    renderTplCategories(res.data.categories);
    renderTplList();
  } catch (err) {
    toast('加载模板失败: ' + err.message, 'err');
  } finally {
    hide($('#tplLoading'));
  }
}

function renderTplCategories(categories) {
  const el = $('#tplCategoryFilter');
  el.innerHTML = `<button class="sw-tab active" onclick="filterTplCat('all',this)">全部</button>` +
    categories.map(c => `<button class="sw-tab" onclick="filterTplCat('${c}',this)">${c}</button>`).join('');
}

function filterTplCat(cat, btn) {
  tplCategoryActive = cat;
  $$('#tplCategoryFilter .sw-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTplList();
}

function renderTplList() {
  if (!tplData) return;
  const q = ($('#tplSearch').value || '').toLowerCase();
  const el = $('#tplList');

  let templates = tplData.templates;
  if (tplCategoryActive !== 'all') templates = templates.filter(t => t.category === tplCategoryActive);
  if (q) templates = templates.filter(t =>
    t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(q))
  );

  if (templates.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);padding:2rem;text-align:center">没有匹配的模板</p>';
    return;
  }

  // 按分类分组
  const groups = {};
  templates.forEach(t => { if (!groups[t.category]) groups[t.category] = []; groups[t.category].push(t); });

  el.innerHTML = Object.entries(groups).map(([cat, items]) =>
    `<div class="envg-group">
      <div class="sw-group-title">${cat}</div>
      <div class="tpl-grid">${items.map(tplCard).join('')}</div>
    </div>`
  ).join('');
}

function tplCard(t) {
  const verifiedBadge = t.verified ? '<span class="tpl-badge verified">✅ 已验证</span>' : '';
  const customBadge = t.source === 'custom' ? '<span class="tpl-badge custom">📦 自定义</span>' : '';
  const tags = (t.tags || []).slice(0, 3).map(tag => `<span class="env-os-tag">${tag}</span>`).join('');
  const envWarning = (t.env_vars || []).filter(e => e.required).length > 0
    ? `<div style="font-size:.75rem;color:#eab308;margin-top:.3rem">⚠️ 需配置 ${(t.env_vars||[]).filter(e=>e.required).length} 个必填环境变量</div>` : '';

  return `
    <div class="tpl-card">
      <div class="tpl-card-top">
        <span class="envg-icon">${t.icon || '📦'}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap">
            <span class="envg-name">${t.name}</span>
            ${verifiedBadge}${customBadge}
          </div>
          <div class="envg-cat">${t.category}</div>
        </div>
        ${t.stars ? `<span style="font-size:.78rem;color:var(--text3)">⭐ ${t.stars}</span>` : ''}
      </div>
      <div class="envg-desc">${t.desc}</div>
      ${envWarning}
      ${t.notes ? `<div style="font-size:.75rem;color:var(--text3);margin-top:.2rem">💡 ${t.notes}</div>` : ''}
      <div class="envg-os" style="margin-top:.4rem">${tags}</div>
      <div class="tpl-card-footer">
        <a href="${t.repo_url}" target="_blank" class="btn btn-ghost btn-sm">🔗 仓库</a>
        ${t.readme_url ? `<a href="${t.readme_url}" target="_blank" class="btn btn-ghost btn-sm">📖 文档</a>` : ''}
        <button class="btn btn-primary btn-sm" onclick="deployFromTemplate('${t.id}')">🚀 一键部署</button>
        ${t.source === 'custom' ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomTemplate('${t.id}')">🗑</button>` : ''}
      </div>
    </div>`;
}

async function deployFromTemplate(templateId) {
  try {
    const res = await api(`/templates/${templateId}/deploy`, { method: 'POST' });
    const tpl = res.data.template;

    // 切换到首页，填入 URL，触发分析+部署
    document.querySelector('[data-tab="home"]').click();
    await new Promise(r => setTimeout(r, 200));
    $('#repoUrl').value = tpl.repo_url;
    toast(`已选用模板「${tpl.name}」，正在分析仓库...`, 'info');
    await analyzeRepo();
  } catch (err) {
    toast('模板部署失败: ' + err.message, 'err');
  }
}

async function showExportTemplateModal() {
  // 加载已部署项目列表
  try {
    const res = await api('/project');
    const deployed = (res.data || []).filter(p => ['deployed','running'].includes(p.status));
    const sel = $('#exportTplProject');
    sel.innerHTML = deployed.length
      ? deployed.map(p => `<option value="${p.id}">${p.name} (${p.status})</option>`).join('')
      : '<option value="">暂无已部署项目</option>';
    const modal = $('#exportTplModal');
    modal.classList.remove('hidden'); modal.classList.add('flex');
  } catch (err) {
    toast('加载项目失败: ' + err.message, 'err');
  }
}

function closeExportTplModal() {
  $('#exportTplModal').classList.add('hidden');
  $('#exportTplModal').classList.remove('flex');
}

async function doExportTemplate() {
  const projectId = $('#exportTplProject').value;
  const templateName = $('#exportTplName').value.trim();
  const category = $('#exportTplCategory').value.trim() || '我的模板';
  const desc = $('#exportTplDesc').value.trim();
  if (!projectId || !templateName) { toast('请选择项目并填写模板名称', 'warn'); return; }
  try {
    const res = await api('/templates/export', {
      method: 'POST',
      body: JSON.stringify({ projectId, templateName, category, desc }),
    });
    toast(res.message || '模板已导出', 'ok');
    closeExportTplModal();
    // 刷新模板列表
    const listRes = await api('/templates/list');
    tplData = listRes.data;
    renderTplCategories(listRes.data.categories);
    renderTplList();
  } catch (err) {
    toast('导出失败: ' + err.message, 'err');
  }
}

async function deleteCustomTemplate(id) {
  if (!confirm('删除此自定义模板？')) return;
  try {
    await api(`/templates/custom/${id}`, { method: 'DELETE' });
    toast('模板已删除', 'ok');
    const res = await api('/templates/list');
    tplData = res.data;
    renderTplCategories(res.data.categories);
    renderTplList();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}
// ============================================
// Docker 容器化面板
// ============================================
let _dockerProjectId = null;

async function showDockerPanel() {
  const projectId = state.currentProject?.id;
  if (!projectId) { toast('请先完成项目部署', 'warn'); return; }
  _dockerProjectId = projectId;

  // 打开弹窗
  const modal = $('#dockerModal');
  modal.classList.remove('hidden'); modal.classList.add('flex');
  $('#dockerLog').style.display = 'none';
  $('#dockerLog').textContent = '';

  await refreshDockerStatus();
}

function closeDockerModal() {
  $('#dockerModal').classList.add('hidden');
  $('#dockerModal').classList.remove('flex');
}

async function refreshDockerStatus() {
  if (!_dockerProjectId) return;
  try {
    const res = await api(`/docker/status/${_dockerProjectId}`);
    const d = res.data;
    renderDockerStatus(d);
    renderDockerActions(d);
  } catch (err) {
    $('#dockerStatusBar').innerHTML = `<span style="color:#ef4444">❌ 检测失败: ${err.message}</span>`;
  }
}

function renderDockerStatus(d) {
  const items = [
    { label: 'Dockerfile', ok: d.hasDockerfile },
    { label: 'docker-compose.yml', ok: d.hasCompose },
    { label: '.dockerignore', ok: d.hasDockerIgnore },
  ];
  $('#dockerStatusBar').innerHTML = `
    <div style="display:flex;gap:.75rem;flex-wrap:wrap">
      ${items.map(i => `<span class="sw-env-badge" style="background:${i.ok?'#f0fdf4':'#fef2f2'};color:${i.ok?'#16a34a':'#dc2626'};padding:.25rem .7rem;border-radius:10px;font-size:.82rem">
        ${i.ok ? '✅' : '❌'} ${i.label}
      </span>`).join('')}
    </div>`;
}

function renderDockerActions(d) {
  const hasAll = d.hasDockerfile;
  $('#dockerActions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="dockerGenerate(${!d.hasDockerfile})">
      ${d.hasDockerfile ? '🔄 重新生成文件' : '🤖 AI 生成 Dockerfile'}
    </button>
    ${hasAll ? `
    <button class="btn btn-secondary btn-sm" onclick="dockerBuild()">🔨 构建镜像</button>
    <button class="btn btn-secondary btn-sm" onclick="dockerRun()">🚀 运行容器</button>
    <button class="btn btn-ghost btn-sm" onclick="dockerStop()">🛑 停止容器</button>
    <button class="btn btn-ghost btn-sm" onclick="dockerViewLogs()">📋 容器日志</button>
    ` : ''}
    <button class="btn btn-ghost btn-sm" onclick="refreshDockerStatus()">🔄 刷新状态</button>`;
}

function appendDockerLog(msg) {
  const logEl = $('#dockerLog');
  logEl.style.display = 'block';
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

async function dockerGenerate(overwrite = false) {
  if (!overwrite && !confirm('AI 将生成 Dockerfile 和 docker-compose.yml，继续？')) return;
  appendDockerLog('🤖 AI 生成容器化文件...');
  try {
    const res = await api(`/docker/generate/${_dockerProjectId}`, {
      method: 'POST', body: JSON.stringify({ overwrite }),
    });
    appendDockerLog(res.message || '生成完成');
    toast(res.message || '文件已生成', 'ok');
    await refreshDockerStatus();
    // 预览生成的文件
    if (res.data?.dockerfile) {
      $('#dockerFilePreview').innerHTML = `
        <details open style="margin-top:.75rem">
          <summary style="cursor:pointer;font-weight:600">📄 Dockerfile 预览</summary>
          <pre class="heal-cmd" style="margin-top:.4rem">${escapeHtml(res.data.dockerfile.slice(0, 1500))}${res.data.dockerfile.length > 1500 ? '\n...（已截断）' : ''}</pre>
        </details>
        <details style="margin-top:.5rem">
          <summary style="cursor:pointer;font-weight:600">📄 docker-compose.yml 预览</summary>
          <pre class="heal-cmd" style="margin-top:.4rem">${escapeHtml((res.data.compose || '').slice(0, 800))}</pre>
        </details>`;
    }
  } catch (err) {
    appendDockerLog('❌ ' + err.message);
    toast('生成失败: ' + err.message, 'err');
  }
}

async function dockerBuild() {
  appendDockerLog('🔨 构建 Docker 镜像...');
  try {
    const res = await api(`/docker/build/${_dockerProjectId}`, { method: 'POST' });
    appendDockerLog(res.message || '构建成功');
    toast(res.message || '镜像构建成功', 'ok');
  } catch (err) {
    appendDockerLog('❌ ' + err.message);
    toast('构建失败: ' + err.message, 'err');
  }
}

async function dockerRun() {
  appendDockerLog('🚀 启动容器...');
  try {
    const res = await api(`/docker/run/${_dockerProjectId}`, { method: 'POST' });
    appendDockerLog(res.message || '容器已启动');
    toast(res.message || '容器启动成功', 'ok');
  } catch (err) {
    appendDockerLog('❌ ' + err.message);
    toast('启动失败: ' + err.message, 'err');
  }
}

async function dockerStop() {
  if (!confirm('停止并删除容器？镜像不会被删除，可以再次运行。')) return;
  appendDockerLog('🛑 停止容器...');
  try {
    const res = await api(`/docker/stop/${_dockerProjectId}`, { method: 'POST' });
    appendDockerLog(res.success ? '✅ 容器已停止' : '⚠️ 停止失败');
    toast(res.success ? '容器已停止' : '停止失败', res.success ? 'ok' : 'warn');
  } catch (err) {
    appendDockerLog('❌ ' + err.message);
    toast('停止失败: ' + err.message, 'err');
  }
}

async function dockerViewLogs() {
  appendDockerLog('📋 获取容器日志...');
  try {
    const res = await api(`/docker/logs/${_dockerProjectId}?lines=50`);
    const logs = res.data?.logs || '（无日志）';
    appendDockerLog('─── 容器日志 ───');
    appendDockerLog(logs);
  } catch (err) {
    appendDockerLog('❌ ' + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// ============================================
// 代码风险扫描（分析结果页）
// ============================================
async function runRiskScan(projectId) {
  if (!projectId) return;
  const banner = $('#riskBanner');
  if (!banner) return;
  banner.innerHTML = '<span style="color:var(--text3);font-size:.82rem">🔍 正在扫描代码风险...</span>';
  banner.classList.remove('hidden');
  try {
    const res = await api(`/diagnose/risk/${projectId}`, { method: 'POST' });
    const d = res.data;
    renderRiskBanner(d);
  } catch (err) {
    banner.innerHTML = `<span style="font-size:.8rem;color:var(--text3)">⚠️ 风险扫描失败: ${err.message}</span>`;
  }
}

function renderRiskBanner(d) {
  const banner = $('#riskBanner');
  if (!banner) return;
  const colors = { safe: '#16a34a', low: '#2563eb', medium: '#d97706', high: '#dc2626' };
  const icons = { safe: '✅', low: '💡', medium: '⚠️', high: '🚨' };
  const color = colors[d.risk_level] || '#6b7280';
  const icon = icons[d.risk_level] || '❓';

  banner.innerHTML = `
    <div style="padding:.65rem 1rem;border-radius:var(--radius-sm);border:1px solid ${color}30;background:${color}10;display:flex;align-items:flex-start;gap:.6rem;flex-wrap:wrap">
      <span style="font-size:1rem">${icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:${color};font-size:.85rem">风险扫描：${{safe:'安全',low:'低风险',medium:'中等风险',high:'高风险'}[d.risk_level] || d.risk_level}</div>
        <div style="font-size:.8rem;color:var(--text2);margin-top:.15rem">${d.recommendation}</div>
        ${d.summary.total > 0 ? `<div style="font-size:.75rem;color:var(--text3);margin-top:.2rem">高: ${d.summary.high} · 中: ${d.summary.medium} · 低: ${d.summary.low}</div>` : ''}
      </div>
      ${d.summary.total > 0 ? `<button class="btn btn-ghost btn-sm" onclick="showRiskDetails()">查看详情</button>` : ''}
    </div>
    ${d.risk_level === 'high' ? `<div style="margin-top:.4rem;padding:.5rem 1rem;background:#fef2f2;border-radius:var(--radius-sm);font-size:.82rem;color:#dc2626">🚨 发现高风险项，建议不部署或充分了解后再继续。</div>` : ''}`;
  banner.classList.remove('hidden');
  // 存储扫描结果供详情弹窗用
  window._riskData = d;
}

function showRiskDetails() {
  const d = window._riskData;
  if (!d) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay flex';
  modal.id = 'riskDetailModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;max-height:80vh;overflow-y:auto">
      <div class="modal-header">
        <h3>🔍 代码风险扫描详情</h3>
        <button class="btn btn-ghost" onclick="document.getElementById('riskDetailModal').remove()">✕</button>
      </div>
      <p style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">${d.recommendation}</p>
      ${d.findings.length === 0 ? '<p style="color:#16a34a">✅ 未发现任何风险项</p>' : d.findings.map(f => `
        <div class="heal-suggestion" style="border-left:3px solid ${({high:'#dc2626',medium:'#d97706',low:'#2563eb'})[f.level]||'#6b7280'};padding-left:.75rem">
          <div class="heal-suggestion-title">${({high:'🚨',medium:'⚠️',low:'💡'})[f.level]||'•'} ${f.desc}</div>
          <div style="font-size:.78rem;color:var(--text3)">${f.file}${f.line ? ` 第${f.line}行` : ''}</div>
          ${f.details?.map(d2 => `<div style="font-size:.75rem;color:var(--text2);margin-top:.2rem;font-family:monospace">${d2}</div>`).join('') || ''}
        </div>`).join('')}
    </div>`;
  document.body.appendChild(modal);
}

// ============================================
// 导入/导出配置
// ============================================
function downloadConfig() {
  window.location.href = '/api/config/export';
  toast('正在下载配置文件...', 'info');
}

async function showImportModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay flex';
  modal.id = 'importModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:520px">
      <div class="modal-header">
        <h3>📥 导入配置</h3>
        <button class="btn btn-ghost" onclick="document.getElementById('importModal').remove()">✕</button>
      </div>
      <p style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">上传之前导出的 <code>gada-config-*.json</code> 文件，恢复所有项目配置。</p>
      <div style="display:flex;flex-direction:column;gap:.75rem">
        <input type="file" id="importFileInput" accept=".json" class="input">
        <div style="display:flex;align-items:center;gap:.5rem">
          <input type="checkbox" id="importOverwrite">
          <label for="importOverwrite" style="font-size:.85rem">遇到重复项目时覆盖（默认跳过）</label>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="previewImport()">👁 预览</button>
          <button class="btn btn-primary" onclick="doImport()">📥 确认导入</button>
        </div>
        <div id="importPreviewResult"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function readImportFile() {
  const file = $('#importFileInput')?.files[0];
  if (!file) { toast('请先选择文件', 'warn'); return null; }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => { try { resolve(JSON.parse(e.target.result)); } catch (_) { reject(new Error('JSON 解析失败')); } };
    reader.readAsText(file);
  });
}

async function previewImport() {
  try {
    const data = await readImportFile();
    const res = await api('/config/import/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const d = res.data;
    $('#importPreviewResult').innerHTML = `
      <div style="font-size:.83rem;margin-top:.5rem">
        <div>�� 共 ${d.total} 个项目：<span style="color:#16a34a">${d.new} 个新增</span>，<span style="color:#d97706">${d.conflicts} 个冲突</span></div>
        ${d.preview.slice(0, 10).map(p => `<div style="padding:.2rem 0;color:${p._import_status==='conflict'?'#d97706':'var(--text2)'}">${p._import_status==='conflict'?'⚠️':'✅'} ${p.name} (${p.repo_url?.slice(0,40)})</div>`).join('')}
      </div>`;
  } catch (err) {
    toast('预览失败: ' + err.message, 'err');
  }
}

async function doImport() {
  try {
    const data = await readImportFile();
    const conflict = $('#importOverwrite')?.checked ? 'overwrite' : 'skip';
    const res = await api(`/config/import?conflict=${conflict}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const d = res.data;
    const imported = d.results.filter(r => r.action === 'imported').length;
    const skipped = d.results.filter(r => r.action === 'skipped').length;
    toast(`导入完成：${imported} 个成功，${skipped} 个跳过`, 'ok');
    document.getElementById('importModal')?.remove();
    loadProjects();
  } catch (err) {
    toast('导入失败: ' + err.message, 'err');
  }
}

// ============================================
// Webhook 管理
// ============================================
async function showWebhookModal(projectId, projectName) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay flex';
  modal.id = 'webhookModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:560px">
      <div class="modal-header">
        <h3>🔔 Webhook 自动更新</h3>
        <button class="btn btn-ghost" onclick="document.getElementById('webhookModal').remove()">✕</button>
      </div>
      <div id="webhookContent"><div class="spinner" style="margin:1rem auto"></div></div>
    </div>`;
  document.body.appendChild(modal);

  try {
    const res = await api(`/webhook/setup/${projectId}`);
    const d = res.data;
    $('#webhookContent').innerHTML = `
      <p style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">
        每次向 GitHub 推送代码时，自动拉取更新并重启「${projectName}」。
      </p>
      <div style="margin-bottom:.75rem">
        <label style="font-size:.82rem;color:var(--text3)">Webhook URL（复制到 GitHub）</label>
        <div style="display:flex;gap:.4rem;margin-top:.3rem">
          <input type="text" class="input" value="${d.webhook_url}" readonly style="flex:1;font-size:.8rem">
          <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${d.webhook_url}').then(()=>toast('已复制','ok'))">📋</button>
        </div>
      </div>
      <details>
        <summary style="cursor:pointer;font-size:.85rem;font-weight:600">📖 配置步骤</summary>
        <ol style="font-size:.82rem;color:var(--text2);margin-top:.5rem;padding-left:1.2rem;line-height:1.8">
          ${d.instructions.map(s => `<li>${s}</li>`).join('')}
        </ol>
      </details>
      <div style="margin-top:.75rem;display:flex;gap:.5rem">
        <button class="btn btn-danger btn-sm" onclick="deleteWebhook('${projectId}')">🗑 删除 Webhook</button>
      </div>`;
  } catch (err) {
    $('#webhookContent').innerHTML = `<p style="color:#ef4444">❌ ${err.message}</p>`;
  }
}

async function deleteWebhook(projectId) {
  if (!confirm('删除此项目的 Webhook？')) return;
  try {
    await api(`/webhook/${projectId}`, { method: 'DELETE' });
    toast('Webhook 已删除', 'ok');
    document.getElementById('webhookModal')?.remove();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}
// 网络+AI 综合检测弹窗
async function checkNetworkAndAI() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay flex';
  modal.id = 'netCheckModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:620px;max-height:80vh;overflow-y:auto">
      <div class="modal-header">
        <h3>🌐 网络与 AI 检测</h3>
        <button class="btn btn-ghost" onclick="document.getElementById('netCheckModal').remove()">✕</button>
      </div>
      <div id="netCheckContent"><div class="spinner" style="margin:1.5rem auto"></div><p style="text-align:center;color:var(--text3)">检测中，请稍候...</p></div>
    </div>`;
  document.body.appendChild(modal);

  try {
    const [netRes, aiRes] = await Promise.all([
      api('/diagnose/network'),
      api('/diagnose/ai'),
    ]);
    const net = netRes.data;
    const ai = aiRes.data;

    $('#netCheckContent').innerHTML = `
      <h4 style="margin-bottom:.5rem">🌐 网络连通性</h4>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem">
        ${net.results.map(r => `<span style="font-size:.78rem;padding:.2rem .6rem;border-radius:10px;background:${r.ok?'#f0fdf4':'#fef2f2'};color:${r.ok?'#16a34a':'#dc2626'}">
          ${r.ok?'✅':'❌'} ${r.name} ${r.ok?(r.latency+'ms'):r.error||''}
        </span>`).join('')}
      </div>
      ${net.suggestions.length ? `<div style="font-size:.82rem;color:#d97706;margin-bottom:.75rem">${net.suggestions.map(s=>`<div>💡 ${s}</div>`).join('')}</div>` : '<div style="font-size:.82rem;color:#16a34a;margin-bottom:.75rem">✅ 网络连通性正常</div>'}

      <h4 style="margin-bottom:.5rem">🤖 AI 提供商</h4>
      <div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.75rem">
        ${ai.results.length === 0 ? '<p style="color:var(--text3);font-size:.83rem">暂无配置的 AI 提供商，请在「AI 设置」中添加</p>' : ai.results.map(r => `
          <div style="display:flex;align-items:center;gap:.5rem;font-size:.83rem">
            <span>${r.ok?'✅':r.configured?'❌':'⚪'}</span>
            <span style="font-weight:600">${r.name}</span>
            ${r.ok ? `<span style="color:#16a34a">${r.latency}ms</span>` : ''}
            ${!r.ok && r.error ? `<span style="color:#ef4444">${r.error}</span>` : ''}
            ${!r.configured ? '<span style="color:var(--text3)">未配置</span>' : ''}
          </div>`).join('')}
      </div>

      ${net.suggestions.length > 0 ? `
        <div style="margin-top:.5rem;padding:.65rem 1rem;background:#fffbeb;border-radius:var(--radius-sm)">
          <div style="font-weight:600;font-size:.85rem;margin-bottom:.3rem">💡 修复建议</div>
          ${net.suggestions.map(s => `<div style="font-size:.8rem;color:#92400e;margin-top:.2rem">${s}</div>`).join('')}
        </div>` : ''}`;
  } catch (err) {
    $('#netCheckContent').innerHTML = `<p style="color:#ef4444">❌ 检测失败: ${err.message}</p>`;
  }
}
// ============================================
// 日志浏览
// ============================================
let _currentLogFile = null;
let _logTailEvtSource = null;

async function initLogs() {
  await loadLogsList();
}

async function loadLogsList() {
  try {
    const res = await api('/logs/list');
    const files = res.data?.files || [];
    const el = $('#logsFileList');
    if (!files.length) {
      el.innerHTML = '<div style="font-size:.78rem;color:var(--text3)">暂无日志文件</div>';
      return;
    }
    el.innerHTML = files.map(f => `
      <div class="log-file-item${_currentLogFile===f.name?' active':''}" onclick="loadLogFile('${f.name}')">
        <div style="font-size:.78rem;word-break:break-all">${f.name}</div>
        <div style="font-size:.68rem;color:var(--text3)">${f.size_human}</div>
      </div>`).join('');
  } catch (err) {
    toast('加载日志列表失败: ' + err.message, 'err');
  }
}

async function loadLogFile(filename, filter = '') {
  stopLogTail();
  _currentLogFile = filename;
  $('#logFileName').textContent = filename;
  $('#logContent').textContent = '加载中...';
  // 更新高亮
  $$('.log-file-item').forEach(el => el.classList.remove('active'));
  try {
    const res = await api(`/logs/read/${encodeURIComponent(filename)}?tail=300${filter ? '&filter=' + encodeURIComponent(filter) : ''}`);
    const lines = res.data?.lines || [];
    $('#logContent').innerHTML = lines.map(l => `<div class="log-line ${logLineClass(l)}">${escapeHtml(l)}</div>`).join('');
    $('#logContent').scrollTop = $('#logContent').scrollHeight;
  } catch (err) {
    $('#logContent').textContent = '加载失败: ' + err.message;
  }
}

function logLineClass(line) {
  if (/error|fail|exception/i.test(line)) return 'log-err';
  if (/warn/i.test(line)) return 'log-warn';
  if (/✅|success|ok/i.test(line)) return 'log-ok';
  return '';
}

function applyLogFilter() {
  if (!_currentLogFile) { toast('请先选择日志文件', 'warn'); return; }
  loadLogFile(_currentLogFile, $('#logFilterInput').value.trim());
}

function toggleLogTail() {
  if (_logTailEvtSource) { stopLogTail(); return; }
  if (!_currentLogFile) { toast('请先选择日志文件', 'warn'); return; }
  $('#logTailBtn').textContent = '⏹ 停止追踪';
  $('#logTailBtn').style.color = '#ef4444';
  _logTailEvtSource = new EventSource(`/api/logs/stream/${encodeURIComponent(_currentLogFile)}`);
  _logTailEvtSource.onmessage = (e) => {
    const line = JSON.parse(e.data);
    const el = $('#logContent');
    const div = document.createElement('div');
    div.className = 'log-line ' + logLineClass(line);
    div.textContent = line;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  };
  _logTailEvtSource.onerror = () => stopLogTail();
}

function stopLogTail() {
  if (_logTailEvtSource) { _logTailEvtSource.close(); _logTailEvtSource = null; }
  const btn = $('#logTailBtn');
  if (btn) { btn.textContent = '▶ 实时追踪'; btn.style.color = ''; }
}

async function showAuditLog() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay flex';
  modal.id = 'auditModal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:700px;max-height:82vh;overflow-y:auto">
      <div class="modal-header">
        <h3>📋 审计日志</h3>
        <div style="display:flex;gap:.4rem">
          <input id="auditFilter" type="text" class="input" placeholder="过滤..." style="width:160px;font-size:.82rem">
          <button class="btn btn-ghost btn-sm" onclick="reloadAuditLog()">🔍</button>
          <button class="btn btn-ghost" onclick="document.getElementById('auditModal').remove()">✕</button>
        </div>
      </div>
      <div id="auditContent"><div class="spinner" style="margin:1rem auto"></div></div>
    </div>`;
  document.body.appendChild(modal);
  await reloadAuditLog();
}

async function reloadAuditLog() {
  const filter = $('#auditFilter')?.value || '';
  try {
    const res = await api(`/logs/audit?limit=100&filter=${encodeURIComponent(filter)}`);
    const entries = res.data?.entries || [];
    $('#auditContent').innerHTML = entries.length === 0
      ? '<p style="color:var(--text3);padding:1rem">暂无审计记录</p>'
      : `<table style="width:100%;font-size:.78rem;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:.3rem .5rem">时间</th>
            <th style="text-align:left;padding:.3rem .5rem">操作</th>
            <th style="text-align:left;padding:.3rem .5rem">状态</th>
            <th style="text-align:left;padding:.3rem .5rem">耗时</th>
          </tr></thead>
          <tbody>${entries.map(e => `
            <tr style="border-bottom:1px solid var(--border);color:${e.success===false?'#ef4444':'inherit'}">
              <td style="padding:.25rem .5rem;white-space:nowrap">${new Date(e.ts).toLocaleString('zh-CN')}</td>
              <td style="padding:.25rem .5rem">${e.action}</td>
              <td style="padding:.25rem .5rem">${e.success!==false?'✅':'❌'} ${e.status||''}</td>
              <td style="padding:.25rem .5rem">${e.ms||''}ms</td>
            </tr>`).join('')}
          </tbody></table>`;
  } catch (err) {
    $('#auditContent').innerHTML = `<p style="color:#ef4444">❌ ${err.message}</p>`;
  }
}

// ============================================
// 资源监控
// ============================================
let _monitorEvt = null;
let _monitorData = { cpu: [], mem: [] };
const CHART_MAX = 60;

function initMonitor() {
  loadNetworkOptStatus();
}

function startMonitorStream() {
  if (_monitorEvt) return;
  _monitorEvt = new EventSource('/api/monitor/stream');
  _monitorEvt.onmessage = (e) => {
    const d = JSON.parse(e.data);
    updateMonitorCards(d);
    updateMonitorChart(d);
  };
  _monitorEvt.onerror = () => stopMonitorStream();
  toast('实时监控已开始', 'info');
}

function stopMonitorStream() {
  if (_monitorEvt) { _monitorEvt.close(); _monitorEvt = null; }
}

function updateMonitorCards(d) {
  const fmt = (b) => b > 1073741824 ? (b/1073741824).toFixed(1)+'GB' : (b/1048576).toFixed(0)+'MB';
  if ($('#monCpu')) $('#monCpu').textContent = d.cpu_pct + '%';
  if ($('#monCpuBar')) $('#monCpuBar').style.width = d.cpu_pct + '%';
  if ($('#monMem')) $('#monMem').textContent = `${fmt(d.mem_used)} / ${fmt(d.mem_total)} (${d.mem_pct}%)`;
  if ($('#monMemBar')) $('#monMemBar').style.width = d.mem_pct + '%';
  if ($('#monDisk')) $('#monDisk').textContent = `${fmt(d.disk_used)} / ${fmt(d.disk_total)} (${d.disk_pct}%)`;
  if ($('#monDiskBar')) $('#monDiskBar').style.width = d.disk_pct + '%';
  if ($('#monLoad')) $('#monLoad').textContent = `${d.load_1} / ${d.load_5}`;
}

function updateMonitorChart(d) {
  _monitorData.cpu.push(d.cpu_pct);
  _monitorData.mem.push(d.mem_pct);
  if (_monitorData.cpu.length > CHART_MAX) { _monitorData.cpu.shift(); _monitorData.mem.shift(); }
  drawMonitorChart();
}

function drawMonitorChart() {
  const canvas = $('#monitorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth; const h = canvas.offsetHeight;
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  // 网格
  ctx.strokeStyle = 'rgba(100,100,100,.15)'; ctx.lineWidth = 1;
  [25,50,75].forEach(y => {
    const py = h - (y/100)*h;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    ctx.fillStyle = 'rgba(100,100,100,.5)'; ctx.font = '10px monospace';
    ctx.fillText(y+'%', 2, py - 2);
  });
  // 绘制折线
  const drawLine = (data, color) => {
    if (data.length < 2) return;
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
    data.forEach((v, i) => {
      const x = (i / (CHART_MAX - 1)) * w;
      const y = h - (v / 100) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawLine(_monitorData.cpu, '#6366f1');
  drawLine(_monitorData.mem, '#22c55e');
}

async function loadNetworkOptStatus() {
  try {
    const res = await api('/network-opt/status');
    const d = res.data;
    const el = $('#networkOptStatus');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.75rem;font-size:.83rem">
        <div><span style="color:var(--text3)">npm registry: </span><code>${d.npm.current}</code> ${d.npm.is_cn_mirror?'<span style="color:#16a34a">✅ 国内镜像</span>':'<span style="color:#d97706">⚠️ 官方源</span>'}</div>
        <div><span style="color:var(--text3)">pip mirror: </span><code>${d.pip.current}</code> ${d.pip.is_cn_mirror?'<span style="color:#16a34a">✅ 国内镜像</span>':'<span style="color:#d97706">⚠️ 默认源</span>'}</div>
      </div>
      ${d.suggestions.length ? `<div style="margin-top:.4rem;font-size:.78rem;color:#d97706">${d.suggestions.map(s=>`💡 ${s}`).join('<br>')}</div>` : ''}`;
  } catch (_) {}
}

async function applyNetworkOpt() {
  toast('🔍 测速中，请稍候...', 'info');
  try {
    const res = await api('/network-opt/apply', { method: 'POST' });
    const d = res.data;
    const npmMsg = d.result.npm ? `npm → ${d.result.npm.name}` : '';
    const pipMsg = d.result.pip ? `pip → ${d.result.pip.name}` : '';
    toast(`✅ 优化完成！${[npmMsg, pipMsg].filter(Boolean).join('，')}`, 'ok');
    await loadNetworkOptStatus();
  } catch (err) {
    toast('优化失败: ' + err.message, 'err');
  }
}

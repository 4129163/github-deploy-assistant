/**
 * GADA 新功能前端逻辑
 * 功能19：分享部署记录
 * 功能26：远程主机部署
 * 功能35：Webhook 自动触发
 * 功能40：私有仓库
 */

function safeParseLogOutput(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) {
      // [{type,data,time}] 格式 or string[]
      return parsed.slice(-10).map(item => {
        if (typeof item === 'string') return item;
        if (item && item.data) return item.data;
        return JSON.stringify(item);
      }).join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    return String(parsed).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  } catch (_) {
    return String(raw || '').slice(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// ============================================================
// 公共：加载项目列表到 <select>
// ============================================================
async function fillProjectSelects() {
  try {
    const res = await api('/project');
    const projects = res.data || [];
    const selects = [
      '#shareProjectSelect', '#shareListProjectSelect',
      '#remoteProjectSelect', '#webhookxProjectSelect'
    ];
    selects.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const hasBlank = sel.includes('ListProjectSelect');
      el.innerHTML = (hasBlank ? '<option value="">-- 选择项目 --</option>' : '') +
        projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    });
  } catch (_) {}
}

// ============================================================
// 功能19：分享部署记录
// ============================================================
async function createShareLink() {
  const projectId = document.querySelector('#shareProjectSelect')?.value;
  if (!projectId) { toast('请先选择项目', 'err'); return; }
  const expireHours = parseInt(document.querySelector('#shareExpireSelect')?.value || '72');
  const includeConfig = document.querySelector('#shareIncludeConfig')?.checked ?? true;
  const includeSteps = document.querySelector('#shareIncludeSteps')?.checked ?? true;

  try {
    showLoading('生成分享链接...');
    const res = await api(`/share/create/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ expireHours, includeConfig, includeSteps }),
    });
    hideLoading();

    const data = res.data;
    const resultEl = document.querySelector('#shareResult');
    const linkInput = document.querySelector('#shareLinkInput');
    const noteEl = document.querySelector('#shareExpireNote');

    if (linkInput) linkInput.value = data.shareUrl;
    if (noteEl) {
      noteEl.textContent = data.expireAt
        ? `链接有效期至 ${new Date(data.expireAt).toLocaleString('zh-CN')}`
        : '链接永久有效';
    }
    if (resultEl) resultEl.classList.remove('hidden');
    toast('✅ 分享链接已生成', 'ok');
  } catch (err) {
    hideLoading();
    toast('生成失败: ' + err.message, 'err');
  }
}

function copyShareLink() {
  const input = document.querySelector('#shareLinkInput');
  if (!input) return;
  navigator.clipboard.writeText(input.value)
    .then(() => toast('链接已复制', 'ok'))
    .catch(() => toast('复制失败', 'err'));
}

async function loadShareList() {
  const projectId = document.querySelector('#shareListProjectSelect')?.value;
  if (!projectId) { toast('请选择项目', 'err'); return; }
  const el = document.querySelector('#shareList');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--text3)">加载中...</p>';
  try {
    const res = await api(`/share/list/${projectId}`);
    const list = res.data || [];
    if (list.length === 0) {
      el.innerHTML = '<p style="color:var(--text3)">该项目暂无分享记录</p>';
      return;
    }
    el.innerHTML = list.map(s => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;flex-wrap:wrap">
        <div>
          <div style="font-size:.85rem;color:var(--text2)">
            ${s.expired ? '⛔ 已过期' : '✅ 有效'} &nbsp;·&nbsp;
            创建于 ${new Date(s.createdAt).toLocaleString('zh-CN')}
          </div>
          <div style="font-size:.78rem;color:var(--text3)">
            ${s.expireAt ? '过期：' + new Date(s.expireAt).toLocaleString('zh-CN') : '永久有效'}
          </div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="copyText('/api/share/view/${s.token}')">📋 复制链接</button>
          <button class="btn btn-danger btn-sm" onclick="deleteShare('${s.token}')">🗑 删除</button>
        </div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

async function deleteShare(token) {
  if (!confirm('确认删除此分享链接？')) return;
  try {
    await api(`/share/${token}`, { method: 'DELETE' });
    toast('分享已删除', 'ok');
    loadShareList();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(location.origin + text)
    .then(() => toast('已复制', 'ok'))
    .catch(() => toast('复制失败', 'err'));
}

// ============================================================
// 功能26：远程主机部署
// ============================================================
async function loadRemoteHosts() {
  const el = document.querySelector('#remoteHostList');
  const sel = document.querySelector('#remoteHostSelect');
  if (!el) return;
  try {
    const res = await api('/remote/hosts');
    const hosts = res.data || [];
    if (sel) {
      sel.innerHTML = hosts.length === 0
        ? '<option value="">（暂无主机，请先添加）</option>'
        : hosts.map(h => `<option value="${h.id}">${h.name} (${h.host})</option>`).join('');
    }
    if (hosts.length === 0) {
      el.innerHTML = '<p style="color:var(--text3)">还没有远程主机。点击右上角「+ 添加主机」开始配置。</p>';
      return;
    }
    el.innerHTML = hosts.map(h => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
        <div>
          <div style="font-weight:600;display:flex;align-items:center;gap:.5rem">
            ${h.type === 'raspberry-pi' ? '🫐' : h.type === 'cloud' ? '☁️' : '🖥️'} ${h.name}
            <span class="badge" style="font-size:.72rem">${h.type}</span>
          </div>
          <div style="font-size:.82rem;color:var(--text2)">${h.username}@${h.host}:${h.port}</div>
          <div style="font-size:.78rem;color:var(--text3)">认证：${h.authType === 'key' ? '🔑 私钥' : '🔐 密码'} &nbsp;·&nbsp; 工作目录：${h.workDir}</div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="testHostConn('${h.id}', this)">🔌 测试连接</button>
          <button class="btn btn-danger btn-sm" onclick="removeHost('${h.id}')">🗑 删除</button>
        </div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

async function testHostConn(hostId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '测试中...'; }
  try {
    const res = await api(`/remote/hosts/${hostId}/test`, { method: 'POST' });
    toast(res.data.success ? `✅ 连接成功: ${res.data.info}` : `❌ 连接失败: ${res.data.error}`, res.data.success ? 'ok' : 'err');
  } catch (err) {
    toast('测试失败: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔌 测试连接'; }
  }
}

async function removeHost(hostId) {
  if (!confirm('确认删除该主机？')) return;
  try {
    await api(`/remote/hosts/${hostId}`, { method: 'DELETE' });
    toast('主机已删除', 'ok');
    loadRemoteHosts();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}

function showAddHostModal() {
  document.querySelector('#addHostModal')?.classList.remove('hidden');
}
function hideAddHostModal() {
  document.querySelector('#addHostModal')?.classList.add('hidden');
}

async function submitAddHost() {
  const name = document.querySelector('#hostName')?.value.trim();
  const host = document.querySelector('#hostAddr')?.value.trim();
  const port = parseInt(document.querySelector('#hostPort')?.value || '22');
  const username = document.querySelector('#hostUser')?.value.trim();
  const password = document.querySelector('#hostPassword')?.value.trim();
  const privateKey = document.querySelector('#hostPrivateKey')?.value.trim();
  const workDir = document.querySelector('#hostWorkDir')?.value.trim() || '~/gada-workspace';
  const type = document.querySelector('#hostType')?.value || 'generic';

  if (!name || !host || !username) { toast('请填写别名、IP 和用户名', 'err'); return; }
  if (!password && !privateKey) { toast('密码和私钥至少填写一项', 'err'); return; }

  try {
    showLoading('添加主机...');
    await api('/remote/hosts', {
      method: 'POST',
      body: JSON.stringify({ name, host, port, username, password: password || undefined, privateKey: privateKey || undefined, workDir, type }),
    });
    hideLoading();
    hideAddHostModal();
    toast('✅ 主机已添加', 'ok');
    loadRemoteHosts();
    // 清空表单
    ['#hostName','#hostAddr','#hostUser','#hostPassword','#hostPrivateKey','#hostWorkDir'].forEach(s => {
      const el = document.querySelector(s);
      if (el) el.value = '';
    });
  } catch (err) {
    hideLoading();
    toast('添加失败: ' + err.message, 'err');
  }
}

async function startRemoteDeploy() {
  const projectId = document.querySelector('#remoteProjectSelect')?.value;
  const hostId = document.querySelector('#remoteHostSelect')?.value;
  if (!projectId || !hostId) { toast('请选择项目和目标主机', 'err'); return; }
  if (!confirm('确认将项目部署到远程主机？')) return;

  showLoading('远程部署中，请稍候...');
  try {
    const res = await api(`/remote/deploy/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ hostId }),
    });
    hideLoading();
    const logs = (res.data?.logs || []).join('\n');
    toast(res.success ? '✅ 远程部署成功' : '❌ 远程部署失败', res.success ? 'ok' : 'err');
    if (logs) alert('部署日志：\n\n' + logs);
  } catch (err) {
    hideLoading();
    toast('远程部署失败: ' + err.message, 'err');
  }
}

// ============================================================
// 功能35：Webhook 自动触发
// ============================================================
async function generateWebhookx() {
  const projectId = document.querySelector('#webhookxProjectSelect')?.value;
  if (!projectId) { toast('请选择项目', 'err'); return; }
  const provider = document.querySelector('#webhookxProvider')?.value || 'github';
  const branches = (document.querySelector('#webhookxBranches')?.value || 'main').trim();
  const events = (document.querySelector('#webhookxEvents')?.value || 'push').trim();

  showLoading('生成 Webhook 配置...');
  try {
    const res = await api(`/webhookx/setup/${projectId}?provider=${provider}&branches=${encodeURIComponent(branches)}&events=${encodeURIComponent(events)}`);
    hideLoading();
    const data = res.data;
    const resultEl = document.querySelector('#webhookxResult');
    const instrEl = document.querySelector('#webhookxInstructions');
    if (instrEl) {
      instrEl.innerHTML = `
        <div style="margin-bottom:.75rem">
          <div style="font-size:.82rem;color:var(--text3);margin-bottom:.3rem">Webhook 接收地址：</div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input type="text" class="input" value="${data.webhook_url}" readonly style="flex:1;font-size:.8rem">
            <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${data.webhook_url}').then(()=>toast('已复制','ok'))">📋</button>
          </div>
        </div>
        <div style="margin-bottom:.75rem">
          <div style="font-size:.82rem;color:var(--text3);margin-bottom:.3rem">Secret（填入 ${provider === 'gitlab' ? 'GitLab Secret token' : 'GitHub Secret'}）：</div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input type="text" class="input" value="${data.secret}" readonly style="flex:1;font-family:monospace;font-size:.8rem">
            <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${data.secret}').then(()=>toast('已复制','ok'))">📋</button>
          </div>
        </div>
        <div style="font-size:.82rem;color:var(--text2);background:var(--bg3);padding:.6rem .75rem;border-radius:6px;white-space:pre-wrap">${data.instructions.join('\n')}</div>`;
    }
    if (resultEl) resultEl.classList.remove('hidden');
    toast('✅ Webhook 配置已生成', 'ok');
    loadWebhookxList();
  } catch (err) {
    hideLoading();
    toast('生成失败: ' + err.message, 'err');
  }
}

async function loadWebhookxList() {
  const el = document.querySelector('#webhookxList');
  if (!el) return;
  try {
    const res = await api('/webhookx/list');
    const list = res.data || [];
    if (list.length === 0) {
      el.innerHTML = '<p style="color:var(--text3);margin-bottom:.75rem">暂无已配置的 Webhook。</p>';
      return;
    }
    el.innerHTML = list.map(w => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;flex-wrap:wrap">
        <div>
          <div style="font-weight:600">${w.project_name} <span class="badge" style="font-size:.72rem">${w.provider}</span></div>
          <div style="font-size:.82rem;color:var(--text2)">分支：${(w.allow_branches||[]).join('/')} &nbsp;·&nbsp; 事件：${(w.allow_events||[]).join('/')}</div>
          <div style="font-size:.78rem;color:var(--text3)">创建于 ${new Date(w.created_at).toLocaleString('zh-CN')}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteWebhookx('${w.project_id}')">🗑 删除</button>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

async function deleteWebhookx(projectId) {
  if (!confirm('确认删除该 Webhook？')) return;
  try {
    await api(`/webhookx/${projectId}`, { method: 'DELETE' });
    toast('Webhook 已删除', 'ok');
    loadWebhookxList();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}

// ============================================================
// 功能40：私有仓库
// ============================================================
async function loadPrivTokens() {
  const listEl = document.querySelector('#privTokenList');
  const sel = document.querySelector('#privCloneToken');
  try {
    const res = await api('/private/tokens');
    const tokens = res.data || [];
    if (sel) {
      sel.innerHTML = tokens.length === 0
        ? '<option value="">（暂无令牌，请先添加）</option>'
        : tokens.map(t => `<option value="${t.id}">[${t.provider}] ${t.name}</option>`).join('');
    }
    if (!listEl) return;
    if (tokens.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text3)">还没有保存令牌。</p>';
      return;
    }
    listEl.innerHTML = tokens.map(t => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;flex-wrap:wrap">
        <div>
          <div style="font-weight:600">${t.name} <span class="badge" style="font-size:.72rem">${t.provider}</span></div>
          <div style="font-size:.78rem;color:var(--text3)">添加于 ${new Date(t.createdAt).toLocaleString('zh-CN')}</div>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="validatePrivToken('${t.id}', this)">✅ 验证</button>
          <button class="btn btn-danger btn-sm" onclick="deletePrivToken('${t.id}')">🗑 删除</button>
        </div>
      </div>`).join('');
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
  }
}

async function savePrivToken() {
  const name = document.querySelector('#privTokenName')?.value.trim();
  const token = document.querySelector('#privTokenValue')?.value.trim();
  const provider = document.querySelector('#privTokenProvider')?.value || 'github';
  if (!name || !token) { toast('请填写令牌名称和 Token 值', 'err'); return; }
  try {
    showLoading('保存令牌...');
    await saveToken(name, token, provider);
    hideLoading();
    document.querySelector('#privTokenName').value = '';
    document.querySelector('#privTokenValue').value = '';
    toast('✅ 令牌已保存（加密存储）', 'ok');
    loadPrivTokens();
  } catch (err) {
    hideLoading();
    toast('保存失败: ' + err.message, 'err');
  }
}

async function saveToken(name, token, provider) {
  return api('/private/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, token, provider }),
  });
}

async function validatePrivToken(tokenId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '验证中...'; }
  try {
    const res = await api(`/private/tokens/${tokenId}/validate`, { method: 'POST' });
    toast(res.data.valid ? `✅ 令牌有效，账号: ${res.data.user}` : `❌ 令牌无效: ${res.data.error}`, res.data.valid ? 'ok' : 'err');
  } catch (err) {
    toast('验证失败: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ 验证'; }
  }
}

async function deletePrivToken(tokenId) {
  if (!confirm('确认删除此令牌？')) return;
  try {
    await api(`/private/tokens/${tokenId}`, { method: 'DELETE' });
    toast('令牌已删除', 'ok');
    loadPrivTokens();
  } catch (err) {
    toast('删除失败: ' + err.message, 'err');
  }
}

async function clonePrivateRepo() {
  const repoUrl = document.querySelector('#privRepoUrl')?.value.trim();
  const tokenId = document.querySelector('#privCloneToken')?.value;
  const name = document.querySelector('#privRepoName')?.value.trim() || null;
  if (!repoUrl) { toast('请输入仓库地址', 'err'); return; }
  if (!tokenId) { toast('请先添加访问令牌', 'err'); return; }

  const resultEl = document.querySelector('#privCloneResult');
  showLoading('克隆私有仓库...');
  try {
    const res = await api('/private/clone', {
      method: 'POST',
      body: JSON.stringify({ repoUrl, tokenId, name }),
    });
    hideLoading();
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:.85rem">
          <div style="color:#22c55e;font-weight:600;margin-bottom:.4rem">✅ 克隆成功</div>
          <div style="font-size:.82rem;color:var(--text2)">项目：${res.data.project.name}</div>
          <div style="font-size:.78rem;color:var(--text3)">路径：${res.data.localPath}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:.6rem" onclick="switchTab('projects')">📂 前往项目管理</button>
        </div>`;
    }
    toast('✅ 私有仓库克隆成功', 'ok');
  } catch (err) {
    hideLoading();
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `<div style="color:#ef4444;font-size:.85rem">❌ ${err.message}</div>`;
    }
    toast('克隆失败: ' + err.message, 'err');
  }
}

// ============================================================
// Tab 切换钩子：切换到新标签时自动加载数据
// ============================================================
const _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;

function initNewTabHooks() {
  // 监听所有导航按钮点击
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'share') { fillProjectSelects(); }
      if (tab === 'remote') { fillProjectSelects(); loadRemoteHosts(); }
      if (tab === 'webhookx') { fillProjectSelects(); loadWebhookxList(); }
      if (tab === 'private') { loadPrivTokens(); }
    });
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initNewTabHooks();
});

// ============================================================
// 项目卡片快捷按钮：备份/回滚
// ============================================================
async function showProjectBackups(projectId, name) {
  showLoading('读取备份列表...');
  let backups = [];
  try {
    const res = await api(`/deploy/backups/${encodeURIComponent(name)}`);
    backups = res.data || [];
    hideLoading();
  } catch (err) {
    hideLoading();
    toast('读取备份失败: ' + err.message, 'err');
    return;
  }

  const existing = document.getElementById('backupModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'backupModal';
  modal.className = 'modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:560px;width:100%">
      <div class="modal-header">
        <h3>💾 备份 & 回滚 — ${name}</h3>
        <button class="icon-btn" onclick="document.getElementById('backupModal').remove()">✕</button>
      </div>
      ${backups.length === 0
        ? '<p style="color:var(--text3);padding:1rem">暂无备份记录。每次自动部署前会自动创建备份。</p>'
        : `<div style="max-height:360px;overflow-y:auto">
            ${backups.map(b => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .85rem;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:.5rem">
                <div>
                  <div style="font-size:.85rem;font-weight:500">${b.name || b}</div>
                  <div style="font-size:.75rem;color:var(--text3)">${b.size || ''} ${b.created_at ? '· ' + new Date(b.created_at).toLocaleString('zh-CN') : ''}</div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="doRollback(${projectId}, '${(b.name||b).replace(/'/g,"\\'")}')">⏪ 回滚到此版本</button>
              </div>`).join('')}
          </div>`
      }
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function doRollback(projectId, backupName) {
  if (!confirm(`确认回滚到备份：${backupName}？当前代码将被覆盖，此操作不可撤销。`)) return;
  document.getElementById('backupModal')?.remove();
  showLoading('回滚中...');
  try {
    const res = await api(`/deploy/rollback/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ backupName }),
    });
    hideLoading();
    toast(res.message || '✅ 回滚成功', 'ok');
  } catch (err) {
    hideLoading();
    toast('回滚失败: ' + err.message, 'err');
  }
}

// ============================================================
// 项目卡片快捷按钮：部署日志
// ============================================================
async function showProjectDeployLogs(projectId, name) {
  showLoading('读取部署日志...');
  let logs = [];
  try {
    const res = await api(`/deploy/logs/${projectId}`);
    logs = res.data || [];
    hideLoading();
  } catch (err) {
    hideLoading();
    toast('读取日志失败: ' + err.message, 'err');
    return;
  }

  const existing = document.getElementById('deployLogModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deployLogModal';
  modal.className = 'modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;width:100%">
      <div class="modal-header">
        <h3>📋 部署日志 — ${name}</h3>
        <button class="icon-btn" onclick="document.getElementById('deployLogModal').remove()">✕</button>
      </div>
      <div style="max-height:420px;overflow-y:auto">
        ${logs.length === 0
          ? '<p style="color:var(--text3);padding:1rem">暂无部署日志</p>'
          : logs.slice().reverse().map(l => `
            <div style="padding:.6rem .85rem;border-bottom:1px solid var(--border)">
              <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:.3rem">
                <span class="badge" style="font-size:.72rem;background:${l.status==='success'?'var(--green,#22c55e)':'var(--red,#ef4444)'}20;color:${l.status==='success'?'#22c55e':'#ef4444'}">${l.status==='success'?'✅ 成功':'❌ 失败'}</span>
                <span style="font-size:.78rem;color:var(--text3)">${new Date(l.created_at).toLocaleString('zh-CN')}</span>
                <span style="font-size:.78rem;color:var(--text3)">${l.mode || 'auto'}</span>
              </div>
              ${l.output ? `<pre style="font-size:.75rem;color:var(--text2);white-space:pre-wrap;max-height:120px;overflow-y:auto;background:var(--bg2);padding:.5rem;border-radius:4px;margin:0">${safeParseLogOutput(l.output)}</pre>` : ''}
            </div>`).join('')
        }
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ============================================================
// 项目卡片快捷按钮：一键分享
// ============================================================
async function quickShareProject(projectId) {
  showLoading('生成分享链接...');
  try {
    const res = await api(`/share/create/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ expireHours: 72, includeConfig: true, includeSteps: true }),
    });
    hideLoading();
    const url = res.data.shareUrl;
    const existing = document.getElementById('quickShareModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'quickShareModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:480px;width:100%">
        <div class="modal-header">
          <h3>🔗 分享链接已生成</h3>
          <button class="icon-btn" onclick="document.getElementById('quickShareModal').remove()">✕</button>
        </div>
        <p style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">链接有效期 72 小时，复制发给朋友，他们打开即可查看复现步骤：</p>
        <div style="display:flex;gap:.5rem">
          <input type="text" class="input" value="${url}" readonly style="flex:1;font-size:.82rem">
          <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('已复制','ok'))">📋 复制</button>
        </div>
        <p style="font-size:.75rem;color:var(--text3);margin-top:.5rem">过期时间：${new Date(res.data.expireAt).toLocaleString('zh-CN')}</p>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  } catch (err) {
    hideLoading();
    toast('生成分享链接失败: ' + err.message, 'err');
  }
}

// ============================================================
// 项目卡片快捷按钮：快捷远程部署
// ============================================================
async function quickRemoteDeploy(projectId, name) {
  // 先获取主机列表
  let hosts = [];
  try {
    const res = await api('/remote/hosts');
    hosts = res.data || [];
  } catch (_) {}

  const existing = document.getElementById('quickRemoteModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'quickRemoteModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999';

  if (hosts.length === 0) {
    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px;width:100%">
        <div class="modal-header">
          <h3>🌍 远程部署 — ${name}</h3>
          <button class="icon-btn" onclick="document.getElementById('quickRemoteModal').remove()">✕</button>
        </div>
        <p style="color:var(--text3);padding:.5rem 0">还没有配置远程主机。</p>
        <button class="btn btn-primary" onclick="document.getElementById('quickRemoteModal').remove();document.querySelector('[data-tab=remote]').click()">🌍 前往配置远程主机</button>
      </div>`;
  } else {
    const hostOptions = hosts.map(h => `<option value="${h.id}">${h.name} (${h.host})</option>`).join('');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px;width:100%">
        <div class="modal-header">
          <h3>🌍 远程部署 — ${name}</h3>
          <button class="icon-btn" onclick="document.getElementById('quickRemoteModal').remove()">✕</button>
        </div>
        <label style="display:block;margin-bottom:.75rem">选择目标主机
          <select id="quickRemoteHostSel" class="input" style="margin-top:.35rem">${hostOptions}</select>
        </label>
        <button class="btn btn-primary" style="width:100%" onclick="doQuickRemoteDeploy(${projectId})">🚀 开始远程部署</button>
      </div>`;
  }
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function doQuickRemoteDeploy(projectId) {
  const hostId = document.querySelector('#quickRemoteHostSel')?.value;
  if (!hostId) { toast('请选择主机', 'err'); return; }
  document.getElementById('quickRemoteModal')?.remove();
  showLoading('远程部署中，请稍候...');
  try {
    const res = await api(`/remote/deploy/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ hostId }),
    });
    hideLoading();
    toast(res.success ? '✅ 远程部署成功' : '❌ 远程部署失败', res.success ? 'ok' : 'err');
    if (res.data?.logs?.length) {
      const logs = res.data.logs.join('\n');
      setTimeout(() => alert('部署日志：\n\n' + logs), 300);
    }
  } catch (err) {
    hideLoading();
    toast('远程部署失败: ' + err.message, 'err');
  }
}

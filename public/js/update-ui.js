// ============================================================
// 版本更新 & 回滚前端模块
// 追加到 public/js/features.js 末尾
// ============================================================

/**
 * 检测单个项目是否有更新（项目卡片上的「检测更新」按钮）
 * 已有的 checkAndUpdate 调用的是旧的 /deploy/check-update/:id
 * 我们新增一个更完整的入口，同时支持回滚
 */
async function checkAndUpdateV2(id, name) {
  const btn = $(`#updateBtn_${id}`);
  if (btn) { btn.disabled = true; btn.textContent = '检测中...'; }
  try {
    const res = await api(`/api/update/check/${id}`);
    const d = res;
    if (btn) { btn.disabled = false; btn.textContent = d.hasUpdate ? '⬆️ 有新版本' : '✅ 已最新'; }
    if (!d.hasUpdate) {
      toast(`「${name}」已是最新版本`, 'ok');
      return;
    }
    // 有更新，弹出更新面板
    showUpdatePanel(id, name, d);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 检测更新'; }
    toast('检测失败: ' + err.message, 'err');
  }
}

/**
 * 弹出版本更新/回滚面板
 * @param {number} id - 项目 ID（0 = GADA 自身）
 * @param {string} name - 项目名
 * @param {object} checkResult - checkProjectUpdate 返回的结果
 */
async function showUpdatePanel(id, name, checkResult) {
  const existing = document.getElementById('updatePanel');
  if (existing) existing.remove();

  // 获取远端 commits 列表供回滚选择
  let commits = [];
  let releases = [];
  try {
    const r = await api(`/api/update/commits/${id}`);
    commits = r.commits || [];
    releases = r.releases || [];
  } catch (_) {}

  // 获取本地版本历史
  let history = [];
  try {
    const h = await api(`/api/update/history/${id}`);
    history = h.history || [];
  } catch (_) {}

  const modal = document.createElement('div');
  modal.id = 'updatePanel';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;overflow-y:auto;padding:1rem';

  const commitOptions = commits.map(c =>
    `<option value="${c.sha}">[${c.shortSha}] ${c.message.slice(0,50)} — ${c.author} ${new Date(c.date).toLocaleDateString('zh-CN')}</option>`
  ).join('');

  const releaseOptions = releases.length
    ? releases.map(r => `<option value="${r.commitSha}">${r.tag} ${r.name ? '— '+r.name : ''} (${new Date(r.published).toLocaleDateString('zh-CN')})</option>`).join('')
    : '<option value="">（暂无 Release）</option>';

  const historyRows = history.slice(0, 10).map(h =>
    `<tr>
      <td style="font-family:monospace;font-size:.8rem">${(h.commit_sha||'').slice(0,7)}</td>
      <td style="font-size:.8rem">${h.note || ''}</td>
      <td style="font-size:.78rem;color:var(--text3)">${new Date(h.created_at).toLocaleString('zh-CN')}</td>
      <td><button class="btn btn-ghost" style="font-size:.75rem;padding:.2rem .6rem" onclick="doRollback(${id},'${name}','${h.commit_sha}')">回滚</button></td>
    </tr>`
  ).join('');

  const newCommits = checkResult.remoteCommits || [];
  const changeLog = newCommits.length
    ? newCommits.map(c => `<li style="margin:.3rem 0"><code style="font-size:.8rem">${c.shortSha}</code> ${c.message} <span style="color:var(--text3);font-size:.78rem">— ${c.author}</span></li>`).join('')
    : '<li style="color:var(--text3)">（无法获取变更记录）</li>';

  modal.innerHTML = `
    <div class="modal-box" style="max-width:640px;width:100%;max-height:90vh;overflow-y:auto">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
        <h3>🔄 版本管理 — ${name}</h3>
        <button class="icon-btn" onclick="document.getElementById('updatePanel').remove()">✕</button>
      </div>

      <!-- 当前状态 -->
      <div style="background:var(--bg2);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:1rem;font-size:.85rem">
        <div>📌 本地版本：<code>${(checkResult.localSha||'未知').slice(0,7)}</code></div>
        <div style="margin-top:.3rem">🌐 远端最新：<code>${(checkResult.remoteSha||'未知').slice(0,7)}</code>
          ${checkResult.hasUpdate ? ' <span style="color:#f59e0b;font-weight:600">● 有新版本可更新</span>' : ' <span style="color:#22c55e">✓ 已是最新</span>'}
        </div>
      </div>

      <!-- 新版本变更内容 -->
      ${checkResult.hasUpdate ? `
      <div style="margin-bottom:1rem">
        <div style="font-weight:600;margin-bottom:.5rem">📝 更新内容</div>
        <ul style="padding-left:1.2rem;margin:0;font-size:.85rem">${changeLog}</ul>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-bottom:1rem" onclick="doUpdate(${id},'${name}')">
        ⬆️ 立即更新到最新版本
      </button>` : ''}

      <!-- 手动选择版本回滚 -->
      <div style="border:1px solid var(--border);border-radius:.5rem;padding:.75rem 1rem;margin-bottom:1rem">
        <div style="font-weight:600;margin-bottom:.6rem">🔀 选择版本回滚</div>
        <div style="margin-bottom:.5rem">
          <label style="font-size:.82rem;color:var(--text3)">从 Commit 历史选择</label>
          <select id="rollbackCommitSel" class="input" style="margin-top:.25rem;font-size:.83rem">
            <option value="">-- 选择目标版本 --</option>
            ${commitOptions}
          </select>
        </div>
        ${releases.length ? `<div style="margin-bottom:.5rem">
          <label style="font-size:.82rem;color:var(--text3)">或从 Release 选择</label>
          <select id="rollbackReleaseSel" class="input" style="margin-top:.25rem;font-size:.83rem" onchange="syncReleaseToCommit(this.value)">
            <option value="">-- 选择 Release --</option>
            ${releaseOptions}
          </select>
        </div>` : ''}
        <button class="btn btn-secondary" style="width:100%;margin-top:.4rem"
          onclick="doRollbackFromSelect(${id},'${name}')">
          ⏪ 回滚到所选版本
        </button>
      </div>

      <!-- 本地快照历史 -->
      ${historyRows ? `
      <div>
        <div style="font-weight:600;margin-bottom:.5rem">📦 本地快照历史</div>
        <div style="overflow-x:auto">
          <table style="width:100%;font-size:.83rem;border-collapse:collapse">
            <thead><tr style="color:var(--text3);font-size:.78rem">
              <th style="text-align:left;padding:.3rem .5rem">Commit</th>
              <th style="text-align:left;padding:.3rem .5rem">备注</th>
              <th style="text-align:left;padding:.3rem .5rem">时间</th>
              <th></th>
            </tr></thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/** 同步 Release 选择到 Commit 下拉框 */
function syncReleaseToCommit(sha) {
  const sel = document.getElementById('rollbackCommitSel');
  if (!sel || !sha) return;
  // 尝试找到对应的 option
  const opt = Array.from(sel.options).find(o => o.value === sha);
  if (opt) { sel.value = sha; } else {
    // 没有对应 commit 记录，插入一条临时选项
    const o = document.createElement('option');
    o.value = sha; o.textContent = `Release: ${sha.slice(0,7)}`; o.selected = true;
    sel.appendChild(o);
  }
}

/** 从下拉框读取并执行回滚 */
async function doRollbackFromSelect(id, name) {
  const sha = document.getElementById('rollbackCommitSel')?.value;
  if (!sha) { toast('请先选择要回滚的版本', 'err'); return; }
  await doRollback(id, name, sha);
}

/** 执行回滚 */
async function doRollback(id, name, sha) {
  if (!confirm(`确认将「${name}」回滚到版本 ${sha.slice(0,7)}？\n\n回滚前会自动保存当前版本快照，可随时再次切换回来。`)) return;
  document.getElementById('updatePanel')?.remove();
  showLoading(`正在回滚「${name}」...`);
  try {
    const res = await api(`/api/update/rollback/${id}`, {
      method: 'POST',
      body: JSON.stringify({ sha }),
    });
    hideLoading();
    if (res.success) {
      toast(`✅ 「${name}」已回滚到 ${sha.slice(0,7)}`, 'ok');
      loadProjects();
    } else {
      toast('回滚失败: ' + (res.error || '未知错误'), 'err');
    }
  } catch (err) {
    hideLoading();
    toast('回滚失败: ' + err.message, 'err');
  }
}

/** 执行更新到最新版本 */
async function doUpdate(id, name) {
  if (!confirm(`确认将「${name}」更新到最新版本？\n\n更新前会自动保存当前版本快照，可随时回滚。`)) return;
  document.getElementById('updatePanel')?.remove();
  showLoading(`正在更新「${name}」...`);
  try {
    const res = await api(`/api/update/perform/${id}`, { method: 'POST' });
    hideLoading();
    if (res.success) {
      toast(`✅ 「${name}」已更新到最新版本`, 'ok');
      loadProjects();
    } else {
      toast('更新失败: ' + (res.error || '未知错误'), 'err');
    }
  } catch (err) {
    hideLoading();
    toast('更新失败: ' + err.message, 'err');
  }
}

/**
 * 检测 GADA 自身更新（在系统页或顶部导航栏调用）
 */
async function checkSelfUpdate() {
  const btn = document.getElementById('selfUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = '检测中...'; }
  try {
    const res = await api('/api/update/check/0');
    if (btn) { btn.disabled = false; btn.textContent = res.hasUpdate ? '⬆️ GADA 有新版本' : '✅ GADA 已最新'; }
    if (!res.hasUpdate) {
      toast('GADA 已是最新版本', 'ok');
      return;
    }
    showUpdatePanel(0, 'GitHub Deploy Assistant (GADA)', res);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 检测 GADA 更新'; }
    toast('检测失败: ' + err.message, 'err');
  }
}

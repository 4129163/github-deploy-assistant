/**
 * Webhook 自动更新路由
 * POST /api/webhook/:token  — 接收 GitHub push 事件，自动 pull + 重启
 * GET  /api/webhook/setup/:projectId — 生成项目的 Webhook Token
 * GET  /api/webhook/list   — 列出所有 Webhook 配置
 * DELETE /api/webhook/:projectId — 删除 Webhook
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

// Webhook token 存储（内存 + 数据库 configs 表）
const webhookMap = {}; // token -> projectId

async function loadWebhooks() {
  try {
    const { ConfigDB } = require('../services/database');
    if (!ConfigDB) return;
    const raw = await ConfigDB.get('webhooks');
    if (raw) {
      const data = JSON.parse(raw);
      Object.assign(webhookMap, data);
      logger.info(`Loaded ${Object.keys(webhookMap).length} webhooks`);
    }
  } catch (_) {}
}

async function saveWebhooks() {
  try {
    const { ConfigDB } = require('../services/database');
    if (!ConfigDB) return;
    await ConfigDB.set('webhooks', JSON.stringify(webhookMap));
  } catch (_) {}
}

loadWebhooks();

// 生成 Webhook 设置（为项目生成 token）
router.get('/setup/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // 检查是否已有 token
    const existing = Object.entries(webhookMap).find(([, pid]) => String(pid) === String(project.id));
    let token = existing ? existing[0] : null;

    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      webhookMap[token] = String(project.id);
      await saveWebhooks();
    }

    const host = req.get('host') || 'localhost:3399';
    const protocol = req.secure ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/webhook/${token}`;

    res.json({
      success: true,
      data: {
        token,
        webhook_url: webhookUrl,
        project_id: project.id,
        project_name: project.name,
        instructions: [
          `1. 打开 GitHub 仓库 → Settings → Webhooks → Add webhook`,
          `2. Payload URL 填写: ${webhookUrl}`,
          `3. Content type 选择: application/json`,
          `4. Secret 填写: ${token} (重要！用于签名验证)`,
          `5. 触发事件选择: Just the push event`,
          `6. 点击 Add webhook`,
        ],
        security_notes: [
          '✅ 强烈建议在 GitHub Webhook 配置中填写 Secret 字段',
          '✅ 填写 Secret 后，系统会自动验证请求签名，防止恶意请求',
          '⚠️  如果不填写 Secret，Webhook 将无法验证请求来源，存在安全风险',
        ],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 列出所有 Webhook
router.get('/list', async (req, res) => {
  try {
    const list = await Promise.all(
      Object.entries(webhookMap).map(async ([token, projectId]) => {
        const project = await ProjectDB.getById(projectId);
        return {
          token: token.slice(0, 8) + '...',  // 部分展示 token
          full_token: token,
          project_id: projectId,
          project_name: project?.name || '(已删除)',
          project_status: project?.status,
        };
      })
    );
    res.json({ success: true, data: { webhooks: list } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除 Webhook
router.delete('/:projectId', async (req, res) => {
  try {
    const pid = String(req.params.projectId);
    const entry = Object.entries(webhookMap).find(([, id]) => String(id) === pid);
    if (!entry) return res.status(404).json({ error: '未找到该项目的 Webhook' });
    delete webhookMap[entry[0]];
    await saveWebhooks();
    res.json({ success: true, message: 'Webhook 已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HMAC签名验证函数
function verifyGitHubSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  // 使用时间安全的比较函数
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

// 接收 GitHub Push 事件
router.post('/:token', express.json({ type: '*/*' }), async (req, res) => {
  const { token } = req.params;
  const projectId = webhookMap[token];

  if (!projectId) {
    logger.warn(`Webhook: unknown token ${token.slice(0,8)}...`);
    return res.status(404).json({ error: 'Unknown webhook token' });
  }

  // 验证 GitHub Webhook 签名
  const githubSignature = req.headers['x-hub-signature-256'];
  if (githubSignature) {
    const rawBody = JSON.stringify(req.body);
    if (!verifyGitHubSignature(rawBody, githubSignature, token)) {
      logger.warn(`Webhook: HMAC signature verification failed for project ${projectId}`);
      return res.status(401).json({ error: 'Invalid signature' });
    }
    logger.debug(`Webhook: HMAC signature verified for project ${projectId}`);
  } else {
    logger.warn(`Webhook: No HMAC signature provided for project ${projectId} - security risk!`);
    // 可以选择是否允许无签名的请求，这里为了兼容性暂时允许
    // return res.status(401).json({ error: 'Missing signature' });
  }

  // 快速响应 GitHub，避免超时
  res.json({ received: true, project_id: projectId });

  // 异步处理更新
  setImmediate(async () => {
    try {
      const project = await ProjectDB.getById(projectId);
      if (!project) { logger.warn(`Webhook: project ${projectId} not found`); return; }

      const event = req.headers['x-github-event'] || 'push';
      const payload = req.body || {};
      const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'main';
      const pusher = payload.pusher?.name || 'unknown';
      const commits = payload.commits?.length || 0;

      logger.info(`Webhook triggered: ${project.name} (${branch}) by ${pusher}, ${commits} commits`);

      if (global.broadcastLog) {
        global.broadcastLog(String(projectId),
          `🔔 Webhook 触发：${pusher} 推送了 ${commits} 个提交到 ${branch} 分支`);
      }

      // 调用更新接口
      const deployRouter = require('./deploy');
      // 直接调用 ProjectDB update + git pull 逻辑
      const simpleGit = require('simple-git');
      const git = simpleGit(project.local_path);
      const broadcast = (msg) => {
        logger.info(`[Webhook Update:${projectId}] ${msg}`);
        if (global.broadcastLog) global.broadcastLog(String(projectId), msg);
      };

      broadcast('⬇️ 自动拉取最新代码...');
      const pullResult = await git.pull();
      const summary = Object.entries(pullResult.summary || {}).map(([k,v]) => `${k}: ${v}`).join(', ');
      broadcast(`✅ 代码已更新 (${summary || '已是最新'})`);

      // 如果项目正在运行，重启
      const { getProcessStatus, restartProject } = require('../services/process-manager');
      const status = getProcessStatus(String(projectId));
      if (status?.status === 'running') {
        broadcast('🔄 检测到服务运行中，自动重启...');
        await restartProject(project, broadcast);
        broadcast('✅ 重启完成');
      }

      await ProjectDB.update(projectId, { updated_at: new Date().toISOString() });
      if (global.broadcast) global.broadcast('webhook_update', { projectId, branch, pusher, commits });
    } catch (err) {
      logger.error(`Webhook update error for project ${projectId}:`, err);
      if (global.broadcastLog) global.broadcastLog(String(projectId), `❌ 自动更新失败: ${err.message}`);
    }
  });
});

module.exports = router;

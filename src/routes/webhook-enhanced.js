/**
 * 增强版 Webhook 路由（功能35：事件驱动，支持 GitHub/GitLab 流水线）
 * 扩展原有 webhook.js 的能力：
 * - 支持 GitHub push/release/workflow_run 事件
 * - 支持 GitLab push/pipeline/tag_push 事件
 * - 支持 HMAC 签名验证（Secret）
 * - 支持分支过滤、事件过滤
 * - 支持流水线回调（pipeline_run）
 *
 * GET  /api/webhookx/setup/:projectId  — 生成 Webhook 配置（含 Secret）
 * GET  /api/webhookx/list              — 列出所有 Webhook
 * DELETE /api/webhookx/:projectId      — 删除 Webhook
 * POST /api/webhookx/receive/:token    — 接收 GitHub/GitLab 事件
 * PATCH /api/webhookx/config/:projectId — 更新 Webhook 过滤配置
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { ProjectDB, DeployLogDB, ConfigDB } = require('../services/database');
const { logger } = require('../utils/logger');

// webhookx map: token -> { projectId, secret, allowBranches, allowEvents, provider, createdAt }
const webhookxMap = {};

async function loadWebhookx() {
  try {
    const raw = await ConfigDB.get('webhookx');
    if (raw) Object.assign(webhookxMap, JSON.parse(raw));
    logger.info(`Loaded ${Object.keys(webhookxMap).length} enhanced webhooks`);
  } catch (_) {}
}

async function saveWebhookx() {
  try {
    await ConfigDB.set('webhookx', JSON.stringify(webhookxMap));
  } catch (_) {}
}

loadWebhookx();

// ============================================================
// 签名验证
// ============================================================

/**
 * 验证 GitHub Webhook 签名（HMAC-SHA256）
 */
function verifyGitHubSignature(rawBody, secret, signature) {
  if (!secret || !signature) return !secret; // 未配置 secret 则跳过验证
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false;
  }
}

/**
 * 验证 GitLab Webhook Token
 */
function verifyGitLabToken(secret, token) {
  if (!secret) return true;
  return secret === token;
}

// ============================================================
// 路由
// ============================================================

/**
 * 生成 Webhook 配置
 * GET /api/webhookx/setup/:projectId?provider=github|gitlab&branches=main,dev&events=push,release
 */
router.get('/setup/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const provider = req.query.provider || 'github'; // github | gitlab
    const allowBranches = req.query.branches ? req.query.branches.split(',').map(s => s.trim()) : ['main', 'master'];
    const allowEvents = req.query.events
      ? req.query.events.split(',').map(s => s.trim())
      : provider === 'gitlab' ? ['push', 'tag_push', 'pipeline'] : ['push', 'release'];

    // 检查是否已有配置
    const existing = Object.entries(webhookxMap).find(([, v]) => String(v.projectId) === String(project.id) && v.provider === provider);
    let token = existing ? existing[0] : null;

    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      webhookxMap[token] = {
        projectId: String(project.id),
        secret: crypto.randomBytes(20).toString('hex'),
        allowBranches,
        allowEvents,
        provider,
        createdAt: new Date().toISOString(),
      };
      await saveWebhookx();
    }

    const cfg = webhookxMap[token];
    const host = req.get('host') || 'localhost:3456';
    const protocol = req.secure ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/webhookx/receive/${token}`;

    const instructions = provider === 'gitlab'
      ? [
          `1. 打开 GitLab 项目 → Settings → Webhooks`,
          `2. URL 填写: ${webhookUrl}`,
          `3. Secret token 填写: ${cfg.secret}`,
          `4. 勾选触发事件: Push events, Tag push events, Pipeline events`,
          `5. 点击 Add webhook`,
        ]
      : [
          `1. 打开 GitHub 仓库 → Settings → Webhooks → Add webhook`,
          `2. Payload URL: ${webhookUrl}`,
          `3. Content type: application/json`,
          `4. Secret: ${cfg.secret}`,
          `5. 触发事件: push, release（或 Send me everything）`,
          `6. 点击 Add webhook`,
        ];

    res.json({
      success: true,
      data: {
        token: token.slice(0, 8) + '...',
        webhook_url: webhookUrl,
        secret: cfg.secret,
        provider,
        allow_branches: cfg.allowBranches,
        allow_events: cfg.allowEvents,
        project_id: project.id,
        project_name: project.name,
        instructions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 更新 Webhook 过滤配置
 * PATCH /api/webhookx/config/:projectId
 * body: { branches?, events?, provider? }
 */
router.patch('/config/:projectId', async (req, res) => {
  try {
    const pid = String(req.params.projectId);
    const { branches, events, provider } = req.body;
    const entry = Object.entries(webhookxMap).find(([, v]) => v.projectId === pid);
    if (!entry) return res.status(404).json({ error: '未找到 Webhook 配置' });
    const [token, cfg] = entry;
    if (branches) cfg.allowBranches = branches;
    if (events) cfg.allowEvents = events;
    if (provider) cfg.provider = provider;
    webhookxMap[token] = cfg;
    await saveWebhookx();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 列出所有增强 Webhook
 */
router.get('/list', async (req, res) => {
  try {
    const list = await Promise.all(
      Object.entries(webhookxMap).map(async ([token, cfg]) => {
        const project = await ProjectDB.getById(cfg.projectId);
        return {
          token: token.slice(0, 8) + '...',
          project_id: cfg.projectId,
          project_name: project?.name || '(已删除)',
          provider: cfg.provider,
          allow_branches: cfg.allowBranches,
          allow_events: cfg.allowEvents,
          created_at: cfg.createdAt,
        };
      })
    );
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 删除 Webhook
 */
router.delete('/:projectId', async (req, res) => {
  try {
    const pid = String(req.params.projectId);
    const entry = Object.entries(webhookxMap).find(([, v]) => v.projectId === pid);
    if (!entry) return res.status(404).json({ error: '未找到该项目的 Webhook' });
    delete webhookxMap[entry[0]];
    await saveWebhookx();
    res.json({ success: true, message: 'Webhook 已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 核心：接收 GitHub/GitLab 事件
// ============================================================

router.post(
  '/receive/:token',
  express.raw({ type: '*/*', limit: '2mb' }),
  async (req, res) => {
    const { token } = req.params;
    const cfg = webhookxMap[token];

    if (!cfg) {
      logger.warn(`Webhookx: unknown token ${token.slice(0, 8)}...`);
      return res.status(404).json({ error: 'Unknown webhook token' });
    }

    // 快速响应，异步处理
    res.json({ received: true, project_id: cfg.projectId });

    setImmediate(async () => {
      try {
        // ---- 签名验证 ----
        const rawBody = req.body;
        if (cfg.provider === 'github') {
          const sig = req.headers['x-hub-signature-256'];
          if (!verifyGitHubSignature(rawBody, cfg.secret, sig)) {
            logger.warn(`Webhookx: GitHub signature mismatch for project ${cfg.projectId}`);
            return;
          }
        } else if (cfg.provider === 'gitlab') {
          const gitlabToken = req.headers['x-gitlab-token'];
          if (!verifyGitLabToken(cfg.secret, gitlabToken)) {
            logger.warn(`Webhookx: GitLab token mismatch for project ${cfg.projectId}`);
            return;
          }
        }

        const payload = JSON.parse(rawBody.toString());
        const githubEvent = req.headers['x-github-event'];
        const gitlabEvent = req.headers['x-gitlab-event'];

        // ---- 解析事件信息 ----
        const eventInfo = parseEventInfo(cfg.provider, githubEvent, gitlabEvent, payload);
        logger.info(`Webhookx [${cfg.provider}] event: ${eventInfo.eventType}, branch: ${eventInfo.branch}, by: ${eventInfo.actor}`);

        const broadcast = (msg) => {
          logger.info(`[Webhookx:${cfg.projectId}] ${msg}`);
          if (global.broadcastLog) global.broadcastLog(String(cfg.projectId), msg);
        };

        // ---- 分支过滤 ----
        if (cfg.allowBranches.length > 0 && eventInfo.branch &&
            !cfg.allowBranches.includes(eventInfo.branch) &&
            !cfg.allowBranches.includes('*')) {
          broadcast(`⏭️  忽略分支 ${eventInfo.branch}（过滤规则: ${cfg.allowBranches.join('/')}）`);
          return;
        }

        // ---- 事件过滤 ----
        if (cfg.allowEvents.length > 0 && !cfg.allowEvents.includes(eventInfo.eventType) && !cfg.allowEvents.includes('*')) {
          broadcast(`⏭️  忽略事件类型 ${eventInfo.eventType}（过滤规则: ${cfg.allowEvents.join('/')}）`);
          return;
        }

        broadcast(`🔔 ${cfg.provider === 'gitlab' ? 'GitLab' : 'GitHub'} 事件触发: ${eventInfo.eventType} | 分支: ${eventInfo.branch} | 操作者: ${eventInfo.actor}`);
        if (eventInfo.message) broadcast(`💬 ${eventInfo.message}`);

        // ---- 执行流水线 ----
        await runPipeline(cfg.projectId, eventInfo, broadcast);

      } catch (err) {
        logger.error(`Webhookx processing error for project ${cfg.projectId}:`, err);
        if (global.broadcastLog) global.broadcastLog(String(cfg.projectId), `❌ Webhook 处理失败: ${err.message}`);
      }
    });
  }
);

// ============================================================
// 工具函数
// ============================================================

function parseEventInfo(provider, githubEvent, gitlabEvent, payload) {
  if (provider === 'github') {
    const event = githubEvent || 'push';
    return {
      eventType: event,
      branch: (payload.ref || '').replace('refs/heads/', ''),
      actor: payload.pusher?.name || payload.sender?.login || 'unknown',
      commits: payload.commits?.length || 0,
      message: payload.head_commit?.message || payload.release?.name || '',
      tag: (payload.ref || '').startsWith('refs/tags/') ? payload.ref.replace('refs/tags/', '') : null,
    };
  } else {
    // GitLab
    const event = gitlabEvent || 'Push Hook';
    const eventType = event.replace(' Hook', '').toLowerCase().replace(' ', '_');
    return {
      eventType,
      branch: payload.ref ? payload.ref.replace('refs/heads/', '') : (payload.object_attributes?.ref || ''),
      actor: payload.user_name || payload.user?.name || 'unknown',
      commits: payload.commits?.length || 0,
      message: payload.commits?.[0]?.message || payload.object_attributes?.title || '',
      tag: payload.ref?.startsWith('refs/tags/') ? payload.ref.replace('refs/tags/', '') : null,
      pipelineStatus: payload.object_attributes?.status,
    };
  }
}

async function runPipeline(projectId, eventInfo, broadcast) {
  const project = await ProjectDB.getById(projectId);
  if (!project) { broadcast('❌ 项目不存在'); return; }
  if (!project.local_path) { broadcast('⚠️  项目无本地路径，跳过 git pull'); return; }

  // git pull
  const simpleGit = require('simple-git');
  const git = simpleGit(project.local_path);

  broadcast('⬇️  拉取最新代码...');
  try {
    const pullResult = await git.pull();
    const summary = pullResult.files?.length
      ? `${pullResult.files.length} 个文件更新`
      : '已是最新';
    broadcast(`✅ 代码已更新 (${summary})`);
  } catch (err) {
    broadcast(`⚠️  git pull 失败: ${err.message}`);
  }

  // 如果是 release 或 tag，记录一下
  if (eventInfo.tag) {
    broadcast(`🏷️  检测到 Tag: ${eventInfo.tag}`);
  }

  // 如果服务在运行，自动重启
  const { getProcessStatus, restartProject } = require('../services/process-manager');
  const status = getProcessStatus(String(projectId));
  if (status?.status === 'running') {
    broadcast('🔄 服务运行中，自动重启...');
    try {
      await restartProject(project, broadcast);
      broadcast('✅ 重启完成');
    } catch (err) {
      broadcast(`❌ 重启失败: ${err.message}`);
    }
  }

  // 记录日志
  try {
    await DeployLogDB.create({
      project_id: projectId,
      mode: `webhook-${eventInfo.eventType}`,
      status: 'success',
      output: JSON.stringify({ eventInfo }),
      error: null,
    });
  } catch (_) {}

  await ProjectDB.update(projectId, { updated_at: new Date().toISOString() });
  if (global.broadcast) global.broadcast('webhook_pipeline', { projectId, eventType: eventInfo.eventType, branch: eventInfo.branch });
  broadcast(`🎉 流水线执行完成`);
}

module.exports = router;

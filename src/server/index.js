#!/usr/bin/env node
/**
 * GitHub Deploy Assistant (GADA) - 主服务入口
 */

const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');

// 加载环境变量
require('dotenv').config();

// 统一配置
const { PORT, WORK_DIR, LOGS_DIR, DB_PATH } = require('../config');
const DB_DIR = path.dirname(DB_PATH);

// 导入服务
const { initDatabase } = require('../services/database');
const { logger } = require('../utils/logger');
const { loadCustomProviders } = require('../services/ai');
const { recoverProcessState, getAllProcesses } = require('../services/process-manager');
const { startHealthChecker } = require('../services/health-checker');

// 导入路由
const repoRoutes = require('../routes/repo');
const deployRoutes = require('../routes/deploy');
const aiRoutes = require('../routes/ai');
const projectRoutes = require('../routes/project');
const configRoutes = require('../routes/config');
const processRoutes = require('../routes/process');
const systemRoutes = require('../routes/system');
const scanRoutes = require('../routes/scan');
// 新功能路由
const shareRoutes = require('../routes/share');           // 功能19：一键分享部署记录
const remoteRoutes = require('../routes/remote');         // 功能26：远程主机部署
const webhookEnhancedRoutes = require('../routes/webhook-enhanced'); // 功能35：事件驱动 Webhook
const privateRoutes = require('../routes/private');       // 功能40：私有仓库支持
const updateRoutes = require('../routes/update');         // 版本更新&回滚

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// ============================================
// WebSocket 服务
// ============================================
const wss = new WebSocket.Server({ server });

// 存储所有连接的客户端
const wsClients = new Set();

// 最近日志缓存（每个 projectId 保留最近日志，供断线重连后补发）
const { LOG_CACHE_SIZE, LOG_CACHE_TTL } = require('../config');
const logCache = {}; // projectId -> { entries: [{ type, data, time }], lastCleanup: timestamp }

function cacheLog(projectId, msg) {
  if (!logCache[projectId]) {
    logCache[projectId] = { entries: [], lastCleanup: Date.now() };
  }
  
  const cache = logCache[projectId];
  cache.entries.push(msg);
  
  // 清理过期日志（每100条日志检查一次）
  if (cache.entries.length % 100 === 0) {
    const now = Date.now();
    const cutoff = now - LOG_CACHE_TTL;
    cache.entries = cache.entries.filter(entry => entry.time > cutoff);
    cache.lastCleanup = now;
  }
  
  // 限制最大条数
  if (cache.entries.length > LOG_CACHE_SIZE) {
    cache.entries.splice(0, cache.entries.length - LOG_CACHE_SIZE);
  }
}

function getCachedLogs(projectId) {
  if (!logCache[projectId]) return [];
  
  const cache = logCache[projectId];
  const now = Date.now();
  
  // 如果超过30分钟未清理，清理过期日志
  if (now - cache.lastCleanup > 1800000) {
    const cutoff = now - LOG_CACHE_TTL;
    cache.entries = cache.entries.filter(entry => entry.time > cutoff);
    cache.lastCleanup = now;
  }
  
  return cache.entries;
}

wss.on('connection', (ws) => {
  wsClients.add(ws);
  logger.info('WebSocket client connected');

  // 客户端可发送 { type: 'subscribe', projectId } 订阅某项目日志
  // 并立即回放缓存的历史日志
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'subscribe' && msg.projectId) {
        const cached = getCachedLogs(msg.projectId);
        if (cached.length > 0) {
          ws.send(JSON.stringify({ 
            type: 'log_replay', 
            data: cached,
            cache_info: {
              total: cached.length,
              max_size: LOG_CACHE_SIZE,
              ttl_minutes: LOG_CACHE_TTL / 60000
            }
          }));
        } else {
          ws.send(JSON.stringify({ 
            type: 'log_replay', 
            data: [],
            cache_info: { total: 0 }
          }));
        }
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    logger.info('WebSocket client disconnected');
  });
});

/**
 * 向所有 WebSocket 客户端广播消息
 */
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, time: Date.now() });
  wsClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

/**
 * 向特定项目的订阅者推送日志
 */
function broadcastLog(projectId, message, level = 'info') {
  const entry = { projectId, message, level, time: Date.now() };
  cacheLog(String(projectId), { type: 'log', data: entry, time: Date.now() });
  broadcast('log', entry);
}

// 挂载到全局，供其他模块使用
global.broadcastLog = broadcastLog;
global.broadcast = broadcast;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 审计日志中间件
const { auditMiddleware } = require('../services/audit-log');
app.use(auditMiddleware);

// 静态文件
app.use(express.static(path.join(__dirname, '../../public')));

// 确保必要目录存在
fs.ensureDirSync(WORK_DIR);
fs.ensureDirSync(path.join(WORK_DIR, '.backups'));
fs.ensureDirSync(LOGS_DIR);
fs.ensureDirSync(DB_DIR);

// API 路由
app.use('/api/repo', repoRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/config', configRoutes);
app.use('/api/process', processRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/scan', scanRoutes);
const settingsRoutes = require('../routes/settings');
app.use('/api/settings', settingsRoutes);
const searchRoutes = require('../routes/search');
app.use('/api/search', searchRoutes);
const deviceRoutes = require('../routes/device');
app.use('/api/device', deviceRoutes);
const softwareRoutes = require('../routes/software');
app.use('/api/software', softwareRoutes);
const envguideRoutes = require('../routes/envguide');
app.use('/api/envguide', envguideRoutes);
const envRoutes = require('../routes/env');
app.use('/api/env', envRoutes);
const templatesRoutes = require('../routes/templates');
app.use('/api/templates', templatesRoutes);
const dockerRoutes = require('../routes/docker');
app.use('/api/docker', dockerRoutes);
const configIoRoutes = require('../routes/config-io');
app.use('/api/config-io', configIoRoutes);
const webhookRoutes = require('../routes/webhook');
app.use('/api/webhook', webhookRoutes);
const diagnoseRoutes = require('../routes/diagnose');
app.use('/api/diagnose', diagnoseRoutes);
const logsRoutes = require('../routes/logs');
app.use('/api/logs', logsRoutes);
const monitorRoutes = require('../routes/monitor');
app.use('/api/monitor', monitorRoutes);
const networkOptRoutes = require('../routes/network-opt');
app.use('/api/network-opt', networkOptRoutes);

// 新功能路由挂载
app.use('/api/share', shareRoutes);               // 功能19：一键分享部署记录
app.use('/api/remote', remoteRoutes);             // 功能26：远程主机部署
app.use('/api/webhookx', webhookEnhancedRoutes);  // 功能35：事件驱动 Webhook（GitHub/GitLab）
app.use('/api/private', privateRoutes);           // 功能40：私有仓库支持

// 全身自检接口
app.get('/api/selfcheck', async (req, res) => {
  try {
    const { runSelfCheck } = require('../services/self-check');
    const result = await runSelfCheck();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.use('/api/update', updateRoutes);  // 版本更新&回滚路由
// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: require('../../package.json').version });
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 初始化并启动
async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized');

    await loadCustomProviders();
    logger.info('Custom AI providers loaded');

    // 检查私有仓库加密密钥安全性
    const secretKey = process.env.GADA_SECRET_KEY;
    if (!secretKey || secretKey === 'change-me-to-a-random-secret' || secretKey === 'gada-default-secret-key-change-me') {
      logger.warn('⚠️  ============================================');
      logger.warn('⚠️  WARNING: 私有仓库加密密钥安全性问题！');
      logger.warn('⚠️  当前使用的是默认弱密钥或未设置 GADA_SECRET_KEY');
      logger.warn('⚠️  私有仓库的个人访问令牌 (PAT) 加密强度不足');
      logger.warn('⚠️  ');
      logger.warn('⚠️  请执行以下操作提升安全性：');
      logger.warn('⚠️  1. 生成强密钥：');
      logger.warn('⚠️      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      logger.warn('⚠️  2. 将生成的密钥写入 .env 文件：');
      logger.warn('⚠️      GADA_SECRET_KEY=你的强密钥');
      logger.warn('⚠️  3. 重启服务');
      logger.warn('⚠️  ============================================');
    } else if (secretKey.length < 32) {
      logger.warn('⚠️  GADA_SECRET_KEY 长度较短，建议使用至少 32 字节的随机字符串');
    } else {
      logger.info('✅ 私有仓库加密密钥已配置（安全性：良好）');
    }

    // 修复：服务重启后将残留 running 状态重置为 stopped
    await recoverProcessState();
    logger.info('Process state recovered');
    startHealthChecker(getAllProcesses);
    logger.info('Health checker started');

    server.listen(PORT, () => {
      logger.info(`============================================`);
      logger.info(`GitHub Deploy Assistant (GADA) v${require('../../package.json').version}`);
      logger.info(`============================================`);
      logger.info(`Server:    http://localhost:${PORT}`);
      logger.info(`WorkDir:   ${WORK_DIR}`);
      logger.info(`WebSocket: ws://localhost:${PORT}`);
      logger.info(`Press Ctrl+C to stop`);
      logger.info(`============================================`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => { logger.error('Uncaught Exception:', err); process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled Rejection:', err); });

startServer();

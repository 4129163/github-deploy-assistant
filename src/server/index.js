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

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// ============================================
// WebSocket 服务
// ============================================
const wss = new WebSocket.Server({ server });

// 存储所有连接的客户端
const wsClients = new Set();

// 最近日志缓存（每个 projectId 保留最近 200 条，供断线重连后补发）
const LOG_CACHE_SIZE = 200;
const logCache = {}; // projectId -> [{ type, data, time }]

function cacheLog(projectId, msg) {
  if (!logCache[projectId]) logCache[projectId] = [];
  logCache[projectId].push(msg);
  if (logCache[projectId].length > LOG_CACHE_SIZE) logCache[projectId].shift();
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
        const cached = logCache[msg.projectId] || [];
        if (cached.length > 0) {
          ws.send(JSON.stringify({ type: 'log_replay', data: cached }));
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

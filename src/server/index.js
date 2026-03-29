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

wss.on('connection', (ws) => {
  wsClients.add(ws);
  logger.info('WebSocket client connected');
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
  broadcast('log', { projectId, message, level });
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

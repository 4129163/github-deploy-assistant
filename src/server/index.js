#!/usr/bin/env node
/**
 * GitHub Deploy Assistant (GADA) - 主服务入口
 * 提供 Web UI 和 API 服务
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');

// 加载环境变量
require('dotenv').config();

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

// 统一配置
const { PORT, WORK_DIR, LOGS_DIR, DB_PATH } = require('../config');
const DB_DIR = path.dirname(DB_PATH);

// 创建 Express 应用
const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件
app.use(express.static(path.join(__dirname, '../../public')));

// 确保必要目录存在
fs.ensureDirSync(WORK_DIR);
fs.ensureDirSync(LOGS_DIR);
fs.ensureDirSync(DB_DIR);

// API 路由
app.use('/api/repo', repoRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/config', configRoutes);

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

// 初始化数据库并启动服务
async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized');
    
    // 加载自定义 AI 提供商
    await loadCustomProviders();
    
    app.listen(PORT, () => {
      logger.info(`============================================`);
      logger.info(`GitHub Deploy Assistant (GADA) v${require('../../package.json').version}`);
      logger.info(`============================================`);
      logger.info(`Server running at: http://localhost:${PORT}`);
      logger.info(`Working directory: ${WORK_DIR}`);
      logger.info(`Press Ctrl+C to stop`);
      logger.info(`============================================`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

startServer();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3003;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'test-temp-project',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 主端点
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Test Temp Project',
    version: '1.0.0',
    endpoints: [
      { path: '/', method: 'GET', description: 'Welcome message' },
      { path: '/health', method: 'GET', description: 'Health check' },
      { path: '/api/data', method: 'GET', description: 'Sample data' },
      { path: '/api/echo', method: 'POST', description: 'Echo request body' }
    ]
  });
});

// 示例数据端点
app.get('/api/data', (req, res) => {
  res.json({
    data: [
      { id: 1, name: 'Item 1', value: 100 },
      { id: 2, name: 'Item 2', value: 200 },
      { id: 3, name: 'Item 3', value: 300 }
    ],
    count: 3,
    generatedAt: new Date().toISOString()
  });
});

// 回显端点
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`Test Temp Project server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
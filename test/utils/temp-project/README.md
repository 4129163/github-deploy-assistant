# Test Temp Project

这是一个用于集成测试的临时项目模板。

## 功能

- Express.js Web服务器
- 健康检查端点 (`/health`)
- 示例数据API (`/api/data`)
- 回显API (`/api/echo`)
- 完整的错误处理

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 访问应用：
- 主页: http://localhost:3003
- 健康检查: http://localhost:3003/health
- 示例数据: http://localhost:3003/api/data

## API文档

### GET /
返回欢迎信息和API端点列表。

### GET /health
健康检查端点，返回服务状态。

### GET /api/data
返回示例数据。

### POST /api/echo
回显请求体内容。

## 环境变量

- `PORT`: 服务器端口 (默认: 3003)
- `NODE_ENV`: 环境模式 (development, production, test)

## 测试

这个项目用于集成测试，验证"克隆→安装→启动"全流程。

## 许可证

MIT
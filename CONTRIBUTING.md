# 贡献指南

感谢你有兴趣为 GADA 做出贡献！

## 开发环境

```bash
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
npm install
cp .env.example .env
npm run dev   # 开发模式，自动重载
```

访问 http://localhost:3456 查看效果。

## 项目结构

- `src/routes/` — API 路由，每个文件对应一组功能
- `src/services/` — 业务逻辑（AI、部署、进程管理等）
- `public/js/app.js` — 全部前端逻辑（单文件，vanilla JS）
- `public/css/style.css` — 样式

## 提交规范

```
feat: 添加新功能
fix: 修复 Bug
docs: 文档更新
style: 样式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具变更
```

## 提 PR 前

1. `node src/server/index.js` 确认服务能正常启动
2. 检查 API 路由有无报错
3. 前端操作流程走一遍

## 常见贡献方向

- 支持更多项目类型的自动识别
- Windows 一键安装脚本 (`.ps1`)
- 改进 AI 提示词（在 `src/services/ai.js`）
- 性能优化、错误处理
- 翻译文档

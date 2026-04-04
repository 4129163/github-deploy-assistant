# 🚀 安全存储快速使用指南

## 1. 检查安全存储状态

```bash
# 检查系统状态
npm run secure:status

# 或者通过API检查
curl http://localhost:3000/api/secure/status
```

## 2. 初始化安全存储（第一次使用）

```bash
# 运行交互式迁移工具
npm run secure:init

# 或者直接初始化
curl -X POST http://localhost:3000/api/secure/initialize \
  -H "Content-Type: application/json" \
  -d '{"masterPassword": "YourSecurePassword123!"}'
```

## 3. 保存敏感信息

```bash
# 保存GitHub Token
curl -X POST http://localhost:3000/api/secure/save \
  -H "Content-Type: application/json" \
  -d '{
    "masterPassword": "YourSecurePassword123!",
    "key": "github_token",
    "value": "ghp_your_actual_token_here",
    "description": "GitHub Personal Access Token"
  }'
```

## 4. 获取敏感信息

```bash
# 获取存储的GitHub Token
curl -X POST http://localhost:3000/api/secure/get \
  -H "Content-Type: application/json" \
  -d '{
    "masterPassword": "YourSecurePassword123!",
    "key": "github_token"
  }'
```

## 5. 列出所有存储项

```bash
curl -X POST http://localhost:3000/api/secure/list \
  -H "Content-Type: application/json" \
  -d '{"masterPassword": "YourSecurePassword123!"}'
```

## 6. 集成到现有代码

### 替换环境变量使用方式

**之前（不安全）：**
```javascript
const token = process.env.GITHUB_TOKEN;
```

**之后（安全）：**
```javascript
const secureStorage = require('./src/utils/secure-storage');

async function getToken() {
  const result = await secureStorage.get('github_token', 'YourSecurePassword123!');
  return result.value;
}
```

## 7. 常用命令速查表

| 操作 | 命令 |
|------|------|
| **初始化** | `npm run secure:init` |
| **状态检查** | `npm run secure:status` |
| **功能测试** | `npm run secure:test` |
| **保存信息** | `POST /api/secure/save` |
| **获取信息** | `POST /api/secure/get` |
| **列出所有** | `POST /api/secure/list` |
| **删除项目** | `POST /api/secure/delete` |
| **系统健康** | `GET /api/health` |

## 8. 紧急情况处理

### 忘记主密码
```bash
# 需要重置安全存储
# 注意：这会清空所有存储的数据
# 运行前请确认有备份
```

### 存储损坏
```bash
# 从备份恢复
node -e "
const storage = require('./src/utils/secure-storage');
(async () => {
  await storage.restore('./secure-backup.json', 'YourSecurePassword123!');
  console.log('已从备份恢复');
})();
"
```

## 9. 验证安装

```bash
# 运行完整测试
npm run secure:test

# 检查API端点
curl http://localhost:3000/api/health

# 测试保存和获取功能
curl -X POST http://localhost:3000/api/secure/save \
  -H "Content-Type: application/json" \
  -d '{"masterPassword":"test123","key":"test_key","value":"test_value"}'

curl -X POST http://localhost:3000/api/secure/get \
  -H "Content-Type: application/json" \
  -d '{"masterPassword":"test123","key":"test_key"}'
```

## 10. 开始使用

1. **启动服务器**：
   ```bash
   npm start
   ```
   
2. **访问界面**：
   ```
   http://localhost:3000
   ```
   
3. **开始加密存储**：
   - 登录界面
   - 配置安全存储
   - 迁移敏感信息
   - 开始安全部署

---

**🎉 恭喜！您的GitHub Deploy Assistant现在具备企业级安全存储能力。**

**后续步骤：**
- 阅读详细文档：`docs/security-guide.md`
- 备份主密码和恢复密钥
- 配置定期自动备份
- 集成到您的CI/CD流程

**支持：**
- 📚 详细文档：查看`docs/`目录
- 🐛 问题反馈：在Gitee提交Issue
- 💡 功能建议：通过邮件或社区讨论
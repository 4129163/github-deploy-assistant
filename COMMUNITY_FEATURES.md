# 社区协作功能文档

## 概述

GitHub Deploy Assistant 新增了社区协作功能，包括评论与评分系统、问题报告机制，以及与GitHub Issues的自动同步。

## 功能特性

### 1. 评论与评分系统
- **用户评论**: 用户可以对项目进行评论和评分（1-5星）
- **评论投票**: 其他用户可以标记评论为"有帮助"或"无帮助"
- **已验证用户**: 已成功部署过项目的用户会被标记为已验证用户
- **排序功能**: 支持按评分、帮助程度、时间排序

### 2. 问题报告系统
- **一键报告问题**: 用户可以直接在应用中报告问题
- **自动环境收集**: 自动收集用户环境信息（系统、浏览器、版本等）
- **GitHub同步**: 自动创建GitHub Issue并保持同步
- **问题状态管理**: 支持问题状态跟踪（开放、处理中、已解决、已关闭）

### 3. 项目统计
- **实时统计**: 显示项目评分、评论数、问题数等
- **部署统计**: 跟踪项目部署次数
- **问题统计**: 显示开放/已解决问题的数量

## API端点

### 评论相关
- `GET /api/projects/{projectId}/comments` - 获取项目评论
- `POST /api/comments` - 创建评论
- `POST /api/comments/{commentId}/vote` - 投票评论

### 问题相关
- `GET /api/projects/{projectId}/issues` - 获取项目问题
- `POST /api/issues` - 创建问题报告
- `PUT /api/issues/{issueId}` - 更新问题状态
- `POST /api/projects/{projectId}/issues/sync` - 同步GitHub Issues

### 统计相关
- `GET /api/projects/{projectId}/stats` - 获取项目统计信息

## 数据库结构

### comments表
```sql
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    content TEXT NOT NULL,
    rating REAL CHECK (rating >= 0 AND rating <= 5),
    helpful INTEGER DEFAULT 0,
    not_helpful INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### issues表
```sql
CREATE TABLE issues (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    environment TEXT,
    github_issue_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);
```

### comment_votes表
```sql
CREATE TABLE comment_votes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful BOOLEAN,
    voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);
```

## GitHub集成配置

### 1. 创建GitHub Personal Access Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" (classic)
3. 选择权限：`repo`（完全控制私有仓库）
4. 复制生成的token

### 2. 配置环境变量
在 `.env` 文件中设置：
```bash
GITHUB_TOKEN=your_token_here
GITHUB_REPO=owner/repository_name
```

### 3. 自动Issue创建
当用户报告问题时，系统会自动：
1. 收集环境信息
2. 创建格式化的Issue描述
3. 添加适当的标签（bug, enhancement, priority等）
4. 在GitHub仓库中创建Issue
5. 保存Issue链接到本地数据库

## 前端集成示例

### 创建评论
```javascript
const createComment = async (projectId, userName, userEmail, content, rating) => {
    const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId,
            userName,
            userEmail,
            content,
            rating
        })
    });
    return await response.json();
};
```

### 报告问题
```javascript
const reportIssue = async (projectId, title, description, issueType, priority) => {
    // 收集环境信息
    const environment = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0'
    };

    const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId,
            userName: 'Anonymous User',
            userEmail: 'user@example.com',
            title,
            description,
            issueType,
            priority,
            environment: JSON.stringify(environment)
        })
    });
    return await response.json();
};
```

## 环境要求

### 后端依赖
- Go 1.21+
- SQLite3
- GitHub Personal Access Token

### 环境变量
```bash
# 必需
GITHUB_TOKEN
GITHUB_REPO

# 可选
PORT=3000
DB_PATH=./data/gda.db
```

## 测试

### 单元测试
运行测试命令：
```bash
cd backend
go test ./handlers -v
```

### API测试
使用curl测试API：
```bash
# 测试创建评论
curl -X POST http://localhost:3000/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "userName": "Test User",
    "userEmail": "test@example.com",
    "content": "Great project!",
    "rating": 5
  }'

# 测试获取评论
curl http://localhost:3000/api/projects/test-project/comments

# 测试报告问题
curl -X POST http://localhost:3000/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project",
    "userName": "Test User",
    "userEmail": "test@example.com",
    "title": "Installation issue",
    "description": "Cannot install on Windows",
    "issueType": "bug",
    "priority": "high",
    "environment": "{}"
  }'
```

## 故障排除

### 常见问题

1. **GitHub Issue创建失败**
   - 检查GITHUB_TOKEN是否正确
   - 确认GITHUB_REPO格式：owner/repo
   - 验证token是否有repo权限

2. **数据库连接失败**
   - 确保data目录存在且有写入权限
   - 检查SQLite3驱动是否正确安装

3. **API返回404**
   - 确认服务器正在运行
   - 检查路由配置是否正确

### 日志查看
查看应用日志：
```bash
tail -f backend/logs/app.log
```

## 未来扩展计划

### P3功能（计划中）
1. **通知系统**: 邮件/Webhook通知
2. **用户认证**: JWT/OAuth认证
3. **高级搜索**: 评论和问题的全文搜索
4. **数据分析**: 用户行为分析仪表板
5. **移动端支持**: 响应式移动界面

### 安全增强
1. **输入验证**: 更严格的输入验证
2. **速率限制**: API调用频率限制
3. **SQL注入防护**: 参数化查询
4. **XSS防护**: 输出编码

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork仓库
2. 创建功能分支
3. 提交更改
4. 运行测试
5. 创建Pull Request

## 许可证

MIT License
# 审计日志功能说明

## 功能概述
实现了【可靠性-P1】审计日志功能，记录谁（本地用户）、什么时间、做了什么敏感操作（删除项目、改配置、远程部署）。

## 核心特性

### 1. 结构化JSON日志
- 每个审计日志条目都是完整的JSON对象
- 包含时间戳、用户信息、操作类型、风险级别、操作详情
- 支持敏感信息自动过滤（如密码、token等）

### 2. 按日期分文件存储
- 审计日志按日期存储：`logs/audit/audit-YYYY-MM-DD.json`
- 每天自动创建新文件
- 支持日志轮转和清理

### 3. 自动轮转和清理
- 按大小轮转：单个文件超过10MB时自动轮转
- 按时间保留：默认保留90天，可配置
- 自动压缩：旧日志文件自动压缩为.gz格式
- 空间管理：总日志大小超过限制时自动清理最旧文件

### 4. 敏感操作审计
支持以下敏感操作的自动审计：

| 操作类型 | 风险级别 | 审计内容 |
|---------|---------|---------|
| 项目删除 | 高 | 项目ID、名称、路径、保留选项 |
| 配置更新 | 中/高 | 配置键、新旧值、是否敏感 |
| 远程部署 | 高 | 项目信息、目标主机、部署结果 |
| 系统备份 | 中 | 备份类型、大小、文件数量 |
| 系统恢复 | 高 | 备份ID、恢复范围、结果 |
| 服务安装 | 中 | 服务类型、名称、安装路径 |
| 数据导出 | 中 | 导出类型、格式、数据量 |
| 数据删除 | 严重 | 删除类型、范围、释放空间 |

### 5. 用户身份识别
- 自动记录执行操作的用户名
- 记录主机名和平台信息
- 记录进程ID和时间戳

## 集成位置

### API路由集成
1. **项目删除** (`DELETE /api/project/:id/uninstall`)
   - 记录项目删除操作
   - 包含是否保留备份和数据的选项

2. **配置更新** (`POST /api/config/:key`)
   - 记录配置变更
   - 自动识别和过滤敏感配置

3. **远程部署** (`POST /api/remote/deploy/:projectId`)
   - 记录远程部署操作
   - 包含目标主机和部署结果

### 中间件集成
- `auditLogMiddleware`: Express中间件，自动记录敏感API请求
- `wrapCliCommand`: CLI命令包装器，记录命令行操作

## 配置选项

在 `.env` 文件中可配置：

```bash
# 审计日志启用
AUDIT_LOG_ENABLED=true

# 保留策略
AUDIT_LOG_RETENTION_DAYS=90
AUDIT_LOG_MAX_SIZE_MB=50

# 高级功能
AUDIT_LOG_COMPRESSION=true
AUDIT_LOG_ENCRYPTION=false
```

## 使用方法

### 1. 基本使用
```javascript
const { auditLogEnhanced, AUDIT_ACTION_TYPES } = require('./src/services/audit-log-enhanced');

// 记录审计日志
await auditLogEnhanced(AUDIT_ACTION_TYPES.PROJECT_DELETE, {
  project_id: '123',
  project_name: '测试项目',
  reason: '清理旧项目'
});
```

### 2. 查询审计日志
```javascript
const { queryAuditLogs } = require('./src/services/audit-log-enhanced');

// 查询最近100条日志
const logs = await queryAuditLogs({
  limit: 100,
  startDate: new Date('2026-01-01'),
  actionType: 'project_delete'
});
```

### 3. 获取统计信息
```javascript
const { getAuditStats } = require('./src/services/audit-log-enhanced');

// 获取审计统计
const stats = await getAuditStats();
console.log(`总审计条目: ${stats.total_entries}`);
console.log(`成功率: ${stats.success_rate}%`);
```

### 4. 运行测试
```bash
# 运行审计日志功能测试
node test-audit-log.js
```

## 文件结构

```
src/
├── services/
│   └── audit-log-enhanced.js      # 增强版审计日志服务
├── utils/
│   ├── logger.js                  # 更新后的日志模块
│   └── log-rotator-enhanced.js    # 增强版日志轮转器
├── integrations/
│   └── audit-integration.js       # 审计日志集成模块
├── routes/
│   ├── project.js                 # 更新：项目删除审计
│   ├── config.js                  # 更新：配置更新审计
│   └── remote.js                  # 更新：远程部署审计
└── config.js                      # 更新：审计日志配置

logs/
└── audit/                         # 审计日志存储目录
    ├── audit-2026-04-04.json      # 当日审计日志
    ├── audit-2026-04-03.json      # 昨日审计日志
    ├── compressed/                # 压缩文件目录
    └── archived/                  # 归档文件目录
```

## 日志格式示例

```json
{
  "timestamp": "2026-04-04T14:30:25.123Z",
  "timestamp_unix": 1775311825123,
  "log_id": "audit_1775311825123_abc123def",
  "action_type": "project_delete",
  "action_name": "PROJECT DELETE",
  "risk_level": "high",
  "user": {
    "username": "kai0339",
    "uid": 1000,
    "hostname": "workstation-01"
  },
  "system": {
    "platform": "linux",
    "arch": "x64",
    "pid": 12345,
    "node_version": "v18.15.0"
  },
  "details": {
    "project_id": "test-123",
    "project_name": "测试项目",
    "project_path": "/home/user/projects/test",
    "keep_backups": false,
    "keep_data": false
  },
  "result": "success",
  "success": true,
  "duration_ms": 150,
  "resource_usage": {
    "memory_usage_mb": 45.2,
    "uptime_seconds": 3600
  }
}
```

## 监控和维护

### 日志轮转
- 每日自动轮转
- 文件超过10MB时立即轮转
- 自动清理90天前的日志

### 磁盘空间管理
- 单个文件最大50MB
- 总日志目录最大200MB
- 超过限制时自动清理最旧文件

### 性能考虑
- 异步写入，不阻塞主流程
- 批量处理，减少IO操作
- 内存缓存，提高查询速度

## 故障排除

### 常见问题

1. **审计日志未记录**
   - 检查 `AUDIT_LOG_ENABLED` 配置
   - 检查日志目录权限
   - 查看常规日志中的错误信息

2. **磁盘空间不足**
   - 调整 `AUDIT_LOG_MAX_SIZE_MB`
   - 减少 `AUDIT_LOG_RETENTION_DAYS`
   - 手动清理旧日志文件

3. **查询性能慢**
   - 减少查询时间范围
   - 增加索引（如果需要）
   - 使用分页查询

### 调试模式
```bash
# 启用调试日志
DEBUG_AUDIT=true node server.js
```

## 安全考虑

1. **敏感信息保护**
   - 自动过滤密码、token等敏感信息
   - 支持日志加密（可选）
   - 访问权限控制

2. **完整性保障**
   - 日志文件不可修改
   - 时间戳不可伪造
   - 操作记录不可删除

3. **合规性**
   - 满足审计追踪要求
   - 支持数据保留策略
   - 提供查询和导出功能

## 扩展性

### 添加新的审计操作
1. 在 `AUDIT_ACTION_TYPES` 中添加新操作类型
2. 在 `ACTION_RISK_MAPPING` 中设置风险级别
3. 在相应操作点调用 `auditLogEnhanced`

### 自定义存储后端
支持扩展存储到：
- 数据库（MySQL、PostgreSQL）
- 云存储（S3、OSS）
- 日志服务（ELK、Splunk）

### 自定义输出格式
支持输出为：
- JSON（默认）
- CSV
- 纯文本
- 自定义格式

---

**实现状态**: ✅ 已完成  
**测试状态**: ✅ 通过基本测试  
**部署状态**: ✅ 已提交到Gitee仓库  
**维护状态**: 🔄 需要持续监控
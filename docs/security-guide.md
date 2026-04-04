# 🔐 安全存储使用指南

本指南详细说明如何使用GitHub Deploy Assistant的安全存储功能，保护您的敏感信息。

## 📋 目录

1. [安全存储概述](#安全存储概述)
2. [快速开始](#快速开始)
3. [API接口详解](#api接口详解)
4. [代码使用示例](#代码使用示例)
5. [命令行工具](#命令行工具)
6. [最佳实践](#最佳实践)
7. [故障排除](#故障排除)
8. [安全特性](#安全特性)

## 🎯 安全存储概述

### 为什么需要安全存储？

传统的敏感信息存储方式（如环境变量、配置文件）存在以下风险：
- 🔓 明文存储，易被窃取
- 📁 文件权限不当导致泄露
- 🔄 版本控制中意外提交
- 👥 多用户共享时权限混乱

### 安全存储的优势

- **端到端加密**：使用AES-256-GCM算法
- **系统级保护**：利用操作系统密钥链
- **访问控制**：基于主密码的权限验证
- **审计日志**：完整记录所有操作
- **数据完整性**：自动校验数据完整性

### 支持的敏感信息类型

- 🔑 API密钥和令牌（GitHub、OpenAI等）
- 🔐 密码和凭证
- 🗝️ SSH密钥和密码
- 📊 数据库连接字符串
- 🔒 加密密钥

## 🚀 快速开始

### 步骤1：环境检查

首先检查安全存储功能是否可用：

```bash
# 运行功能测试
node test-secure-storage.js
```

### 步骤2：初始化安全存储

如果您是第一次使用，需要初始化安全存储：

```bash
# 运行交互式迁移工具
node scripts/migrate-secure.js
```

按照提示：
1. 设置一个**至少8个字符**的主密码
2. 确认主密码
3. 扫描环境变量中的敏感信息
4. 确认迁移

### 步骤3：验证初始化

检查安全存储状态：

```bash
# 通过API检查状态
curl http://localhost:3000/api/secure/status
```

预期输出：
```json
{
  "initialized": true,
  "storageDir": "/Users/username/.gada/secure",
  "algorithm": "AES-256-GCM",
  "keyDerivation": "PBKDF2-SHA256 (100,000 iterations)",
  "maxAttempts": 5,
  "lockDuration": "15 minutes"
}
```

## 📡 API接口详解

### 基础信息

- **基础URL**: `http://localhost:3000/api/secure`
- **认证方式**: 主密码（通过请求体传递）
- **加密算法**: AES-256-GCM
- **密钥派生**: PBKDF2-SHA256（100,000次迭代）

### API端点列表

#### 1. 初始化安全存储
```http
POST /api/secure/initialize
```

**请求体：**
```json
{
  "masterPassword": "YourSecurePassword123!"
}
```

**响应：**
```json
{
  "success": true,
  "message": "安全存储初始化成功",
  "info": {
    "storageDir": "/Users/username/.gada/secure",
    "initializedAt": "2026-04-04T07:30:00.000Z"
  }
}
```

#### 2. 保存敏感信息
```http
POST /api/secure/save
```

**请求体：**
```json
{
  "masterPassword": "YourSecurePassword123!",
  "key": "github_token",
  "value": "ghp_your_actual_token_here",
  "description": "GitHub Personal Access Token",
  "tags": ["github", "api"],
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

#### 3. 获取敏感信息
```http
POST /api/secure/get
```

**请求体：**
```json
{
  "masterPassword": "YourSecurePassword123!",
  "key": "github_token"
}
```

**响应：**
```json
{
  "success": true,
  "value": "ghp_your_actual_token_here",
  "metadata": {
    "description": "GitHub Personal Access Token",
    "tags": ["github", "api"],
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "encryptedAt": "2026-04-04T07:31:00.000Z"
  },
  "storageInfo": {
    "createdAt": "2026-04-04T07:30:00.000Z",
    "lastAccessed": "2026-04-04T07:32:00.000Z",
    "accessCount": 3,
    "size": 40
  }
}
```

#### 4. 列出所有存储项
```http
POST /api/secure/list
```

#### 5. 删除存储项
```http
POST /api/secure/delete
```

#### 6. 从环境变量迁移
```http
POST /api/secure/migrate
```

#### 7. 获取存储统计
```http
POST /api/secure/stats
```

#### 8. 获取状态
```http
GET /api/secure/status
```

#### 9. 健康检查
```http
GET /api/health
```

## 💻 代码使用示例

### JavaScript示例

#### 基本使用
```javascript
const secureStorage = require('./src/utils/secure-storage');

async function secureUsage() {
  // 检查是否已初始化
  if (!secureStorage.isInitialized()) {
    console.log('安全存储未初始化');
    return;
  }
  
  // 保存敏感信息
  await secureStorage.save(
    'openai_api_key',
    'sk-your-openai-key-here',
    'your-master-password',
    {
      description: 'OpenAI API Key',
      tags: ['ai', 'openai'],
      expiresAt: '2027-01-01T00:00:00.000Z'
    }
  );
  
  // 获取敏感信息
  const result = await secureStorage.get(
    'openai_api_key',
    'your-master-password'
  );
  
  console.log('API密钥:', result.value);
}
```

#### 集成到现有代码
```javascript
// 替换原来的环境变量使用方式

// 之前：
const token = process.env.GITHUB_TOKEN;

// 之后：
const secureStorage = require('./src/utils/secure-storage');
const token = await secureStorage.get('github_token', 'master-password');
```

### Python集成示例

```python
import requests
import json

class SecureStorageClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def save(self, key, value, master_password, metadata=None):
        url = f"{self.base_url}/api/secure/save"
        data = {
            "masterPassword": master_password,
            "key": key,
            "value": value
        }
        
        if metadata:
            data.update(metadata)
        
        response = requests.post(url, json=data)
        return response.json()
    
    def get(self, key, master_password):
        url = f"{self.base_url}/api/secure/get"
        data = {
            "masterPassword": master_password,
            "key": key
        }
        
        response = requests.post(url, json=data)
        return response.json()

# 使用示例
client = SecureStorageClient()
result = client.get("github_token", "your-master-password")
print("令牌:", result["value"])
```

### Node.js Express集成

```javascript
const express = require('express');
const secureStorage = require('./src/utils/secure-storage');

const app = express();
app.use(express.json());

// 保护的路由
app.post('/api/protected/deploy', async (req, res) => {
  try {
    const { masterPassword, projectId } = req.body;
    
    // 从安全存储获取必要的信息
    const githubToken = await secureStorage.get('github_token', masterPassword);
    const openaiKey = await secureStorage.get('openai_key', masterPassword);
    
    // 使用敏感信息执行部署
    // ... 部署逻辑
    
    res.json({ success: true, message: '部署成功' });
  } catch (error) {
    res.status(401).json({ error: '认证失败' });
  }
});
```

## 🛠️ 命令行工具

### 迁移工具

主要迁移工具，支持交互式和批处理模式：

```bash
# 交互式迁移（推荐）
node scripts/migrate-secure.js

# 预览将要迁移的内容
node scripts/migrate-secure.js --dry-run

# 帮助信息
node scripts/migrate-secure.js --help
```

### 批量操作脚本

#### 批量保存示例
```javascript
// scripts/batch-save.js
const secureStorage = require('../src/utils/secure-storage');

const sensitiveData = {
  'github_token': 'ghp_xxx',
  'openai_key': 'sk-xxx',
  'database_url': 'postgresql://user:pass@localhost/db'
};

async function batchSave(masterPassword) {
  for (const [key, value] of Object.entries(sensitiveData)) {
    await secureStorage.save(key, value, masterPassword, {
      description: `批量导入: ${key}`,
      tags: ['batch-import', 'initial-setup']
    });
    console.log(`已保存: ${key}`);
  }
}
```

#### 备份和恢复
```javascript
// scripts/backup.js
const secureStorage = require('../src/utils/secure-storage');
const fs = require('fs-extra');

async function backup(masterPassword) {
  const backupFile = await secureStorage.backup(
    `./backup-${Date.now()}.json`,
    masterPassword
  );
  console.log(`备份已创建: ${backupFile}`);
}

async function restore(backupFile, masterPassword) {
  await secureStorage.restore(backupFile, masterPassword);
  console.log('已从备份恢复');
}
```

## 📝 最佳实践

### 密码管理

1. **主密码要求**
   - 🔒 至少12个字符
   - 🔄 包含大小写字母、数字、特殊符号
   - 🚫 避免使用字典词汇、生日、简单序列
   - 💾 使用密码管理器保存

2. **定期更换**
   - 📅 每3-6个月更换主密码
   - 🔄 更换后重新加密所有数据
   - 📊 记录更换历史

### 数据分类

1. **按敏感度分级**
   ```javascript
   const dataClassification = {
     'level1': ['api_keys', 'tokens'],      // 最高敏感度
     'level2': ['passwords', 'credentials'], // 中等敏感度
     'level3': ['configs', 'urls']           // 一般敏感度
   };
   ```

2. **按项目分组**
   ```javascript
   const projectGroups = {
     'project1': ['project1_token', 'project1_key'],
     'project2': ['project2_token', 'project2_key']
   };
   ```

### 访问控制

1. **最小权限原则**
   ```javascript
   // 仅授予必要权限
   const userPermissions = {
     'developer': ['read_api_keys'],
     'admin': ['read_write_all'],
     'guest': ['read_public']
   };
   ```

2. **操作审计**
   ```javascript
   const auditLog = {
     timestamp: new Date().toISOString(),
     user: 'user123',
     action: 'get_sensitive_data',
     key: 'github_token',
     success: true,
     ip: '192.168.1.100'
   };
   ```

### 备份策略

1. **定期备份**
   ```bash
   # 每周自动备份
   0 2 * * 0 node scripts/backup.js
   ```

2. **多地备份**
   ```javascript
   const backupLocations = [
     '~/backups/secure-storage',
     '/mnt/nas/backups/gada',
     's3://my-bucket/secure-backups'
   ];
   ```

## 🔧 故障排除

### 常见问题

#### Q1: 主密码错误

**错误信息：**
```
主密码错误或密钥文件损坏
```

**解决方案：**
1. 确认输入的主密码正确
2. 检查大小写和特殊字符
3. 如果忘记密码，需要重置安全存储

#### Q2: 安全存储未初始化

**错误信息：**
```
安全存储未初始化，请先调用 /api/secure/initialize
```

**解决方案：**
```bash
# 运行初始化
curl -X POST http://localhost:3000/api/secure/initialize \
  -H "Content-Type: application/json" \
  -d '{"masterPassword": "your-password"}'
```

#### Q3: 存储项不存在

**错误信息：**
```
未找到存储项: key_name
```

**解决方案：**
1. 检查键名拼写
2. 列出所有存储项确认
   ```bash
   curl -X POST http://localhost:3000/api/secure/list \
     -H "Content-Type: application/json" \
     -d '{"masterPassword": "your-password"}'
   ```

#### Q4: 存储空间不足

**症状：**
- 保存操作失败
- 系统日志显示磁盘空间错误

**解决方案：**
1. 清理不需要的存储项
2. 增加磁盘空间
3. 使用外部存储

### 错误代码参考

| 错误代码 | 含义 | 解决方案 |
|---------|------|---------|
| `STORAGE_NOT_INITIALIZED` | 安全存储未初始化 | 调用 `/api/secure/initialize` |
| `MISSING_MASTER_PASSWORD` | 未提供主密码 | 在请求体中包含主密码 |
| `MISSING_KEY_OR_VALUE` | 缺少键名或值 | 提供完整的键值对 |
| `ITEM_NOT_FOUND` | 存储项不存在 | 检查键名或重新保存 |
| `SAVE_FAILED` | 保存失败 | 检查磁盘空间和权限 |
| `GET_FAILED` | 获取失败 | 验证主密码和键名 |

### 调试模式

启用详细日志：

```javascript
// 在代码中启用调试
process.env.DEBUG_SECURE_STORAGE = 'true';

// 或在启动时设置环境变量
DEBUG_SECURE_STORAGE=true node server.js
```

## 🛡️ 安全特性

### 加密算法

#### AES-256-GCM
- **密钥长度**: 256位
- **IV长度**: 128位
- **认证标签**: 16字节
- **优点**: 同时提供加密和完整性验证

#### PBKDF2 密钥派生
- **迭代次数**: 100,000次
- **盐值长度**: 16字节
- **哈希算法**: SHA-256
- **作用**: 防止暴力破解攻击

### 访问控制

#### 密码保护
- 🔒 主密码验证所有操作
- 🚫 5次失败后锁定15分钟
- 📊 完整的访问审计

#### 权限验证
- 👮 每次操作都需要认证
- 📝 详细的错误提示
- 🔄 自动会话管理

### 数据完整性

#### 校验机制
- 🔍 SHA-256 哈希验证
- 🛡️ 防止数据篡改
- 🔄 自动修复检测

#### 备份保护
- 💾 加密备份文件
- 🔑 独立的备份密码
- 📊 完整的备份历史

### 系统集成

#### 多平台支持
- 🍎 macOS: Keychain
- 🪟 Windows: Credential Manager
- 🐧 Linux: libsecret / kwallet
- 💾 备用: 本地加密文件

#### 开发友好
- 📚 完整的API文档
- 💻 多语言客户端
- 🧪 集成测试套件

---

## 🎉 开始使用

现在您已经了解了安全存储的所有功能，可以开始使用了：

1. **初始化**: 运行迁移工具设置安全存储
2. **迁移**: 将现有的敏感信息迁移到安全存储
3. **集成**: 在代码中使用安全存储API
4. **测试**: 验证所有功能正常工作
5. **监控**: 定期检查存储状态和备份

如有问题，请查阅本文档或联系支持团队。祝您使用愉快！ 🚀
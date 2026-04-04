# 🔌 GitHub Deploy Assistant API 指南

**完整的API参考文档，支持自动化集成**

<p align="center">
  <img src="https://img.shields.io/badge/API版本-v1.0.0-blue" alt="API版本">
  <img src="https://img.shields.io/badge/认证方式-Bearer_Token-green" alt="认证方式">
  <img src="https://img.shields.io/badge/格式-JSON-yellow" alt="格式">
</p>

## 📋 目录

1. [快速开始](#-快速开始)
2. [认证与授权](#-认证与授权)
3. [项目管理API](#-项目管理api)
4. [部署API](#-部署api)
5. [监控API](#-监控api)
6. [诊断API](#-诊断api)
7. [备份API](#-备份api)
8. [Webhook API](#-webhook-api)
9. [错误处理](#-错误处理)
10. [API客户端示例](#-api客户端示例)

---

## 🚀 快速开始

### API基础信息
```
基础URL: http://localhost:3000/api
文档地址: http://localhost:3000/api-docs
默认端口: 3000
API版本: v1
数据格式: JSON
```

### 获取API令牌
```bash
# 使用curl获取令牌
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

**响应示例**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "def50200..."
}
```

### 使用API令牌
```bash
# 在所有API请求中添加Authorization头
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/projects
```

---

## 🔐 认证与授权

### 认证方式

#### 1. Bearer Token（推荐）
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. API Key
```http
X-API-Key: your_api_key_here
```

#### 3. Basic Auth
```http
Authorization: Basic base64(username:password)
```

### 权限级别

| 角色 | 权限 | 说明 |
|------|------|------|
| **admin** | 所有操作 | 完全控制权 |
| **user** | 项目管理 | 只能管理自己的项目 |
| **viewer** | 只读 | 只能查看，不能修改 |
| **api** | API访问 | 只能通过API访问 |

### 获取用户信息
```http
GET /api/auth/me
```

**响应**：
```json
{
  "id": "user-123",
  "username": "admin",
  "email": "admin@example.com",
  "role": "admin",
  "permissions": ["*"],
  "created_at": "2026-04-01T00:00:00Z"
}
```

### 刷新令牌
```http
POST /api/auth/refresh
Content-Type: application/json
```
```json
{
  "refresh_token": "your_refresh_token"
}
```

---

## 📁 项目管理API

### 获取项目列表
```http
GET /api/projects
```

**查询参数**：
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `page` | integer | 页码 | 1 |
| `pageSize` | integer | 每页数量 | 20 |
| `status` | string | 状态过滤 | all |
| `type` | string | 类型过滤 | all |
| `search` | string | 搜索关键词 | "" |
| `sort` | string | 排序字段 | created_at |
| `order` | string | 排序方向 | desc |

**响应**：
```json
{
  "projects": [
    {
      "id": "project-1",
      "name": "my-react-app",
      "description": "React应用示例",
      "type": "react",
      "status": "running",
      "port": 3000,
      "url": "http://localhost:3000",
      "memory_usage": 256,
      "cpu_usage": 25.5,
      "created_at": "2026-04-04T10:30:00Z",
      "updated_at": "2026-04-04T14:30:00Z",
      "owner": "user-123",
      "tags": ["frontend", "react"]
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "stats": {
    "total": 45,
    "running": 12,
    "stopped": 30,
    "error": 3
  }
}
```

### 获取单个项目
```http
GET /api/projects/{id}
```

**路径参数**：
- `id`: 项目ID

**响应**：
```json
{
  "id": "project-1",
  "name": "my-react-app",
  "description": "React应用示例",
  "repo_url": "https://github.com/facebook/react",
  "repo_branch": "main",
  "type": "react",
  "status": "running",
  "port": 3000,
  "url": "http://localhost:3000",
  
  "config": {
    "env": "production",
    "memory_limit": "512mb",
    "cpu_limit": "1",
    "start_command": "npm start",
    "build_command": "npm run build"
  },
  
  "resources": {
    "memory_usage": 256,
    "cpu_usage": 25.5,
    "disk_usage": 1024,
    "uptime": 86400
  },
  
  "metadata": {
    "created_at": "2026-04-04T10:30:00Z",
    "updated_at": "2026-04-04T14:30:00Z",
    "last_started": "2026-04-04T14:30:00Z",
    "last_stopped": null,
    "deploy_count": 5
  },
  
  "owner": "user-123",
  "tags": ["frontend", "react"],
  "permissions": ["start", "stop", "restart", "delete"]
}
```

### 创建项目
```http
POST /api/projects
Content-Type: application/json
```
```json
{
  "name": "my-new-project",
  "repo_url": "https://github.com/example/project",
  "repo_branch": "main",
  "type": "nodejs",
  "port": 3000,
  "config": {
    "env": "development",
    "memory_limit": "256mb",
    "start_command": "node app.js"
  },
  "tags": ["backend", "api"]
}
```

**响应**：
```json
{
  "id": "project-new-1",
  "name": "my-new-project",
  "status": "creating",
  "message": "项目创建中",
  "created_at": "2026-04-04T15:00:00Z"
}
```

### 更新项目
```http
PUT /api/projects/{id}
Content-Type: application/json
```
```json
{
  "name": "更新后的项目名",
  "description": "更新描述",
  "config": {
    "port": 4000,
    "env": "production"
  },
  "tags": ["updated", "production"]
}
```

### 删除项目
```http
DELETE /api/projects/{id}
```

**响应**：
```json
{
  "id": "project-1",
  "status": "deleting",
  "message": "项目删除中",
  "deleted_at": "2026-04-04T15:05:00Z"
}
```

### 项目操作

#### 启动项目
```http
POST /api/projects/{id}/start
```

#### 停止项目
```http
POST /api/projects/{id}/stop
```

#### 重启项目
```http
POST /api/projects/{id}/restart
```

#### 获取项目日志
```http
GET /api/projects/{id}/logs
```

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `lines` | 日志行数 | 100 |
| `level` | 日志级别 | all |
| `search` | 搜索关键词 | "" |
| `since` | 开始时间 | 1小时前 |
| `until` | 结束时间 | 现在 |

---

## 🚀 部署API

### 部署项目
```http
POST /api/deploy
Content-Type: application/json
```
```json
{
  "repo_url": "https://github.com/facebook/react",
  "branch": "main",
  "config": {
    "name": "my-react-app",
    "port": 3000,
    "env": "production",
    "memory": "512mb",
    "cpu": "1"
  },
  "options": {
    "skip_precheck": false,
    "auto_start": true,
    "notify": true
  }
}
```

**响应**：
```json
{
  "job_id": "deploy-job-123",
  "status": "pending",
  "message": "部署任务已创建",
  "project_id": "project-new-1",
  "created_at": "2026-04-04T15:10:00Z",
  "estimated_duration": 300,
  "progress_url": "/api/deploy/deploy-job-123/progress"
}
```

### 获取部署状态
```http
GET /api/deploy/{job_id}
```

**响应**：
```json
{
  "job_id": "deploy-job-123",
  "status": "running",
  "progress": 65,
  "current_step": "installing_dependencies",
  "message": "正在安装依赖...",
  "project_id": "project-new-1",
  
  "steps": [
    {
      "name": "clone_repository",
      "status": "completed",
      "started_at": "2026-04-04T15:10:05Z",
      "completed_at": "2026-04-04T15:10:15Z",
      "duration": 10
    },
    {
      "name": "analyze_project",
      "status": "completed",
      "started_at": "2026-04-04T15:10:15Z",
      "completed_at": "2026-04-04T15:10:25Z",
      "duration": 10
    },
    {
      "name": "install_dependencies",
      "status": "running",
      "started_at": "2026-04-04T15:10:25Z",
      "completed_at": null,
      "duration": null
    }
  ],
  
  "estimated_completion": "2026-04-04T15:15:00Z",
  "started_at": "2026-04-04T15:10:00Z",
  "updated_at": "2026-04-04T15:11:30Z"
}
```

### 取消部署
```http
POST /api/deploy/{job_id}/cancel
```

### 获取部署历史
```http
GET /api/deploy/history
```

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `project_id` | 项目ID | "" |
| `status` | 状态过滤 | all |
| `limit` | 限制数量 | 50 |
| `offset` | 偏移量 | 0 |

---

## 📊 监控API

### 获取系统状态
```http
GET /api/monitor/system
```

**响应**：
```json
{
  "timestamp": "2026-04-04T15:20:00Z",
  
  "cpu": {
    "usage": 45.2,
    "cores": 4,
    "load_average": [1.2, 1.5, 1.8],
    "temperature": 65.5,
    "frequency": 3200
  },
  
  "memory": {
    "total": 8589934592,
    "used": 4294967296,
    "free": 4294967296,
    "available": 5153960755,
    "usage": 50.0,
    "swap_total": 2147483648,
    "swap_used": 1073741824,
    "swap_free": 1073741824,
    "swap_usage": 50.0
  },
  
  "disk": [
    {
      "device": "/dev/sda1",
      "mount": "/",
      "total": 536870912000,
      "used": 214748364800,
      "free": 322122547200,
      "usage": 40.0,
      "type": "ext4"
    }
  ],
  
  "network": {
    "interfaces": [
      {
        "name": "eth0",
        "bytes_sent": 1073741824,
        "bytes_recv": 2147483648,
        "packets_sent": 1000000,
        "packets_recv": 2000000,
        "errors_in": 0,
        "errors_out": 0
      }
    ],
    "total_bytes_sent": 1073741824,
    "total_bytes_recv": 2147483648
  },
  
  "system": {
    "uptime": 86400,
    "boot_time": "2026-04-03T15:20:00Z",
    "processes": 256,
    "users": 2,
    "os": "Linux 5.15.0",
    "hostname": "server-1"
  }
}
```

### 获取项目监控
```http
GET /api/projects/{id}/monitor
```

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `duration` | 时间范围 | 1h |
| `interval` | 数据间隔 | 1m |
| `metrics` | 指标列表 | all |

**响应**：
```json
{
  "project_id": "project-1",
  "timestamp": "2026-04-04T15:20:00Z",
  
  "current": {
    "status": "running",
    "uptime": 3600,
    "pid": 12345,
    
    "cpu": {
      "usage": 25.5,
      "user": 15.2,
      "system": 10.3
    },
    
    "memory": {
      "rss": 268435456,
      "heap_used": 134217728,
      "heap_total": 268435456,
      "external": 16777216
    },
    
    "network": {
      "connections": 25,
      "requests_per_second": 120,
      "bytes_per_second": 102400
    }
  },
  
  "history": {
    "timestamps": [
      "2026-04-04T14:20:00Z",
      "2026-04-04T14:25:00Z",
      "2026-04-04T14:30:00Z"
    ],
    
    "cpu_usage": [20.1, 22.5, 25.5],
    "memory_usage": [250, 255, 256],
    "request_rate": [100, 110, 120],
    "response_time": [105, 110, 115]
  },
  
  "alerts": [
    {
      "level": "warning",
      "message": "内存使用率超过80%",
      "metric": "memory_usage",
      "value": 85.5,
      "threshold": 80.0,
      "timestamp": "2026-04-04T15:15:00Z"
    }
  ]
}
```

### 获取历史数据
```http
GET /api/monitor/history
```

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `metric` | 指标名称 | cpu_usage |
| `start` | 开始时间 | 1小时前 |
| `end` | 结束时间 | 现在 |
| `interval` | 间隔 | 1m |

---

## 🩺 诊断API

### 运行诊断
```http
POST /api/diagnose
Content-Type: application/json
```
```json
{
  "project_id": "project-1",
  "checks": ["all"],
  "options": {
    "deep_scan": true,
    "fix_issues": false
  }
}
```

**支持的检查项**：
- `system`: 系统环境检查
- `project`: 项目状态检查
- `network`: 网络连接检查
- `security`: 安全检查
- `performance`: 性能检查
- `dependencies`: 依赖检查
- `all`: 所有检查

### 获取诊断结果
```http
GET /api/diagnose/{job_id}
```

**响应**：
```json
{
  "job_id": "diagnose-job-123",
  "status": "completed",
  "project_id": "project-1",
  "started_at": "2026-04-04T15:25:00Z",
  "completed_at": "2026-04-04T15:26:30Z",
  "duration": 90,
  
  "summary": {
    "total_checks": 25,
    "passed": 20,
    "warnings": 3,
    "errors": 2,
    "score": 80.0
  },
  
  "results": [
    {
      "check": "port_availability",
      "status": "passed",
      "message": "端口3000可用",
      "details": {
        "port": 3000,
        "available": true
      }
    },
    {
      "check": "memory_usage",
      "status": "warning",
      "message": "内存使用率过高",
      "details": {
        "current": 85.5,
        "threshold": 80.0,
        "recommendation": "增加内存限制或优化代码"
      }
    },
    {
      "check": "node_version",
      "status": "error",
      "message": "Node.js版本过旧",
      "details": {
        "current": "16.0.0",
        "required": "18.0.0",
        "recommendation": "升级到Node.js 18+"
      }
    }
  ],
  
  "recommendations": [
    {
      "priority": "high",
      "action": "upgrade_node",
      "description": "升级Node.js到18.0.0或更高版本",
      "command": "nvm install 18 && nvm use 18"
    },
    {
      "priority": "medium",
      "action": "increase_memory",
      "description": "增加项目内存限制到1GB",
      "command": "修改配置 memory_limit=1gb"
    }
  ]
}
```

### 一键修复
```http
POST /api/fix
Content-Type: application/json
```
```json
{
  "project_id": "project-1",
  "issues": ["node_version", "memory_usage"],
  "options": {
    "confirm": true,
    "backup": true
  }
}
```

---

## 💾 备份API

### 创建备份
```http
POST /api/backup
Content-Type: application/json
```
```json
{
  "project_id": "project-1",
  "name": "manual-backup-20260404",
  "description": "手动创建的备份",
  "options": {
    "include_logs": true,
    "include_database": true,
    "compression": "zip",
    "encryption": "aes-256"
  }
}
```

### 获取备份列表
```http
GET /api/backup
```

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `project_id` | 项目ID | "" |
| `limit` | 限制数量 | 50 |
| `offset` | 偏移量 | 0 |

### 恢复备份
```http
POST /api/backup/{backup_id}/restore
Content-Type: application/json
```
```json
{
  "project_id": "project-1",
  "options": {
    "overwrite": true,
    "restore_config": true,
    "restore_data": true,
    "create_backup": true
  }
}
```

### 删除备份
```http
DELETE /api/backup/{backup_id}
```

---

## 🔔 Webhook API

### 创建Webhook
```http
POST /api/webhooks
Content-Type: application/json
```
```json
{
  "name": "github-webhook",
  "url": "https://api.github.com/repos/owner/repo/hooks",
  "events": ["push", "pull_request"],
  "secret": "your_webhook_secret",
  "active": true,
  "config": {
    "content_type": "json",
    "insecure_ssl": "0"
  }
}
```

### 测试Webhook
```http
POST /api/webhooks/{id}/test
```

### 获取Webhook日志
```http
GET /api/webhooks/{id}/logs
```

### GitHub Webhook示例

**GitHub配置**：
```
URL: http://your-server/api/webhook/github
Content-Type: application/json
Secret: your_secret_here
Events: push, pull_request
```

**GitHub推送事件示例**：
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "owner/repo",
    "html_url": "https://github.com/owner/repo"
  },
  "commits": [
    {
      "id": "abc123",
      "message": "Update README",
      "timestamp": "2026-04-04T15:30:00Z"
    }
  ]
}
```

**自动部署响应**：
```json
{
  "status": "triggered",
  "message": "GitHub push事件触发部署",
  "deployment_id": "deploy-123",
  "project": "my-project",
  "branch": "main",
  "commit": "abc123"
}
```

---

## ❌ 错误处理

### 错误响应格式
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "请求参数无效",
    "details": {
      "field": "repo_url",
      "reason": "必须是有效的GitHub URL"
    },
    "timestamp": "2026-04-04T15:35:00Z",
    "request_id": "req-123456"
  }
}
```

### 常见错误代码

| 状态码 | 错误代码 | 说明 |
|--------|----------|------|
| 400 | `INVALID_REQUEST` | 请求参数无效 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `FORBIDDEN` | 权限不足 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突 |
| 422 | `VALIDATION_ERROR` | 验证失败 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 502 | `BAD_GATEWAY` | 网关错误 |
| 503 | `SERVICE_UNAVAILABLE` | 服务不可用 |

### 重试策略
```javascript
// 建议的重试策略
const retryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1秒
  maxDelay: 10000,    // 10秒
  backoffFactor: 2,
  retryOn: [429, 500, 502, 503, 504]
};
```

---

## 💻 API客户端示例

### Python客户端
```python
import requests
from typing import Dict, Any

class GADAClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def get_projects(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """获取项目列表"""
        response = self.session.get(
            f'{self.base_url}/api/projects',
            params={'page': page, 'pageSize': page_size}
        )
        response.raise_for_status()
        return response.json()
    
    def deploy_project(self, repo_url: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """部署项目"""
        payload = {
            'repo_url': repo_url,
            'config': config
        }
        response = self.session.post(
            f'{self.base_url}/api/deploy',
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def get_deployment_status(self, job_id: str) -> Dict[str, Any]:
        """获取部署状态"""
        response = self.session.get(
            f'{self.base_url}/api/deploy/{job_id}'
        )
        response.raise_for_status()
        return response.json()
    
    def start_project(self, project_id: str) -> Dict[str, Any]:
        """启动项目"""
        response = self.session.post(
            f'{self.base_url}/api/projects/{project_id}/start'
        )
        response.raise_for_status()
        return response.json()
    
    def stop_project(self, project_id: str) -> Dict[str, Any]:
        """停止项目"""
        response = self.session.post(
            f'{self.base_url}/api/projects/{project_id}/stop'
        )
        response.raise_for_status()
        return response.json()
    
    def get_project_logs(self, project_id: str, lines: int = 100) -> Dict[str, Any]:
        """获取项目日志"""
        response = self.session.get(
            f'{self.base_url}/api/projects/{project_id}/logs',
            params={'lines': lines}
        )
        response.raise_for_status()
        return response.json()

# 使用示例
client = GADAClient('http://localhost:3000', 'your_api_key')

# 部署新项目
deployment = client.deploy_project(
    'https://github.com/facebook/react',
    {'name': 'my-react-app', 'port': 3000}
)

# 监控部署进度
while True:
    status = client.get_deployment_status(deployment['job_id'])
    if status['status'] in ['completed', 'failed', 'cancelled']:
        break
    print(f"进度: {status['progress']}% - {status['message']}")
    time.sleep(5)
```

### JavaScript/Node.js客户端
```javascript
const axios = require('axios');

class GADAClient {
  constructor(baseUrl, apiKey) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async getProjects(page = 1, pageSize = 20) {
    const response = await this.client.get('/api/projects', {
      params: { page, pageSize }
    });
    return response.data;
  }

  async deployProject(repoUrl, config) {
    const response = await this.client.post('/api/deploy', {
      repo_url: repoUrl,
      config
    });
    return response.data;
  }

  async getDeploymentStatus(jobId) {
    const response = await this.client.get(`/api/deploy/${jobId}`);
    return response.data;
  }

  async startProject(projectId) {
    const response = await this.client.post(`/api/projects/${projectId}/start`);
    return response.data;
  }

  async stopProject(projectId) {
    const response = await this.client.post(`/api/projects/${projectId}/stop`);
    return response.data;
  }

  async getProjectLogs(projectId, lines = 100) {
    const response = await this.client.get(`/api/projects/${projectId}/logs`, {
      params: { lines }
    });
    return response.data;
  }

  async waitForDeployment(jobId, interval = 5000) {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getDeploymentStatus(jobId);
          
          if (['completed', 'failed', 'cancelled'].includes(status.status)) {
            resolve(status);
          } else {
            console.log(`进度: ${status.progress}% - ${status.message}`);
            setTimeout(checkStatus, interval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  }
}

// 使用示例
const client = new GADAClient('http://localhost:3000', 'your_api_key');

async function deployExample() {
  try {
    // 部署项目
    const deployment = await client.deployProject(
      'https://github.com/facebook/react',
      { name: 'my-react-app', port: 3000 }
    );

    console.log('部署开始:', deployment.job_id);

    // 等待部署完成
    const result = await client.waitForDeployment(deployment.job_id);
    
    if (result.status === 'completed') {
      console.log('部署成功!');
      console.log('项目ID:', result.project_id);
    } else {
      console.log('部署失败:', result.message);
    }
  } catch (error) {
    console.error('部署失败:', error.message);
  }
}

deployExample();
```

### Bash/Shell脚本
```bash
#!/bin/bash

# 配置
BASE_URL="http://localhost:3000"
API_KEY="your_api_key_here"

# 函数：API请求
gada_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    curl -s -X "$method" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        ${data:+--data "$data"} \
        "$BASE_URL/api/$endpoint"
}

# 获取项目列表
get_projects() {
    gada_request "GET" "projects?page=1&pageSize=20"
}

# 部署项目
deploy_project() {
    local repo_url="$1"
    local project_name="$2"
    local port="${3:-3000}"
    
    local data=$(cat <<EOF
{
    "repo_url": "$repo_url",
    "config": {
        "name": "$project_name",
        "port": $port
    }
}
EOF
)
    
    gada_request "POST" "deploy" "$data"
}

# 获取部署状态
get_deployment_status() {
    local job_id="$1"
    gada_request "GET" "deploy/$job_id"
}

# 启动项目
start_project() {
    local project_id="$1"
    gada_request "POST" "projects/$project_id/start"
}

# 停止项目
stop_project() {
    local project_id="$1"
    gada_request "POST" "projects/$project_id/stop"
}

# 使用示例
echo "获取项目列表..."
get_projects | jq '.'

echo "部署React项目..."
deployment=$(deploy_project "https://github.com/facebook/react" "my-react-app" 3000)
job_id=$(echo "$deployment" | jq -r '.job_id')
echo "部署任务ID: $job_id"

# 等待部署完成
while true; do
    status=$(get_deployment_status "$job_id")
    progress=$(echo "$status" | jq -r '.progress')
    message=$(echo "$status" | jq -r '.message')
    
    echo "进度: $progress% - $message"
    
    if [[ $(echo "$status" | jq -r '.status') =~ ^(completed|failed|cancelled)$ ]]; then
        break
    fi
    
    sleep 5
done

echo "部署完成!"
```

### PowerShell脚本
```powershell
# GitHub Deploy Assistant PowerShell客户端

$BaseUrl = "http://localhost:3000"
$ApiKey = "your_api_key_here"

function Invoke-GADARequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = $null
    )
    
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
        "Content-Type" = "application/json"
    }
    
    $uri = "$BaseUrl/api/$Endpoint"
    
    if ($Body) {
        $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Body
    } else {
        $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
    }
    
    return $response
}

function Get-GADAProjects {
    param(
        [int]$Page = 1,
        [int]$PageSize = 20
    )
    
    $endpoint = "projects?page=$Page&pageSize=$PageSize"
    return Invoke-GADARequest -Method GET -Endpoint $endpoint
}

function Start-GADADeployment {
    param(
        [string]$RepoUrl,
        [string]$ProjectName,
        [int]$Port = 3000
    )
    
    $body = @{
        repo_url = $RepoUrl
        config = @{
            name = $ProjectName
            port = $Port
        }
    } | ConvertTo-Json
    
    return Invoke-GADARequest -Method POST -Endpoint "deploy" -Body $body
}

function Get-GADADeploymentStatus {
    param([string]$JobId)
    
    return Invoke-GADARequest -Method GET -Endpoint "deploy/$JobId"
}

function Wait-GADADeployment {
    param(
        [string]$JobId,
        [int]$Interval = 5
    )
    
    do {
        $status = Get-GADADeploymentStatus -JobId $JobId
        Write-Host "进度: $($status.progress)% - $($status.message)"
        
        if ($status.status -in @('completed', 'failed', 'cancelled')) {
            break
        }
        
        Start-Sleep -Seconds $Interval
    } while ($true)
    
    return $status
}

# 使用示例
Write-Host "获取项目列表..." -ForegroundColor Green
$projects = Get-GADAProjects
$projects.projects | Format-Table -AutoSize

Write-Host "部署React项目..." -ForegroundColor Green
$deployment = Start-GADADeployment -RepoUrl "https://github.com/facebook/react" -ProjectName "my-react-app" -Port 3000
Write-Host "部署任务ID: $($deployment.job_id)"

Write-Host "等待部署完成..." -ForegroundColor Yellow
$result = Wait-GADADeployment -JobId $deployment.job_id

if ($result.status -eq 'completed') {
    Write-Host "部署成功!" -ForegroundColor Green
    Write-Host "项目ID: $($result.project_id)" -ForegroundColor Cyan
} else {
    Write-Host "部署失败: $($result.message)" -ForegroundColor Red
}
```

---

## 📚 最佳实践

### 1. 错误处理
```javascript
// 良好的错误处理
try {
  const result = await client.deployProject(repoUrl, config);
  
  // 检查响应状态
  if (result.status === 'failed') {
    throw new Error(`部署失败: ${result.message}`);
  }
  
  // 处理成功响应
  console.log('部署成功:', result);
  
} catch (error) {
  // 处理网络错误
  if (error.response) {
    console.error('API错误:', error.response.data.error);
  } else if (error.request) {
    console.error('网络错误:', error.message);
  } else {
    console.error('请求错误:', error.message);
  }
  
  // 重试逻辑
  if (shouldRetry(error)) {
    await retryOperation();
  }
}
```

### 2. 异步操作处理
```javascript
// 使用Promise处理异步操作
async function deployAndMonitor(repoUrl, config) {
  // 开始部署
  const deployment = await client.deployProject(repoUrl, config);
  
  // 轮询状态
  const result = await pollDeploymentStatus(deployment.job_id);
  
  // 处理结果
  if (result.status === 'completed') {
    // 启动项目
    await client.startProject(result.project_id);
    
    // 等待项目就绪
    await waitForProjectReady(result.project_id);
    
    return { success: true, projectId: result.project_id };
  } else {
    return { success: false, error: result.message };
  }
}

// 轮询函数
async function pollDeploymentStatus(jobId, interval = 5000, timeout = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const status = await client.getDeploymentStatus(jobId);
    
    if (['completed', 'failed', 'cancelled'].includes(status.status)) {
      return status;
    }
    
    await sleep(interval);
  }
  
  throw new Error('部署超时');
}
```

### 3. 批量操作
```javascript
// 批量部署多个项目
async function batchDeploy(projects) {
  const results = [];
  
  for (const project of projects) {
    try {
      const result = await deployAndMonitor(project.repoUrl, project.config);
      results.push({ ...project, ...result });
    } catch (error) {
      results.push({ ...project, success: false, error: error.message });
    }
    
    // 避免过载
    await sleep(1000);
  }
  
  return results;
}

// 并发控制
async function concurrentDeploy(projects, maxConcurrent = 3) {
  const results = [];
  const queue = [...projects];
  
  const workers = Array(maxConcurrent).fill().map(async () => {
    while (queue.length > 0) {
      const project = queue.shift();
      try {
        const result = await deployAndMonitor(project.repoUrl, project.config);
        results.push({ ...project, ...result });
      } catch (error) {
        results.push({ ...project, success: false, error: error.message });
      }
    }
  });
  
  await Promise.all(workers);
  return results;
}
```

### 4. 日志和监控
```javascript
// 添加日志记录
class LoggingGADAClient extends GADAClient {
  constructor(baseUrl, apiKey, logger) {
    super(baseUrl, apiKey);
    this.logger = logger;
  }
  
  async deployProject(repoUrl, config) {
    this.logger.info('开始部署', { repoUrl, config });
    
    try {
      const startTime = Date.now();
      const result = await super.deployProject(repoUrl, config);
      const duration = Date.now() - startTime;
      
      this.logger.info('部署完成', {
        jobId: result.job_id,
        duration,
        success: true
      });
      
      return result;
    } catch (error) {
      this.logger.error('部署失败', {
        repoUrl,
        error: error.message,
        success: false
      });
      
      throw error;
    }
  }
}
```

---

## 🔧 集成示例

### 与GitHub Actions集成
```yaml
name: Deploy with GADA

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Deploy to GADA
      run: |
        curl -X POST "${{ secrets.GADA_URL }}/api/deploy" \
          -H "Authorization: Bearer ${{ secrets.GADA_API_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{
            "repo_url": "${{ github.repositoryUrl }}",
            "branch": "${{ github.ref }}",
            "config": {
              "name": "${{ github.event.repository.name }}",
              "port": 3000,
              "env": "production"
            }
          }'
```

### 与Jenkins集成
```groovy
pipeline {
    agent any
    
    environment {
        GADA_URL = 'http://localhost:3000'
        GADA_API_KEY = credentials('gada-api-key')
    }
    
    stages {
        stage('Deploy') {
            steps {
                script {
                    def response = httpRequest(
                        contentType: 'APPLICATION_JSON',
                        httpMode: 'POST',
                        url: "${env.GADA_URL}/api/deploy",
                        headers: [
                            [name: 'Authorization', value: "Bearer ${env.GADA_API_KEY}"]
                        ],
                        requestBody: """
                        {
                            "repo_url": "${env.GIT_URL}",
                            "config": {
                                "name": "${env.JOB_NAME}",
                                "port": 3000,
                                "env": "production"
                            }
                        }
                        """
                    )
                    
                    def result = readJSON text: response.content
                    echo "部署任务ID: ${result.job_id}"
                    
                    // 等待部署完成
                    waitForDeployment(result.job_id)
                }
            }
        }
    }
}
```

### 与Docker集成
```dockerfile
# 使用GADA API的Docker镜像
FROM node:18-alpine

# 安装curl和jq
RUN apk add --no-cache curl jq

# 复制部署脚本
COPY deploy.sh /usr/local/bin/deploy.sh
RUN chmod +x /usr/local/bin/deploy.sh

# 设置环境变量
ENV GADA_URL=http://localhost:3000
ENV GADA_API_KEY=

# 入口点
ENTRYPOINT ["/usr/local/bin/deploy.sh"]
```

```bash
#!/bin/bash
# deploy.sh

# 部署项目
response=$(curl -s -X POST "$GADA_URL/api/deploy" \
  -H "Authorization: Bearer $GADA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "'"$REPO_URL"'",
    "config": {
      "name": "'"$PROJECT_NAME"'",
      "port": '"${PORT:-3000}"'
    }
  }')

job_id=$(echo "$response" | jq -r '.job_id')
echo "部署任务ID: $job_id"

# 等待部署完成
while true; do
  status=$(curl -s -X GET "$GADA_URL/api/deploy/$job_id" \
    -H "Authorization: Bearer $GADA_API_KEY")
  
  progress=$(echo "$status" | jq -r '.progress')
  message=$(echo "$status" | jq -r '.message')
  
  echo "进度: $progress% - $message"
  
  if [[ $(echo "$status" | jq -r '.status') =~ ^(completed|failed|cancelled)$ ]]; then
    break
  fi
  
  sleep 5
done
```

---

## 📞 支持与反馈

### API问题排查
1. **检查认证**：确保API令牌有效且未过期
2. **验证URL**：确认API地址正确
3. **查看日志**：检查服务器日志获取详细信息
4. **测试连接**：使用curl测试基本连接

### 获取帮助
- 📚 [完整文档](https://gitee.com/kai0339/github-deploy-assistant)
- 🐛 [API问题反馈](https://gitee.com/kai0339/github-deploy-assistant/issues)
- 💬 [社区讨论](https://gitee.com/kai0339/github-deploy-assistant/issues)

### 版本信息
```http
GET /api/version
```

**响应**：
```json
{
  "version": "1.0.0",
  "api_version": "v1",
  "build_date": "2026-04-04",
  "commit_hash": "abc123def",
  "features": ["projects", "deploy", "monitor", "backup", "webhooks"]
}
```

---

<p align="center">
  <strong>API文档版本: 1.0.0</strong><br>
  <sub>最后更新: 2026年4月4日</sub>
</p>

<p align="center">
  <sub>如需更多帮助，请查阅完整文档或联系支持</sub>
</p>
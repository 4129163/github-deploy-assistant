# AI 智能诊断闭环功能设计文档

## 功能概述
为 Gitee 部署助手增加 AI 智能诊断闭环功能，当部署失败时自动截取错误日志 → 发送给 AI → 返回修复建议（附"一键修复"按钮）。修复操作需用户确认后再执行。

## 核心流程

```
部署失败 → 自动捕获错误日志 → AI 分析诊断 → 返回修复建议 → 用户确认 → 执行修复
```

## 影响模块

1. **`ai.js` 增强** - 新增部署错误诊断功能
2. **错误处理中间件** - 自动捕获和转发错误日志
3. **前端修复流程** - 提供一键修复按钮和确认机制

## 详细设计

### 1. ai.js 增强 - 新增错误诊断函数

#### 函数签名
```javascript
/**
 * 分析部署错误日志，生成修复建议
 * @param {Object} projectInfo - 项目信息 {name, repo_url, project_type, local_path}
 * @param {string} errorLog - 错误日志内容
 * @param {string} command - 失败的命令
 * @param {string} provider - AI 提供商（可选）
 * @returns {Promise<Object>} - 修复建议对象
 */
async function diagnoseDeploymentError(projectInfo, errorLog, command, provider = null)
```

#### 返回格式
```javascript
{
  "analysis": "详细错误原因分析",
  "suggestion": "修复步骤说明",
  "auto_fixable": true/false,
  "fix_commands": ["command1", "command2"], // 可自动执行的命令数组
  "risk_level": "LOW/MEDIUM/HIGH", // 修复风险等级
  "estimated_time": "1分钟", // 预计修复时间
  "required_permissions": ["file_write", "package_install"] // 所需权限
}
```

#### AI Prompt 设计
```
你是一个专业的 DevOps 工程师，擅长分析项目部署错误并给出修复方案。

项目信息：
- 名称: {project.name}
- 仓库: {project.repo_url}
- 类型: {project.project_type}
- 失败命令: {command}

错误日志：
{errorLog}

请分析错误原因并给出修复建议。考虑以下方面：
1. 依赖问题（npm/pip/composer）
2. 环境配置问题
3. 权限问题
4. 网络问题
5. 代码语法错误
6. 配置文件缺失

返回 JSON 格式：
{
  "analysis": "错误原因分析（1-3句话）",
  "suggestion": "修复步骤说明（给用户看的文字）",
  "auto_fixable": true/false,
  "fix_commands": ["可自动执行的命令", "必须按顺序执行"],
  "risk_level": "LOW/MEDIUM/HIGH",
  "estimated_time": "预计修复时间",
  "required_permissions": ["所需权限"]
}
```

### 2. 错误处理中间件

#### 位置：`src/middleware/deploy-error-catcher.js`

#### 功能
- 拦截部署过程中的错误输出
- 自动捕获关键错误日志（最后100行）
- 调用 AI 诊断服务
- 将诊断结果保存到数据库
- 向前端推送诊断通知

#### 集成点
- 部署服务 (`src/services/deploy.js`) 的 `executeCommand` 函数
- WebSocket 实时日志推送
- 错误处理器 (`src/utils/error-handler.js`)

### 3. 前端修复流程

#### 新组件
1. **AI 诊断面板** (`public/ai-diagnose.html`)
   - 显示错误摘要
   - 显示 AI 诊断结果
   - 一键修复按钮（不同风险等级不同颜色）
   - 执行进度展示

2. **确认对话框** (`public/js/confirm-dialog.js`)
   - 显示修复命令预览
   - 风险提示
   - 用户确认机制

3. **修复执行器** (`public/js/auto-fixer.js`)
   - 按顺序执行修复命令
   - 实时显示执行结果
   - 错误回滚机制

#### 流程
1. 部署失败时自动跳转到诊断页面
2. 显示 AI 分析结果和修复建议
3. 用户点击"一键修复"按钮
4. 弹出确认对话框显示修复详情
5. 用户确认后按顺序执行修复命令
6. 显示执行进度和结果
7. 修复成功后提供重新部署选项

## 数据库设计

### 新增表：`deployment_diagnoses`

```sql
CREATE TABLE deployment_diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  deployment_id INTEGER, -- 关联的部署记录
  error_log TEXT NOT NULL,
  failed_command TEXT NOT NULL,
  ai_diagnosis TEXT NOT NULL, -- JSON格式的诊断结果
  applied_fix TEXT, -- 实际应用的修复命令
  fix_result TEXT, -- 修复执行结果
  risk_level TEXT CHECK(risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT CHECK(status IN ('PENDING', 'ANALYZED', 'CONFIRMED', 'APPLIED', 'SUCCESS', 'FAILED', 'ROLLED_BACK')) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (deployment_id) REFERENCES deployment_logs (id)
);
```

## API 设计

### 1. 错误诊断接口
```
POST /api/ai/deploy-diagnose
{
  "project_id": 123,
  "error_log": "...",
  "command": "npm install"
}

返回：
{
  "success": true,
  "data": {
    "diagnosis_id": 456,
    "analysis": "...",
    "suggestion": "...",
    "auto_fixable": true,
    "fix_commands": [...],
    "risk_level": "LOW"
  }
}
```

### 2. 应用修复接口
```
POST /api/ai/apply-fix/:diagnosis_id
{
  "confirmation_token": "user_generated_token" // 用户确认token
}

返回：
{
  "success": true,
  "data": {
    "execution_id": 789,
    "status": "EXECUTING",
    "commands": [...],
    "progress": 0
  }
}
```

### 3. 获取修复状态
```
GET /api/ai/fix-status/:execution_id

返回：
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "progress": 100,
    "results": [...],
    "next_action": "redeploy"
  }
}
```

## 安全考虑

### 命令执行白名单
- 只允许执行安全的修复命令
- 禁止执行 `rm -rf`、`chmod 777` 等危险命令
- 命令参数严格验证

### 用户确认机制
- 修复前必须用户明确确认
- 高风险操作需要二次确认
- 提供回滚选项

### 权限控制
- 修复命令执行需要相应权限
- 文件修改需要备份原文件
- 数据库操作需要事务支持

## 实现计划

### Phase 1: 核心 AI 诊断功能
1. 增强 `ai.js` 服务，新增 `diagnoseDeploymentError` 函数
2. 创建错误诊断数据库表
3. 实现诊断结果保存和查询

### Phase 2: 错误捕获中间件
1. 创建部署错误捕获中间件
2. 集成到现有部署流程
3. 添加 WebSocket 通知

### Phase 3: 前端修复流程
1. 创建 AI 诊断页面
2. 实现一键修复按钮和确认机制
3. 添加修复执行进度展示

### Phase 4: 测试和优化
1. 单元测试和集成测试
2. 性能优化和错误处理
3. 用户界面优化

## 依赖分析

### 现有依赖
- `express` - Web 框架
- `axios` - HTTP 客户端
- `socket.io` - 实时通信
- `sqlite3` - 数据库

### 新增依赖
- 无需新增主要依赖，使用现有技术栈

## 风险评估

### 技术风险
- AI 诊断准确率
- 命令执行安全性
- 并发处理能力

### 缓解措施
- 严格的命令白名单
- 多级用户确认机制
- 完善的错误回滚
- 详细的执行日志

## 成功指标

1. **功能完整性**
   - 错误日志自动捕获率 > 95%
   - AI 诊断准确率 > 80%
   - 修复成功率 > 70%

2. **性能指标**
   - 诊断响应时间 < 5秒
   - 页面加载时间 < 2秒
   - 并发处理能力 > 10个/分钟

3. **用户体验**
   - 用户确认率 > 60%
   - 修复满意度 > 4/5分
   - 使用频率 > 3次/周

---

**作者**: AI Agent  
**日期**: 2026-04-04  
**版本**: 1.0.0
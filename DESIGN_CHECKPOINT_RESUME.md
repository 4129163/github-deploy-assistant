# 断点续传功能设计文档

## 1. 功能概述
为GitHub Deploy Assistant添加断点续传功能，当部署中途失败（如网络中断）时，下次点击"继续部署"能从中断步骤恢复，而不是从头克隆。

**优先级**: P1 (可靠性)
**影响模块**: 状态机 + 临时文件标记

## 2. 当前部署流程分析

### 2.1 部署阶段
根据 `deploy-log.js` 分析，部署分为以下阶段：
1. **INIT** - 初始化
2. **CLONE** - 克隆仓库
3. **INSTALL** - 安装依赖
4. **BUILD** - 构建项目
5. **START** - 启动服务
6. **COMPLETE** - 部署完成
7. **ERROR** - 部署错误

### 2.2 状态管理现状
- 前端通过 `DeployLogStream` 类管理部署状态
- 每个阶段有 `pending`, `active`, `completed`, `failed` 四种状态
- 状态仅在内存中维护，未持久化

## 3. 断点续传设计方案

### 3.1 核心需求
1. **状态持久化**: 将部署状态保存到本地文件系统
2. **断点检测**: 能够检测到上次部署中断的位置
3. **恢复机制**: 从断点处继续执行，跳过已完成步骤
4. **临时文件管理**: 保存中间文件，避免重复下载

### 3.2 状态持久化方案

#### 3.2.1 状态文件结构
```json
{
  "projectId": "uuid",
  "projectName": "项目名称",
  "repositoryUrl": "git仓库URL",
  "targetPath": "部署路径",
  "currentStage": "clone",
  "stages": {
    "init": {
      "status": "completed",
      "startTime": "2026-04-04T14:20:00Z",
      "endTime": "2026-04-04T14:20:05Z",
      "checkpointData": {}
    },
    "clone": {
      "status": "failed",
      "startTime": "2026-04-04T14:20:05Z",
      "endTime": null,
      "checkpointData": {
        "partialFiles": ["file1.txt", "file2.txt"],
        "bytesDownloaded": 1024000,
        "totalBytes": 2048000
      }
    }
  },
  "checkpointFile": "/tmp/deploy-checkpoint-{projectId}.json",
  "createdAt": "2026-04-04T14:20:00Z",
  "lastUpdated": "2026-04-04T14:20:30Z"
}
```

#### 3.2.2 临时文件标记方案
1. **克隆阶段**: 使用 `.git/partial-clone` 标记部分克隆
2. **安装阶段**: 使用 `node_modules/.partial-install` 标记部分安装
3. **构建阶段**: 使用 `dist/.partial-build` 标记部分构建

### 3.3 恢复流程设计

#### 3.3.1 检测恢复点
```javascript
// 伪代码
function detectResumePoint(projectId) {
  // 1. 检查是否存在状态文件
  const stateFile = `./deploy-states/${projectId}.json`;
  if (!fs.existsSync(stateFile)) return null;
  
  // 2. 读取状态文件
  const state = JSON.parse(fs.readFileSync(stateFile));
  
  // 3. 检查最后失败的阶段
  for (const stage of ['clone', 'install', 'build', 'start']) {
    if (state.stages[stage] && state.stages[stage].status === 'failed') {
      return {
        stage: stage,
        state: state
      };
    }
  }
  
  return null;
}
```

#### 3.3.2 阶段恢复策略
1. **CLONE阶段恢复**:
   - 检查 `.git` 目录是否存在
   - 如果存在部分克隆，使用 `git fetch --continue`
   - 否则重新克隆

2. **INSTALL阶段恢复**:
   - 检查 `node_modules` 目录
   - 如果存在部分安装，使用 `npm install --no-audit`
   - 否则重新安装

3. **BUILD阶段恢复**:
   - 检查构建输出目录
   - 如果存在部分构建，使用增量构建
   - 否则重新构建

### 3.4 前端界面变更

#### 3.4.1 新增"继续部署"按钮
- 在项目列表中显示"继续部署"按钮（当有未完成部署时）
- 按钮状态：启用/禁用（根据是否有可恢复的部署）

#### 3.4.2 部署状态显示
- 在项目卡片上显示部署状态："部署中"、"可恢复"、"已完成"
- 显示上次中断的阶段和时间

### 3.5 API接口设计

#### 3.5.1 新增API端点
1. **GET /api/deploy/resume-points** - 获取可恢复的部署列表
2. **POST /api/deploy/resume/:projectId** - 继续部署
3. **GET /api/deploy/state/:projectId** - 获取部署状态
4. **DELETE /api/deploy/state/:projectId** - 清除部署状态

#### 3.5.2 修改现有API
1. **POST /api/deploy** - 增加状态文件创建
2. **WebSocket事件** - 增加断点续传相关事件

## 4. 实现计划

### 4.1 第一阶段：状态持久化模块
1. 创建状态管理类 `DeployStateManager`
2. 实现状态文件的读写操作
3. 添加状态变更监听

### 4.2 第二阶段：断点检测与恢复
1. 实现各阶段的断点检测逻辑
2. 实现阶段恢复策略
3. 添加临时文件标记机制

### 4.3 第三阶段：前端界面集成
1. 添加"继续部署"按钮
2. 实现状态显示
3. 集成恢复API调用

### 4.4 第四阶段：测试与优化
1. 单元测试
2. 集成测试
3. 性能优化

## 5. 技术细节

### 5.1 状态文件存储位置
```
./deploy-states/           # 部署状态文件目录
  ├── {projectId}.json     # 项目部署状态
  └── checkpoints/         # 检查点备份
```

### 5.2 临时文件标记
- 使用隐藏文件标记部分完成的操作
- 标记文件包含进度信息和时间戳
- 定期清理过期的临时标记

### 5.3 错误处理
- 状态文件损坏时的恢复机制
- 临时文件冲突处理
- 网络中断重试策略

## 6. 风险评估与缓解

### 6.1 风险点
1. **状态文件不一致**: 可能导致恢复错误
2. **临时文件残留**: 可能影响新部署
3. **并发部署冲突**: 同一项目同时部署

### 6.2 缓解措施
1. **状态文件验证**: 添加校验和和时间戳
2. **自动清理机制**: 定期清理过期状态
3. **部署锁机制**: 防止并发部署冲突

## 7. 验收标准

### 7.1 功能验收
1. ✅ 部署中断后能检测到可恢复点
2. ✅ 点击"继续部署"能从断点恢复
3. ✅ 恢复过程跳过已完成步骤
4. ✅ 临时文件被正确利用

### 7.2 性能验收
1. ✅ 恢复部署时间 < 重新部署时间的50%
2. ✅ 状态文件读写不影响正常部署
3. ✅ 内存使用增加 < 10MB

### 7.3 可靠性验收
1. ✅ 状态文件损坏时能安全恢复
2. ✅ 网络中断后能继续恢复
3. ✅ 并发操作不会导致数据损坏

---

**设计完成时间**: 2026-04-04
**设计者**: AI Assistant
**版本**: 1.0
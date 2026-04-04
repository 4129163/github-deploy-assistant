/**
 * 部署实时日志管理器
 * 为部署过程提供 WebSocket 实时日志流功能
 */

const { logger } = require('../utils/logger');
const { LOG_CACHE_SIZE, LOG_CACHE_TTL } = require('../config');

// 部署日志缓存
const deployLogCache = new Map();

/**
 * 部署阶段定义
 */
const DEPLOY_STAGES = {
  INIT: 'init',
  CLONE: 'clone',
  INSTALL: 'install',
  BUILD: 'build',
  START: 'start',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * 部署阶段描述
 */
const STAGE_DESCRIPTIONS = {
  [DEPLOY_STAGES.INIT]: '初始化部署',
  [DEPLOY_STAGES.CLONE]: '克隆仓库',
  [DEPLOY_STAGES.INSTALL]: '安装依赖',
  [DEPLOY_STAGES.BUILD]: '构建项目',
  [DEPLOY_STAGES.START]: '启动服务',
  [DEPLOY_STAGES.COMPLETE]: '部署完成',
  [DEPLOY_STAGES.ERROR]: '部署错误'
};

/**
 * 初始化部署日志流
 */
function initDeployLogStream(projectId, projectName) {
  const streamId = `deploy_${projectId}_${Date.now()}`;
  const stream = {
    id: streamId,
    projectId,
    projectName,
    startTime: Date.now(),
    currentStage: DEPLOY_STAGES.INIT,
    stages: {},
    logs: [],
    subscribers: new Set(),
    isActive: true
  };

  deployLogCache.set(streamId, stream);
  
  // 广播部署开始
  broadcastDeployEvent(projectId, {
    type: 'deploy_started',
    streamId,
    projectId,
    projectName,
    time: Date.now(),
    message: `开始部署项目: ${projectName}`
  });

  // 记录初始日志
  logDeployStage(streamId, DEPLOY_STAGES.INIT, `开始部署项目: ${projectName}`);

  return streamId;
}

/**
 * 记录部署阶段日志
 */
function logDeployStage(streamId, stage, message, data = {}) {
  const stream = deployLogCache.get(streamId);
  if (!stream) {
    logger.warn(`Deploy stream not found: ${streamId}`);
    return;
  }

  stream.currentStage = stage;
  
  if (!stream.stages[stage]) {
    stream.stages[stage] = {
      startTime: Date.now(),
      endTime: null,
      logs: []
    };
  }

  const logEntry = {
    time: Date.now(),
    stage,
    message,
    data,
    level: stage === DEPLOY_STAGES.ERROR ? 'error' : 'info'
  };

  stream.stages[stage].logs.push(logEntry);
  stream.logs.push(logEntry);

  // 广播日志
  broadcastDeployLog(stream.projectId, logEntry);

  // 广播阶段更新
  if (stage !== DEPLOY_STAGES.ERROR) {
    broadcastDeployEvent(stream.projectId, {
      type: 'stage_update',
      streamId,
      projectId: stream.projectId,
      stage,
      stageName: STAGE_DESCRIPTIONS[stage],
      message,
      time: Date.now()
    });
  }

  // 清理过期日志
  cleanupStreamLogs(stream);
}

/**
 * 记录部署进度
 */
function logDeployProgress(streamId, progress, total = 100) {
  const stream = deployLogCache.get(streamId);
  if (!stream) return;

  const percentage = Math.min(100, Math.max(0, Math.round((progress / total) * 100)));
  
  broadcastDeployEvent(stream.projectId, {
    type: 'progress_update',
    streamId,
    projectId: stream.projectId,
    progress: percentage,
    current: progress,
    total,
    time: Date.now()
  });
}

/**
 * 完成部署阶段
 */
function completeDeployStage(streamId, stage, success = true, message = '') {
  const stream = deployLogCache.get(streamId);
  if (!stream) return;

  if (stream.stages[stage]) {
    stream.stages[stage].endTime = Date.now();
    stream.stages[stage].success = success;
    
    const duration = stream.stages[stage].endTime - stream.stages[stage].startTime;
    const durationText = formatDuration(duration);

    const logMessage = message || `${STAGE_DESCRIPTIONS[stage]} ${success ? '完成' : '失败'} (${durationText})`;
    logDeployStage(streamId, stage, logMessage, { success, duration });
  }
}

/**
 * 完成整个部署
 */
function completeDeployStream(streamId, success = true, message = '') {
  const stream = deployLogCache.get(streamId);
  if (!stream) return;

  stream.isActive = false;
  stream.endTime = Date.now();
  stream.success = success;

  const totalDuration = stream.endTime - stream.startTime;
  const durationText = formatDuration(totalDuration);

  const finalMessage = message || (success 
    ? `部署完成 (${durationText})` 
    : `部署失败 (${durationText})`);

  logDeployStage(streamId, success ? DEPLOY_STAGES.COMPLETE : DEPLOY_STAGES.ERROR, finalMessage, {
    success,
    totalDuration,
    stages: Object.keys(stream.stages).map(stage => ({
      stage,
      name: STAGE_DESCRIPTIONS[stage],
      startTime: stream.stages[stage].startTime,
      endTime: stream.stages[stage].endTime,
      duration: stream.stages[stage].endTime ? stream.stages[stage].endTime - stream.stages[stage].startTime : null,
      success: stream.stages[stage].success,
      logCount: stream.stages[stage].logs.length
    }))
  });

  // 广播部署完成
  broadcastDeployEvent(stream.projectId, {
    type: 'deploy_completed',
    streamId,
    projectId: stream.projectId,
    success,
    message: finalMessage,
    duration: totalDuration,
    time: Date.now()
  });

  // 清理过期的部署流（保留最近10个）
  setTimeout(() => cleanupExpiredStreams(), 0);
}

/**
 * 订阅部署日志
 */
function subscribeToDeployLog(projectId, ws) {
  const activeStreams = Array.from(deployLogCache.values())
    .filter(stream => stream.projectId === projectId && stream.isActive);
  
  if (activeStreams.length > 0) {
    const stream = activeStreams[0];
    stream.subscribers.add(ws);
    
    // 发送当前状态
    ws.send(JSON.stringify({
      type: 'deploy_status',
      streamId: stream.id,
      projectId: stream.projectId,
      currentStage: stream.currentStage,
      stageName: STAGE_DESCRIPTIONS[stream.currentStage],
      startTime: stream.startTime,
      isActive: stream.isActive,
      stages: Object.keys(stream.stages).map(stage => ({
        stage,
        name: STAGE_DESCRIPTIONS[stage],
        startTime: stream.stages[stage].startTime,
        endTime: stream.stages[stage].endTime,
        success: stream.stages[stage].success
      }))
    }));

    // 发送最近日志
    const recentLogs = stream.logs.slice(-50); // 发送最近50条日志
    if (recentLogs.length > 0) {
      ws.send(JSON.stringify({
        type: 'log_replay',
        data: recentLogs,
        cache_info: {
          total: stream.logs.length,
          recent: recentLogs.length
        }
      }));
    }
  }
}

/**
 * 取消订阅部署日志
 */
function unsubscribeFromDeployLog(projectId, ws) {
  const activeStreams = Array.from(deployLogCache.values())
    .filter(stream => stream.projectId === projectId);
  
  activeStreams.forEach(stream => {
    stream.subscribers.delete(ws);
  });
}

/**
 * 广播部署日志
 */
function broadcastDeployLog(projectId, logEntry) {
  if (!global.broadcastLog) return;
  
  const formattedMessage = `[${STAGE_DESCRIPTIONS[logEntry.stage] || logEntry.stage}] ${logEntry.message}`;
  global.broadcastLog(projectId, formattedMessage, logEntry.level);
  
  // 同时发送给部署日志订阅者
  const activeStreams = Array.from(deployLogCache.values())
    .filter(stream => stream.projectId === projectId && stream.isActive);
  
  activeStreams.forEach(stream => {
    stream.subscribers.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'deploy_log',
            streamId: stream.id,
            ...logEntry
          }));
        } catch (error) {
          logger.warn(`Failed to send log to WebSocket client: ${error.message}`);
        }
      }
    });
  });
}

/**
 * 广播部署事件
 */
function broadcastDeployEvent(projectId, event) {
  if (!global.broadcast) return;
  
  // 使用全局广播
  global.broadcast('deploy_event', event);
  
  // 同时发送给部署日志订阅者
  const activeStreams = Array.from(deployLogCache.values())
    .filter(stream => stream.projectId === projectId && stream.isActive);
  
  activeStreams.forEach(stream => {
    stream.subscribers.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(event));
        } catch (error) {
          logger.warn(`Failed to send event to WebSocket client: ${error.message}`);
        }
      }
    });
  });
}

/**
 * 获取部署流状态
 */
function getDeployStreamStatus(streamId) {
  const stream = deployLogCache.get(streamId);
  if (!stream) return null;

  return {
    streamId: stream.id,
    projectId: stream.projectId,
    projectName: stream.projectName,
    startTime: stream.startTime,
    endTime: stream.endTime,
    currentStage: stream.currentStage,
    stageName: STAGE_DESCRIPTIONS[stream.currentStage],
    isActive: stream.isActive,
    success: stream.success,
    logCount: stream.logs.length,
    stages: Object.keys(stream.stages).map(stage => ({
      stage,
      name: STAGE_DESCRIPTIONS[stage],
      startTime: stream.stages[stage].startTime,
      endTime: stream.stages[stage].endTime,
      duration: stream.stages[stage].endTime ? stream.stages[stage].endTime - stream.stages[stage].startTime : null,
      success: stream.stages[stage].success,
      logCount: stream.stages[stage].logs.length
    }))
  };
}

/**
 * 获取项目的活动部署流
 */
function getActiveDeployStream(projectId) {
  const activeStreams = Array.from(deployLogCache.values())
    .filter(stream => stream.projectId === projectId && stream.isActive);
  
  return activeStreams.length > 0 ? getDeployStreamStatus(activeStreams[0].id) : null;
}

/**
 * 清理流日志
 */
function cleanupStreamLogs(stream) {
  const maxLogs = LOG_CACHE_SIZE || 200;
  if (stream.logs.length > maxLogs) {
    stream.logs = stream.logs.slice(-maxLogs);
  }

  // 清理过期日志
  const now = Date.now();
  const cutoff = now - (LOG_CACHE_TTL || 3600000);
  stream.logs = stream.logs.filter(log => log.time > cutoff);
}

/**
 * 清理过期的部署流
 */
function cleanupExpiredStreams() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  
  for (const [streamId, stream] of deployLogCache.entries()) {
    if (!stream.isActive && (now - (stream.endTime || stream.startTime) > maxAge)) {
      deployLogCache.delete(streamId);
    }
  }
}

/**
 * 格式化持续时间
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
  return `${Math.floor(ms / 3600000)}小时${Math.floor((ms % 3600000) / 60000)}分`;
}

module.exports = {
  DEPLOY_STAGES,
  STAGE_DESCRIPTIONS,
  initDeployLogStream,
  logDeployStage,
  logDeployProgress,
  completeDeployStage,
  completeDeployStream,
  subscribeToDeployLog,
  unsubscribeFromDeployLog,
  getDeployStreamStatus,
  getActiveDeployStream
};
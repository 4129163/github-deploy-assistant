/**
 * 项目健康检查服务
 * 每 30 秒轮询运行中项目的健康状态
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

const healthStatus = {}; // projectId -> { status, lastCheck, latency, failCount }

/**
 * 检查单个项目
 */
async function checkProject(projectId, port, healthUrl) {
  const url = healthUrl || `http://localhost:${port}`;
  const start = Date.now();
  try {
    const res = await axios.get(url, { timeout: 5000, validateStatus: s => s < 500 });
    const latency = Date.now() - start;
    healthStatus[String(projectId)] = {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      latency,
      statusCode: res.status,
      failCount: 0
    };
    return true;
  } catch (err) {
    const prev = healthStatus[String(projectId)];
    const failCount = (prev?.failCount || 0) + 1;
    healthStatus[String(projectId)] = {
      status: failCount >= 3 ? 'unhealthy' : 'checking',
      lastCheck: new Date().toISOString(),
      latency: null,
      error: err.message,
      failCount
    };
    if (failCount >= 3) {
      logger.warn(`[HealthCheck] Project ${projectId} is unhealthy (${err.message})`);
      if (global.broadcast) {
        global.broadcast('health_alert', { projectId: String(projectId), status: 'unhealthy', error: err.message });
      }
    }
    return false;
  }
}

/**
 * 获取项目健康状态
 */
function getHealthStatus(projectId) {
  return healthStatus[String(projectId)] || { status: 'unknown', lastCheck: null };
}

/**
 * 获取所有健康状态
 */
function getAllHealthStatus() {
  return { ...healthStatus };
}

/**
 * 启动健康检查轮询
 */
function startHealthChecker(getRunningProcesses) {
  const INTERVAL = 30000; // 30秒
  setInterval(() => {
    const processes = getRunningProcesses();
    processes
      .filter(p => p.status === 'running' && p.port)
      .forEach(p => {
        const ProjectDB = require('./database').ProjectDB;
        ProjectDB.getById(p.projectId).then(project => {
          if (project) checkProject(p.projectId, p.port, project.health_url);
        }).catch(() => {});
      });
  }, INTERVAL);
  logger.info('[HealthCheck] Health checker started (interval: 30s)');
}

module.exports = { checkProject, getHealthStatus, getAllHealthStatus, startHealthChecker };

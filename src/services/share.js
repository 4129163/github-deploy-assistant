/**
 * 部署记录分享服务
 * 功能19：一键分享部署记录，生成可公开访问的分享链接
 */

const crypto = require('crypto');
const { ConfigDB, ProjectDB, DeployLogDB } = require('./database');
const { logger } = require('../utils/logger');

// 分享数据存储（内存 + SQLite configs 表）
const shareMap = {}; // token -> shareData

async function loadShares() {
  try {
    const raw = await ConfigDB.get('share_records');
    if (raw) {
      const data = JSON.parse(raw);
      Object.assign(shareMap, data);
      logger.info(`Loaded ${Object.keys(shareMap).length} share records`);
    }
  } catch (_) {}
}

async function saveShares() {
  try {
    await ConfigDB.set('share_records', JSON.stringify(shareMap));
  } catch (_) {}
}

loadShares();

/**
 * 生成分享令牌
 */
function generateShareToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 创建部署记录分享
 * @param {number} projectId - 项目ID
 * @param {number|null} logId - 部署日志ID，null表示分享最新记录
 * @param {object} options - 选项
 * @param {number} options.expireHours - 过期小时数（0=永不过期）
 * @param {boolean} options.includeConfig - 是否包含项目配置
 * @param {boolean} options.includeSteps - 是否包含部署步骤
 */
async function createShare(projectId, logId = null, options = {}) {
  const { expireHours = 72, includeConfig = true, includeSteps = true } = options;

  const project = await ProjectDB.getById(projectId);
  if (!project) throw new Error('项目不存在');

  // 获取部署日志
  let deployLog = null;
  if (logId) {
    const logs = await DeployLogDB.getByProjectId(projectId);
    deployLog = logs.find(l => l.id === parseInt(logId));
  } else {
    const logs = await DeployLogDB.getByProjectId(projectId);
    deployLog = logs[logs.length - 1] || null; // 最新一条
  }

  const token = generateShareToken();
  const createdAt = Date.now();
  const expireAt = expireHours > 0 ? createdAt + expireHours * 3600 * 1000 : 0;

  // 构建分享数据
  const shareData = {
    token,
    projectId: String(projectId),
    createdAt,
    expireAt,
    project: {
      name: project.name,
      repo_url: project.repo_url,
      project_type: project.project_type,
      status: project.status,
    },
    config: includeConfig ? {
      port: project.port,
      health_url: project.health_url,
      notes: project.notes,
      tags: project.tags,
    } : null,
    deployLog: deployLog ? {
      id: deployLog.id,
      mode: deployLog.mode,
      status: deployLog.status,
      created_at: deployLog.created_at,
      output: includeSteps ? deployLog.output : null,
    } : null,
    steps: includeSteps ? buildReproduceSteps(project) : null,
  };

  shareMap[token] = shareData;
  await saveShares();

  logger.info(`Share created: token=${token}, project=${project.name}, expire=${expireHours}h`);
  return shareData;
}

/**
 * 构建复现步骤
 */
function buildReproduceSteps(project) {
  const types = project.project_type ? project.project_type.split(',') : [];
  const steps = [];

  steps.push({
    step: 1,
    title: '克隆仓库',
    commands: [`git clone ${project.repo_url}`, `cd ${project.name}`],
  });

  if (types.includes('nodejs')) {
    steps.push({ step: 2, title: '安装依赖', commands: ['npm install'] });
    steps.push({ step: 3, title: '启动项目', commands: ['npm start'] });
  } else if (types.includes('python')) {
    steps.push({ step: 2, title: '创建虚拟环境', commands: ['python3 -m venv venv', 'source venv/bin/activate'] });
    steps.push({ step: 3, title: '安装依赖', commands: ['pip install -r requirements.txt'] });
    steps.push({ step: 4, title: '启动项目', commands: ['python main.py'] });
  } else if (types.includes('docker')) {
    steps.push({ step: 2, title: '构建镜像', commands: [`docker build -t ${project.name} .`] });
    steps.push({ step: 3, title: '运行容器', commands: [`docker run -d --name ${project.name} -p ${project.port || 3000}:${project.port || 3000} ${project.name}`] });
  } else if (types.includes('go')) {
    steps.push({ step: 2, title: '构建', commands: ['go build -o app .'] });
    steps.push({ step: 3, title: '运行', commands: ['./app'] });
  } else {
    steps.push({ step: 2, title: '查看 README 了解启动方式', commands: ['cat README.md'] });
  }

  if (project.port) {
    steps.push({ step: steps.length + 1, title: '访问服务', commands: [`open http://localhost:${project.port}`] });
  }

  return steps;
}

/**
 * 获取分享数据
 */
function getShare(token) {
  const share = shareMap[token];
  if (!share) return null;
  // 检查是否过期
  if (share.expireAt > 0 && Date.now() > share.expireAt) {
    delete shareMap[token];
    saveShares();
    return null;
  }
  return share;
}

/**
 * 列出项目的所有分享
 */
function listSharesByProject(projectId) {
  return Object.values(shareMap)
    .filter(s => String(s.projectId) === String(projectId))
    .map(s => ({
      token: s.token,
      createdAt: s.createdAt,
      expireAt: s.expireAt,
      expired: s.expireAt > 0 && Date.now() > s.expireAt,
    }));
}

/**
 * 删除分享
 */
async function deleteShare(token) {
  if (!shareMap[token]) throw new Error('分享记录不存在');
  delete shareMap[token];
  await saveShares();
}

module.exports = {
  createShare,
  getShare,
  listSharesByProject,
  deleteShare,
  buildReproduceSteps,
};

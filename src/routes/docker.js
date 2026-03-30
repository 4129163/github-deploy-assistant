/**
 * Docker 容器化路由
 * GET  /api/docker/status/:projectId       — 检测项目容器化状态
 * POST /api/docker/generate/:projectId     — AI 生成 Dockerfile + docker-compose.yml
 * POST /api/docker/build/:projectId        — 构建镜像
 * POST /api/docker/run/:projectId          — 运行容器
 * POST /api/docker/stop/:projectId         — 停止容器
 * GET  /api/docker/logs/:projectId         — 查看容器日志
 * GET  /api/docker/list                    — 列出所有 GADA 管理的容器
 */

const express = require('express');
const router = express.Router();
const { ProjectDB } = require('../services/database');
const {
  detectContainerStatus,
  generateDockerfile,
  generateDockerCompose,
  writeDockerFiles,
  buildImage,
  runContainer,
  stopContainer,
  getContainerLogs,
  listContainers,
} = require('../services/docker-service');
const { logger } = require('../utils/logger');

function broadcast(projectId, msg) {
  if (global.broadcastLog) global.broadcastLog(String(projectId), msg);
}

// 检测容器化状态
router.get('/status/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const status = await detectContainerStatus(project.local_path);
    res.json({ success: true, data: { ...status, projectId: project.id, name: project.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI 生成 Dockerfile + docker-compose.yml
router.post('/generate/:projectId', async (req, res) => {
  try {
    const { overwrite = false, port } = req.body;
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    broadcast(project.id, '🤖 AI 正在生成 Dockerfile...');
    const dockerfile = await generateDockerfile(project, null);
    broadcast(project.id, '🤖 AI 正在生成 docker-compose.yml...');
    const compose = await generateDockerCompose(project, port || project.port || 3000, null);
    const written = await writeDockerFiles(project.local_path, dockerfile, compose, overwrite);
    broadcast(project.id, `✅ 已生成: ${written.join(', ')}`);

    res.json({
      success: true,
      data: { written, dockerfile, compose },
      message: `已生成: ${written.join(', ')}`,
    });
  } catch (err) {
    logger.error('Docker generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 构建镜像
router.post('/build/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    broadcast(project.id, '🔨 开始构建 Docker 镜像...');
    const result = await buildImage(project, (line) => broadcast(project.id, line));
    await ProjectDB.update(project.id, { docker_image: result.tag });
    res.json({ success: true, data: result, message: `镜像构建成功: ${result.tag}` });
  } catch (err) {
    logger.error('Docker build error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 运行容器
router.post('/run/:projectId', async (req, res) => {
  try {
    const { port } = req.body;
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    broadcast(project.id, '🚀 启动 Docker 容器...');
    const result = await runContainer(project, port || project.port || 3000, (line) => broadcast(project.id, line));
    await ProjectDB.update(project.id, { status: 'running', docker_container: result.containerName, port: result.hostPort });
    res.json({ success: true, data: result, message: `容器已启动: ${result.containerName}` });
  } catch (err) {
    logger.error('Docker run error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 停止容器
router.post('/stop/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    broadcast(project.id, '🛑 停止 Docker 容器...');
    const result = await stopContainer(project, (line) => broadcast(project.id, line));
    if (result.success) await ProjectDB.update(project.id, { status: 'stopped' });
    res.json({ success: result.success, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 查看容器日志
router.get('/logs/:projectId', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const logs = await getContainerLogs(project, lines);
    res.json({ success: true, data: { logs } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 列出所有 GADA 管理的容器
router.get('/list', async (req, res) => {
  try {
    const containers = await listContainers();
    res.json({ success: true, data: { containers } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

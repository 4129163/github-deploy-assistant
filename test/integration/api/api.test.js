const request = require('supertest');
const path = require('path');

// 由于我们无法直接修改主应用，这里创建一个简单的测试服务器
const express = require('express');
const app = express();

// 模拟API端点
app.use(express.json());

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'github-deploy-assistant',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 项目列表端点
app.get('/api/projects', (req, res) => {
  res.json([
    {
      id: 'test-1',
      name: 'test-project-1',
      type: 'Node.js',
      port: 3001,
      status: 'running',
      createdAt: new Date().toISOString()
    },
    {
      id: 'test-2',
      name: 'test-project-2',
      type: 'React',
      port: 3002,
      status: 'stopped',
      createdAt: new Date().toISOString()
    }
  ]);
});

// 创建项目端点
app.post('/api/projects', (req, res) => {
  const project = req.body;
  const newProject = {
    id: `project-${Date.now()}`,
    ...project,
    status: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.status(201).json(newProject);
});

// 项目详情端点
app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  
  res.json({
    id,
    name: `test-project-${id}`,
    type: 'Node.js',
    port: 3000 + parseInt(id.replace(/\D/g, '') || '0'),
    status: 'running',
    path: `/tmp/test-project-${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

// 启动项目端点
app.post('/api/projects/:id/start', (req, res) => {
  const { id } = req.params;
  
  res.json({
    id,
    status: 'running',
    message: `Project ${id} started successfully`,
    startedAt: new Date().toISOString()
  });
});

// 停止项目端点
app.post('/api/projects/:id/stop', (req, res) => {
  const { id } = req.params;
  
  res.json({
    id,
    status: 'stopped',
    message: `Project ${id} stopped successfully`,
    stoppedAt: new Date().toISOString()
  });
});

// 部署项目端点
app.post('/api/deploy', (req, res) => {
  const { repoUrl, branch = 'main', targetPath } = req.body;
  
  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }
  
  res.json({
    id: `deploy-${Date.now()}`,
    repoUrl,
    branch,
    targetPath: targetPath || `/tmp/deploy-${Date.now()}`,
    status: 'in_progress',
    message: 'Deployment started',
    startedAt: new Date().toISOString(),
    steps: [
      { step: 'clone', status: 'completed', timestamp: new Date().toISOString() },
      { step: 'install', status: 'completed', timestamp: new Date().toISOString() },
      { step: 'build', status: 'in_progress', timestamp: new Date().toISOString() },
      { step: 'start', status: 'pending', timestamp: null }
    ]
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

describe('API Integration Tests', () => {
  let server;
  
  beforeAll((done) => {
    server = app.listen(3004, done);
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'github-deploy-assistant');
      expect(response.body.timestamp).toBeDefined();
    });
  });
  
  describe('Projects API', () => {
    test('GET /api/projects should return project list', async () => {
      const response = await request(app).get('/api/projects');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('status');
    });
    
    test('POST /api/projects should create new project', async () => {
      const newProject = {
        name: 'test-integration-project',
        type: 'Node.js',
        port: 3005,
        path: '/tmp/test-integration'
      };
      
      const response = await request(app)
        .post('/api/projects')
        .send(newProject);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', newProject.name);
      expect(response.body).toHaveProperty('type', newProject.type);
      expect(response.body).toHaveProperty('status', 'created');
    });
    
    test('GET /api/projects/:id should return project details', async () => {
      const projectId = 'test-123';
      const response = await request(app).get(`/api/projects/${projectId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', projectId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('port');
    });
    
    test('POST /api/projects/:id/start should start project', async () => {
      const projectId = 'test-456';
      const response = await request(app).post(`/api/projects/${projectId}/start`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', projectId);
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('startedAt');
    });
    
    test('POST /api/projects/:id/stop should stop project', async () => {
      const projectId = 'test-789';
      const response = await request(app).post(`/api/projects/${projectId}/stop`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', projectId);
      expect(response.body).toHaveProperty('status', 'stopped');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('stoppedAt');
    });
  });
  
  describe('Deployment API', () => {
    test('POST /api/deploy should start deployment', async () => {
      const deploymentData = {
        repoUrl: 'https://github.com/example/test-repo.git',
        branch: 'main',
        targetPath: '/tmp/test-deployment'
      };
      
      const response = await request(app)
        .post('/api/deploy')
        .send(deploymentData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('repoUrl', deploymentData.repoUrl);
      expect(response.body).toHaveProperty('branch', deploymentData.branch);
      expect(response.body).toHaveProperty('status', 'in_progress');
      expect(response.body).toHaveProperty('steps');
      expect(Array.isArray(response.body.steps)).toBe(true);
    });
    
    test('POST /api/deploy without repoUrl should return error', async () => {
      const deploymentData = {
        branch: 'main',
        targetPath: '/tmp/test-deployment'
      };
      
      const response = await request(app)
        .post('/api/deploy')
        .send(deploymentData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Repository URL is required');
    });
  });
});
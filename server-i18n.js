// GitHub Deploy Assistant - 后端API服务器（国际化版本）

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');

// 国际化错误处理
const { 
  i18nErrorHandler, 
  I18nErrorHandler 
} = require('./src/utils/i18n/error-messages');
const { 
  i18nErrorHandlerMiddleware, 
  i18nNotFoundHandler,
  successResponse,
  CommonErrors,
  asyncHandler 
} = require('./src/utils/error-handler-i18n');

// 安全存储路由
const secureConfigRoutes = require('./src/routes/secure-config');

// AI智能诊断闭环功能
const { createDeployErrorCatcher } = require('./src/middleware/deploy-error-catcher');
const aiRoutes = require('./src/routes/ai');

// 部署恢复功能
const deployResumeRoutes = require('./src/routes/deploy-resume');
const { deployCheckpointIntegration } = require('./src/deploy-checkpoint-integration');

// 浏览器扩展功能
const browserRoutes = require('./src/routes/browser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// 创建i18n错误处理实例
const i18nHandler = new I18nErrorHandler('zh-CN');

// 中间件 - 支持浏览器扩展的CORS配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许以下来源：
    // 1. 没有origin（如curl请求）
    // 2. localhost所有端口
    // 3. 浏览器扩展（chrome-extension://*, moz-extension://*）
    // 4. 127.0.0.1所有端口
    if (!origin) {
      callback(null, true);
    } else if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('chrome-extension://') ||
      origin.includes('moz-extension://') ||
      origin.includes('edge-extension://')
    ) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept-Language']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

// 国际化中间件 - 必须在其他中间件之前
app.use(i18nHandler.middleware.bind(i18nHandler));

// Socket.io 中间件 - 使 io 实例在路由中可用
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 部署错误捕获中间件
app.use(createDeployErrorCatcher(io));

// AI路由
app.use('/api/ai', aiRoutes);

// 部署恢复路由
app.use('/api/deploy', deployResumeRoutes);

// 浏览器扩展路由
app.use('/api/browser', browserRoutes);

// 数据存储
let projects = [];
let activities = [];

// 初始化数据
async function initializeData() {
    try {
        // 尝试从文件加载数据
        const data = await fs.readFile('data.json', 'utf8');
        const parsed = JSON.parse(data);
        projects = parsed.projects || [];
        activities = parsed.activities || [];
        console.log('数据已从文件加载');
    } catch (error) {
        // 如果文件不存在，使用默认数据
        console.log('使用默认数据');
        projects = [
            {
                id: 'sample-1',
                name: '示例Node.js项目',
                type: 'node',
                port: 3000,
                path: '/var/www/sample-node',
                status: 'stopped',
                repoUrl: 'https://github.com/example/node-app',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'sample-2',
                name: '示例Python项目',
                type: 'python',
                port: 8000,
                path: '/var/www/sample-python',
                status: 'running',
                repoUrl: 'https://github.com/example/python-app',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        activities = [];
    }
}

// 保存数据到文件
async function saveData() {
    try {
        const data = {
            projects,
            activities
        };
        await fs.writeFile('data.json', JSON.stringify(data, null, 2));
        console.log('数据已保存到文件');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// WebSocket连接
io.on('connection', (socket) => {
    console.log('新的客户端连接');
    
    // 发送当前项目列表
    socket.emit('projects_update', projects);
    
    // 发送系统状态
    const systemStatus = {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        system: 'online'
    };
    socket.emit('system_update', systemStatus);
    
    socket.on('disconnect', () => {
        console.log('客户端断开连接');
    });
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    const response = successResponse(req, 'SUCCESS', {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        language: req.lang
    });
    res.json(response);
});

// 获取系统状态
app.get('/api/system/status', (req, res) => {
    const systemStatus = {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        system: 'online',
        timestamp: new Date().toISOString(),
        language: req.lang
    };
    
    const response = successResponse(req, 'SUCCESS', systemStatus);
    res.json(response);
});

// 获取所有项目
app.get('/api/projects', (req, res) => {
    const response = successResponse(req, 'SUCCESS', projects);
    res.json(response);
});

// 获取单个项目
app.get('/api/projects/:id', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const response = successResponse(req, 'SUCCESS', project);
    res.json(response);
}));

// 创建新项目
app.post('/api/projects', asyncHandler(async (req, res) => {
    const { name, type, port, path, repoUrl } = req.body;
    
    // 验证必填字段
    if (!name) {
        throw CommonErrors.missingField('name', null, req.lang);
    }
    
    if (!type) {
        throw CommonErrors.missingField('type', null, req.lang);
    }
    
    // 验证端口
    if (port && (port < 1 || port > 65535)) {
        throw CommonErrors.invalidPort(null, req.lang);
    }
    
    // 检查项目是否已存在
    const existingProject = projects.find(p => p.name === name);
    if (existingProject) {
        throw CommonErrors.projectExists({ name }, null, req.lang);
    }
    
    const newProject = {
        id: uuidv4(),
        name,
        type,
        port: port || 3000,
        path: path || `/var/www/${name.toLowerCase().replace(/\s+/g, '-')}`,
        status: 'stopped',
        repoUrl: repoUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    projects.push(newProject);
    await saveData();
    
    // 通过WebSocket通知所有客户端
    io.emit('project_update', newProject);
    
    const response = successResponse(req, 'PROJECT_CREATED', newProject);
    res.status(201).json(response);
}));

// 更新项目
app.put('/api/projects/:id', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const updates = req.body;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    // 验证端口
    if (updates.port && (updates.port < 1 || updates.port > 65535)) {
        throw CommonErrors.invalidPort(null, req.lang);
    }
    
    // 检查名称是否与其他项目冲突
    if (updates.name) {
        const existingProject = projects.find((p, index) => 
            p.name === updates.name && index !== projectIndex
        );
        if (existingProject) {
            throw CommonErrors.projectExists({ name: updates.name }, null, req.lang);
        }
    }
    
    const updatedProject = {
        ...projects[projectIndex],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    projects[projectIndex] = updatedProject;
    await saveData();
    
    // 通过WebSocket通知所有客户端
    io.emit('project_update', updatedProject);
    
    const response = successResponse(req, 'PROJECT_UPDATED', updatedProject);
    res.json(response);
}));

// 删除项目
app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const deletedProject = projects[projectIndex];
    projects.splice(projectIndex, 1);
    await saveData();
    
    // 通过WebSocket通知所有客户端
    io.emit('project_deleted', { id: projectId });
    
    const response = successResponse(req, 'PROJECT_DELETED', { id: projectId });
    res.json(response);
}));

// 启动项目
app.post('/api/projects/:id/start', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 检查项目状态
    if (project.status === 'running') {
        const response = successResponse(req, 'SUCCESS', { 
            message: '项目已在运行中',
            project 
        });
        return res.json(response);
    }
    
    if (project.status === 'starting') {
        const response = successResponse(req, 'SUCCESS', { 
            message: '项目正在启动中',
            project 
        });
        return res.json(response);
    }
    
    // 模拟启动过程
    projects[projectIndex] = {
        ...project,
        status: 'starting',
        updatedAt: new Date().toISOString()
    };
    
    // 通过WebSocket通知所有客户端
    io.emit('project_update', projects[projectIndex]);
    
    // 模拟启动延迟
    setTimeout(() => {
        projects[projectIndex] = {
            ...projects[projectIndex],
            status: 'running',
            updatedAt: new Date().toISOString()
        };
        
        io.emit('project_update', projects[projectIndex]);
        io.emit('log_message', {
            projectId,
            message: `项目 ${project.name} 已成功启动`,
            level: 'info'
        });
    }, 2000);
    
    const response = successResponse(req, 'PROJECT_STARTED', { 
        message: '项目正在启动...',
        project: projects[projectIndex]
    });
    res.json(response);
}));

// 停止项目
app.post('/api/projects/:id/stop', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 检查项目状态
    if (project.status === 'stopped') {
        const response = successResponse(req, 'SUCCESS', { 
            message: '项目已停止',
            project 
        });
        return res.json(response);
    }
    
    if (project.status === 'stopping') {
        const response = successResponse(req, 'SUCCESS', { 
            message: '项目正在停止中',
            project 
        });
        return res.json(response);
    }
    
    // 模拟停止过程
    projects[projectIndex] = {
        ...project,
        status: 'stopping',
        updatedAt: new Date().toISOString()
    };
    
    // 通过WebSocket通知所有客户端
    io.emit('project_update', projects[projectIndex]);
    
    // 模拟停止延迟
    setTimeout(() => {
        projects[projectIndex] = {
            ...projects[projectIndex],
            status: 'stopped',
            updatedAt: new Date().toISOString()
        };
        
        io.emit('project_update', projects[projectIndex]);
        io.emit('log_message', {
            projectId,
            message: `项目 ${project.name} 已停止`,
            level: 'info'
        });
    }, 2000);
    
    const response = successResponse(req, 'PROJECT_STOPPED', { 
        message: '项目正在停止...',
        project: projects[projectIndex]
    });
    res.json(response);
}));

// 重启项目
app.post('/api/projects/:id/restart', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 检查项目状态
    if (project.status === 'restarting') {
        const response = successResponse(req, 'SUCCESS', { 
            message: '项目正在重启中',
            project 
        });
        return res.json(response);
    }
    
    // 模拟重启过程
    projects[projectIndex] = {
        ...project,
        status: 'restarting',
        updatedAt: new Date().toISOString()
    };
    
    // 通过WebSocket通知所有客户端
    io.emit('project_update', projects[projectIndex]);
    io.emit('log_message', {
        projectId,
        message: `项目 ${project.name} 正在重启...`,
        level: 'info'
    });
    
    // 模拟重启延迟
    setTimeout(() => {
        projects[projectIndex] = {
            ...projects[projectIndex],
            status: 'running',
            updatedAt: new Date().toISOString()
        };
        
        io.emit('project_update', projects[projectIndex]);
        io.emit('log_message', {
            projectId,
            message: `项目 ${project.name} 重启完成`,
            level: 'info'
        });
    }, 3000);
    
    const response = successResponse(req, 'PROJECT_RESTARTED', { 
        message: '项目正在重启...',
        project: projects[projectIndex]
    });
    res.json(response);
}));

// 分析仓库
app.post('/api/repo/analyze', asyncHandler(async (req, res) => {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
        throw CommonErrors.missingField('repoUrl', null, req.lang);
    }
    
    // 验证URL格式
    try {
        new URL(repoUrl);
    } catch (error) {
        throw CommonErrors.invalidUrl(null, req.lang);
    }
    
    // 模拟分析过程
    const analysisResult = {
        repoUrl,
        detectedType: 'node',
        packageManager: 'npm',
        port: 3000,
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        dependencies: ['express', 'cors', 'dotenv'],
        analysisTime: new Date().toISOString(),
        success: true
    };
    
    const response = successResponse(req, 'SUCCESS', analysisResult);
    res.json(response);
}));

// 部署项目
app.post('/api/deploy', asyncHandler(async (req, res) => {
    const { repoUrl, projectName, port, projectType } = req.body;
    
    // 验证必填字段
    if (!repoUrl) {
        throw CommonErrors.missingField('repoUrl', null, req.lang);
    }
    
    if (!projectName) {
        throw CommonErrors.missingField('projectName', null, req.lang);
    }
    
    // 验证端口
    if (port && (port < 1 || port > 65535)) {
        throw CommonErrors.invalidPort(null, req.lang);
    }
    
    // 检查项目是否已存在
    const existingProject = projects.find(p => p.name === projectName);
    if (existingProject) {
        throw CommonErrors.projectExists({ name: projectName }, null, req.lang);
    }
    
    // 创建新项目
    const newProject = {
        id: uuidv4(),
        name: projectName,
        type: projectType || 'node',
        port: port || 3000,
        path: `/var/www/${projectName.toLowerCase().replace(/\s+/g, '-')}`,
        status: 'deploying',
        repoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    projects.push(newProject);
    await saveData();
    
    // 通过WebSocket通知部署开始
    io.emit('project_update', newProject);
    io.emit('log_message', {
        projectId: newProject.id,
        message: `开始部署项目: ${projectName}`,
        level: 'info'
    });
    
    // 模拟部署过程
    setTimeout(() => {
        const projectIndex = projects.findIndex(p => p.id === newProject.id);
        if (projectIndex !== -1) {
            projects[projectIndex] = {
                ...projects[projectIndex],
                status: 'running',
                updatedAt: new Date().toISOString()
            };
            
            io.emit('project_update', projects[projectIndex]);
            io.emit('log_message', {
                projectId: newProject.id,
                message: `项目 ${projectName} 部署完成`,
                level: 'success'
            });
        }
    }, 5000);
    
    const response = successResponse(req, 'DEPLOYMENT_COMPLETED', {
        message: '部署已开始',
        project: newProject,
        estimatedTime: '5秒'
    });
    res.status(202).json(response);
}));

// 获取部署状态
app.get('/api/deploy/status/:projectId', asyncHandler(async (req, res) => {
    const projectId = req.params.id || req.params.projectId;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const status = {
        projectId,
        status: project.status,
        progress: project.status === 'deploying' ? 50 : 100,
        message: `项目状态: ${project.status}`,
        timestamp: new Date().toISOString()
    };
    
    const response = successResponse(req, 'SUCCESS', status);
    res.json(response);
}));

// 备份项目
app.post('/api/projects/:id/backup', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 模拟备份过程
    const backupInfo = {
        projectId,
        backupId: uuidv4(),
        filename: `backup-${project.name}-${new Date().toISOString().slice(0, 10)}.tar.gz`,
        size: '15.7MB',
        createdAt: new Date().toISOString(),
        status: 'completed'
    };
    
    // 通过WebSocket通知备份完成
    io.emit('log_message', {
        projectId,
        message: `项目 ${project.name} 备份完成: ${backupInfo.filename}`,
        level: 'success'
    });
    
    const response = successResponse(req, 'PROJECT_BACKED_UP', backupInfo);
    res.json(response);
}));

// 更新项目依赖
app.post('/api/projects/:id/update-deps', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 模拟依赖更新过程
    io.emit('log_message', {
        projectId,
        message: `开始更新项目 ${project.name} 的依赖...`,
        level: 'info'
    });
    
    setTimeout(() => {
        io.emit('log_message', {
            projectId,
            message: `项目 ${project.name} 依赖更新完成`,
            level: 'success'
        });
    }, 3000);
    
    const response = successResponse(req, 'SUCCESS', {
        message: '依赖更新已开始',
        projectId,
        estimatedTime: '3秒'
    });
    res.json(response);
}));

// 重建项目
app.post('/api/projects/:id/rebuild', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    const project = projects[projectIndex];
    
    // 模拟重建过程
    projects[projectIndex] = {
        ...project,
        status: 'building',
        updatedAt: new Date().toISOString()
    };
    
    io.emit('project_update', projects[projectIndex]);
    io.emit('log_message', {
        projectId,
        message: `开始重建项目 ${project.name}...`,
        level: 'info'
    });
    
    setTimeout(() => {
        projects[projectIndex] = {
            ...projects[projectIndex],
            status: 'running',
            updatedAt: new Date().toISOString()
        };
        
        io.emit('project_update', projects[projectIndex]);
        io.emit('log_message', {
            projectId,
            message: `项目 ${project.name} 重建完成`,
            level: 'success'
        });
    }, 4000);
    
    const response = successResponse(req, 'SUCCESS', {
        message: '项目重建已开始',
        project: projects[projectIndex],
        estimatedTime: '4秒'
    });
    res.json(response);
}));

// 获取项目日志
app.get('/api/projects/:id/logs', asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        throw CommonErrors.projectNotFound({ id: projectId }, null, req.lang);
    }
    
    // 模拟日志数据
    const logs = [
        {
            timestamp: new Date(Date.now() - 30000).toISOString(),
            level: 'info',
            message: '项目启动成功',
            source: 'system'
        },
        {
            timestamp: new Date(Date.now() - 25000).toISOString(),
            level: 'info',
            message: '监听端口 3000',
            source: 'application'
        },
        {
            timestamp: new Date(Date.now() - 20000).toISOString(),
            level: 'info',
            message: '数据库连接成功',
            source: 'database'
        },
        {
            timestamp: new Date(Date.now() - 15000).toISOString(),
            level: 'warning',
            message: '内存使用率较高',
            source: 'monitoring'
        },
        {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: '请求处理完成',
            source: 'application'
        }
    ];
    
    const response = successResponse(req, 'SUCCESS', {
        projectId,
        projectName: project.name,
        logs,
        total: logs.length,
        language: req.lang
    });
    res.json(response);
}));

// 404处理 - 必须在所有路由之后
app.use(i18nNotFoundHandler);

// 错误处理中间件 - 必须在最后
app.use(i18nErrorHandlerMiddleware);

// 启动服务器
async function startServer() {
    await initializeData();
    
    server.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log(`支持的语言: en, zh-CN, ja`);
        console.log(`默认语言: zh-CN`);
        console.log(`使用查询参数切换语言: ?lang=en`);
        console.log(`使用Accept-Language头自动检测语言`);
    });
}

// 处理进程退出
process.on('SIGINT', async () => {
    console.log('正在关闭服务器...');
    await saveData();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('正在关闭服务器...');
    await saveData();
    process.exit(0);
});

startServer().catch(error => {
    console.error('启动服务器失败:', error);
    process.exit(1);
});

module.exports = { app, server, io };
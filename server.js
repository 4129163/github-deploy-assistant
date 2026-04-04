// GitHub Deploy Assistant - 后端API服务器

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const socketIo = require('socket.io');

// 安全存储路由
const secureConfigRoutes = require('./src/routes/secure-config');

// AI智能诊断闭环功能
const { createDeployErrorCatcher } = require('./src/middleware/deploy-error-catcher');
const aiRoutes = require('./src/routes/ai');

// 部署恢复功能
const deployResumeRoutes = require('./src/routes/deploy-resume');
const { deployCheckpointIntegration } = require('./src/deploy-checkpoint-integration');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
                id: '1',
                name: 'my-react-app',
                type: 'React',
                port: 3000,
                path: '/home/user/projects/my-react-app',
                status: 'running',
                lastActive: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                name: 'api-service',
                type: 'Node.js',
                port: 8080,
                path: '/home/user/projects/api-service',
                status: 'stopped',
                lastActive: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }
        ];
        
        activities = [
            {
                id: '1',
                type: 'start',
                project: 'my-react-app',
                message: '项目已启动',
                timestamp: new Date().toISOString(),
                success: true
            },
            {
                id: '2',
                type: 'deploy',
                project: 'api-service',
                message: '部署完成',
                timestamp: new Date().toISOString(),
                success: true
            }
        ];
    }
}

// 保存数据到文件
async function saveData() {
    try {
        const data = {
            projects,
            activities,
            updatedAt: new Date().toISOString()
        };
        await fs.writeFile('data.json', JSON.stringify(data, null, 2));
        console.log('数据已保存到文件');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 获取所有项目
app.get('/api/projects', (req, res) => {
    res.json({ projects });
});

// 获取单个项目
app.get('/api/projects/:id', (req, res) => {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }
    res.json({ project });
});

// 创建项目
app.post('/api/projects', (req, res) => {
    const projectData = req.body;
    
    if (!projectData.name) {
        return res.status(400).json({ error: '项目名称不能为空' });
    }
    
    const newProject = {
        id: uuidv4(),
        name: projectData.name,
        type: projectData.type || 'Node.js',
        port: projectData.port || 3000,
        path: projectData.path || `/home/user/projects/${projectData.name}`,
        status: 'stopped',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...projectData
    };
    
    projects.push(newProject);
    
    // 记录活动
    addActivity('create', newProject.name, '项目创建成功');
    
    // 保存数据
    saveData();
    
    res.status(201).json({ project: newProject });
});

// 更新项目
app.put('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;
    const updates = req.body;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    projects[projectIndex] = {
        ...projects[projectIndex],
        ...updates,
        lastActive: new Date().toISOString()
    };
    
    // 记录活动
    addActivity('update', projects[projectIndex].name, '项目已更新');
    
    // 保存数据
    saveData();
    
    res.json({ project: projects[projectIndex] });
});

// 删除项目
app.delete('/api/projects/:id', (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    const deletedProject = projects[projectIndex];
    projects.splice(projectIndex, 1);
    
    // 记录活动
    addActivity('delete', deletedProject.name, '项目已删除');
    
    // 保存数据
    saveData();
    
    res.json({ message: '项目已删除', project: deletedProject });
});

// 启动项目
app.post('/api/projects/:id/start', (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    projects[projectIndex].status = 'running';
    projects[projectIndex].lastActive = new Date().toISOString();
    
    // 记录活动
    addActivity('start', projects[projectIndex].name, '项目已启动');
    
    // 保存数据
    saveData();
    
    res.json({ 
        project: projects[projectIndex],
        message: '项目启动成功'
    });
});

// 停止项目
app.post('/api/projects/:id/stop', (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    projects[projectIndex].status = 'stopped';
    projects[projectIndex].lastActive = new Date().toISOString();
    
    // 记录活动
    addActivity('stop', projects[projectIndex].name, '项目已停止');
    
    // 保存数据
    saveData();
    
    res.json({ 
        project: projects[projectIndex],
        message: '项目停止成功'
    });
});

// 重启项目
app.post('/api/projects/:id/restart', (req, res) => {
    const projectId = req.params.id;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    // 模拟重启过程
    projects[projectIndex].status = 'starting';
    projects[projectIndex].lastActive = new Date().toISOString();
    
    // 记录活动
    addActivity('restart', projects[projectIndex].name, '项目重启中...');
    
    // 保存数据
    saveData();
    
    // 模拟重启完成
    setTimeout(() => {
        projects[projectIndex].status = 'running';
        addActivity('restart', projects[projectIndex].name, '项目重启完成');
        saveData();
    }, 2000);
    
    res.json({ 
        project: projects[projectIndex],
        message: '项目重启命令已发送'
    });
});

// 分析仓库
app.post('/api/repo/analyze', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: '仓库URL不能为空' });
    }
    
    // 模拟分析过程
    const repoName = url.split('/').pop().replace('.git', '');
    
    const analysis = {
        name: repoName,
        type: 'Node.js', // 根据实际情况分析
        description: '一个现代化的Web应用项目',
        dependencies: ['express', 'react', 'webpack'],
        port: 3000,
        size: '15.2 MB',
        stars: 245,
        lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    res.json({ analysis });
});

// 部署项目（集成检查点功能）
app.post('/api/deploy', async (req, res) => {
    try {
        const deployData = req.body;
        
        if (!deployData.url) {
            return res.status(400).json({ error: '仓库URL不能为空' });
        }
        
        const projectName = deployData.name || deployData.url.split('/').pop().replace('.git', '');
        
        // 创建新项目
        const newProject = {
            id: uuidv4(),
            name: projectName,
            type: deployData.type || 'Node.js',
            port: deployData.port || 3000,
            path: deployData.path || `/home/user/projects/${projectName}`,
            status: 'deploying', // 改为部署中状态
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        projects.push(newProject);
        
        // 创建部署检查点
        const checkpointResult = await deployCheckpointIntegration.startDeploymentWithCheckpoint({
            id: newProject.id,
            name: projectName,
            url: deployData.url,
            path: newProject.path,
            type: deployData.type || 'Node.js',
            port: deployData.port || 3000
        });
        
        if (!checkpointResult.success) {
            console.warn('创建部署检查点失败:', checkpointResult.error);
        }
        
        // 记录活动
        addActivity('deploy', projectName, '项目部署开始');
        
        // 保存数据
        saveData();
        
        // 发送WebSocket事件
        if (req.io) {
            req.io.emit('deploy_started', {
                projectId: newProject.id,
                projectName: projectName,
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(201).json({ 
            project: newProject,
            checkpoint: checkpointResult.success ? '已创建检查点' : '检查点创建失败',
            message: '项目部署已开始'
        });
    } catch (error) {
        console.error('部署项目失败:', error);
        res.status(500).json({ 
            error: '部署项目失败',
            message: error.message
        });
    }
});

// 获取部署状态
app.get('/api/deploy/status/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        
        // 查找项目
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        // 获取检查点详情
        const checkpointDetails = await deployCheckpointIntegration.getDeploymentCheckpointDetails(projectId);
        
        res.json({
            project,
            checkpoint: checkpointDetails.success ? checkpointDetails : null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取部署状态失败:', error);
        res.status(500).json({ 
            error: '获取部署状态失败',
            message: error.message
        });
    }
});

// 获取系统状态
app.get('/api/system/status', (req, res) => {
    const status = {
        cpu: Math.floor(Math.random() * 30) + 10, // 10-40%
        memory: Math.floor(Math.random() * 40) + 40, // 40-80%
        disk: Math.floor(Math.random() * 20) + 60, // 60-80%
        network: true,
        database: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    
    res.json(status);
});

// 获取最近活动
app.get('/api/activities/recent', (req, res) => {
    const recentActivities = activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
    
    res.json(recentActivities);
});

// 项目诊断
app.post('/api/projects/:id/diagnose', (req, res) => {
    const projectId = req.params.id;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    // 模拟诊断结果
    const diagnosis = {
        projectId,
        timestamp: new Date().toISOString(),
        results: {
            files: { status: 'good', message: '项目文件完整', value: '256 个文件' },
            deps: { status: 'warning', message: '发现过期的依赖包', value: '3 个依赖需要更新' },
            config: { status: 'good', message: '配置文件正常', value: '配置检查通过' },
            env: { status: 'error', message: '缺少必要的环境变量', value: 'DATABASE_URL 未设置' },
            permissions: { status: 'good', message: '文件权限正常', value: '权限检查通过' }
        },
        suggestions: [
            {
                title: '更新依赖包',
                description: '发现3个过期的依赖包，建议更新到最新版本',
                command: 'npm update',
                severity: 'medium'
            },
            {
                title: '配置环境变量',
                description: '缺少DATABASE_URL环境变量',
                command: 'export DATABASE_URL=postgres://user:pass@localhost:5432/db',
                severity: 'high'
            }
        ]
    };
    
    res.json(diagnosis);
});

// 修复问题
app.post('/api/projects/:id/fix', (req, res) => {
    const projectId = req.params.id;
    const { issues } = req.body;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    // 模拟修复过程
    const fixResults = {
        projectId,
        timestamp: new Date().toISOString(),
        fixedIssues: issues || [],
        success: true,
        message: '所有问题已修复完成'
    };
    
    // 记录活动
    addActivity('fix', project.name, '项目问题已修复');
    
    res.json(fixResults);
});

// 获取项目指标
app.get('/api/projects/:id/metrics', (req, res) => {
    const { range = '24h' } = req.query;
    
    // 模拟指标数据
    const metrics = {
        cpu: generateTimeSeriesData(24, 10, 40),
        memory: generateTimeSeriesData(24, 40, 80),
        requests: generateTimeSeriesData(24, 100, 1000),
        errors: generateTimeSeriesData(24, 0, 10),
        range
    };
    
    res.json(metrics);
});

// 获取项目日志
app.get('/api/projects/:id/logs', (req, res) => {
    const { limit = 100 } = req.query;
    
    // 模拟日志数据
    const logs = generateLogs(limit);
    
    res.json(logs);
});

// 清空项目日志
app.delete('/api/projects/:id/logs', (req, res) => {
    const projectId = req.params.id;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        return res.status(404).json({ error: '项目不存在' });
    }
    
    res.json({ 
        message: '项目日志已清空',
        projectId
    });
});

// 获取配置
app.get('/api/config', (req, res) => {
    const config = {
        theme: 'light',
        language: 'zh',
        apiUrl: 'http://localhost:3000',
        logLevel: 'info',
        autoUpdate: true,
        autoBackup: true,
        httpsOnly: false,
        updatedAt: new Date().toISOString()
    };
    
    res.json(config);
});

// 更新配置
app.put('/api/config', (req, res) => {
    const configUpdates = req.body;
    
    // 这里应该保存到配置文件
    const config = {
        ...configUpdates,
        updatedAt: new Date().toISOString()
    };
    
    res.json(config);
});

// 安全存储API路由
app.use('/api/secure', secureConfigRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        secureStorage: {
            available: true,
            algorithm: 'AES-256-GCM',
            api: '/api/secure'
        }
    });
});

// 辅助函数：添加活动记录
function addActivity(type, project, message) {
    const activity = {
        id: uuidv4(),
        type,
        project,
        message,
        timestamp: new Date().toISOString(),
        success: true
    };
    
    activities.push(activity);
    
    // 保持活动记录数量
    if (activities.length > 100) {
        activities = activities.slice(-100);
    }
}

// 辅助函数：生成时间序列数据
function generateTimeSeriesData(points, min, max) {
    const data = [];
    const now = Date.now();
    
    for (let i = points - 1; i >= 0; i--) {
        const timestamp = now - (i * 3600000); // 每小时一个点
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        data.push({ timestamp, value });
    }
    
    return data;
}

// 辅助函数：生成日志
function generateLogs(count) {
    const levels = ['INFO', 'WARNING', 'ERROR', 'SUCCESS'];
    const messages = [
        '项目启动成功',
        '监听端口: 3000',
        '数据库连接成功',
        'API服务已就绪',
        '收到第一个请求',
        '内存使用率较高',
        '磁盘空间不足',
        '外部API调用失败',
        '缓存清理完成',
        '备份任务已开始'
    ];
    
    const logs = [];
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - (i * 60000)).toISOString(); // 每分钟一条
        const level = levels[Math.floor(Math.random() * levels.length)];
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        logs.push({
            timestamp,
            level,
            message,
            source: 'server'
        });
    }
    
    return logs;
}

// 处理所有其他路由，返回前端应用
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
// Socket.io 连接处理
function setupSocketIO() {
    io.on('connection', (socket) => {
        console.log(`客户端连接: ${socket.id}`);
        
        // 加入项目房间
        socket.on('join_project', (projectId) => {
            socket.join(`project-${projectId}`);
            console.log(`客户端 ${socket.id} 加入项目房间: project-${projectId}`);
        });
        
        // 离开项目房间
        socket.on('leave_project', (projectId) => {
            socket.leave(`project-${projectId}`);
            console.log(`客户端 ${socket.id} 离开项目房间: project-${projectId}`);
        });
        
        // 断开连接
        socket.on('disconnect', () => {
            console.log(`客户端断开连接: ${socket.id}`);
        });
    });
}

async function startServer() {
    await initializeData();
    
    // 设置Socket.io
    setupSocketIO();
    
    // 设置全局广播日志函数（用于部署服务）
    global.broadcastLog = (projectId, message) => {
        io.to(`project-${projectId}`).emit('log', {
            timestamp: new Date().toISOString(),
            message: message
        });
    };
    
    server.listen(PORT, () => {
        console.log(`GitHub Deploy Assistant 服务器运行在 http://localhost:${PORT}`);
        console.log(`API地址: http://localhost:${PORT}/api`);
        console.log(`前端地址: http://localhost:${PORT}`);
        console.log(`WebSocket地址: ws://localhost:${PORT}`);
        console.log('AI智能诊断闭环功能已启用');
    });
}

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('收到关闭信号，正在保存数据...');
    await saveData();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('收到中断信号，正在保存数据...');
    await saveData();
    process.exit(0);
});

// 启动服务器
startServer().catch(error => {
    console.error('启动服务器失败:', error);
    process.exit(1);
});

module.exports = app;
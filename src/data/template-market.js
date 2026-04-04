/**
 * 热门项目模板市场数据
 * 包含5-10个经典项目模板，支持一键部署
 * 每个模板包含：仓库地址、预配置环境变量、端口建议、启动命令
 */

const TEMPLATE_MARKET_DATA = [
  // 1. Lobe Chat - 现代化的AI聊天界面
  {
    id: 'lobe-chat-market',
    name: 'Lobe Chat',
    category: 'AI聊天',
    icon: '🤖',
    description: '现代化的 ChatGPT/Claude 聊天界面，支持多模型、插件、语音',
    stars: '45k+',
    repo_url: 'https://github.com/lobehub/lobe-chat',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npm install --ignore-scripts', desc: '安装依赖' },
      { cmd: 'npm run build', desc: '构建生产版本' },
    ],
    start_cmd: 'npm start',
    env_vars: [
      { 
        key: 'OPENAI_API_KEY', 
        desc: 'OpenAI API Key（必填）', 
        required: true,
        placeholder: 'sk-...',
        help: '从 https://platform.openai.com/api-keys 获取'
      },
      { 
        key: 'ACCESS_CODE', 
        desc: '访问密码（可选）', 
        required: false,
        placeholder: '留空则不设密码'
      },
      { 
        key: 'OPENAI_PROXY_URL', 
        desc: 'OpenAI 代理地址（可选）', 
        required: false,
        placeholder: 'https://api.openai.com/v1'
      },
    ],
    port: 3210,
    port_suggestion: '建议使用 3210 端口',
    readme_url: 'https://github.com/lobehub/lobe-chat/blob/main/README.zh-CN.md',
    tags: ['AI', 'ChatGPT', 'Claude', '聊天', '语音'],
    features: ['多模型支持', '插件系统', '语音输入', '主题定制'],
    difficulty: '简单',
    estimated_time: '5-10分钟',
    preview_image: 'https://raw.githubusercontent.com/lobehub/lobe-chat/main/docs/cover.png',
    last_updated: '2026-03-15'
  },

  // 2. Stable Diffusion WebUI - 图像生成AI
  {
    id: 'stable-diffusion-webui-market',
    name: 'Stable Diffusion WebUI',
    category: '图像生成',
    icon: '🎨',
    description: '最流行的 Stable Diffusion Web 界面，支持各种模型和插件',
    stars: '140k+',
    repo_url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui',
    project_type: 'python',
    verified: true,
    setup_steps: [
      { cmd: 'git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git', desc: '克隆仓库' },
      { cmd: 'cd stable-diffusion-webui && python launch.py --listen', desc: '启动WebUI' },
    ],
    start_cmd: 'python launch.py --listen --port 7860 --no-gradio-queue',
    env_vars: [
      { 
        key: 'COMMANDLINE_ARGS', 
        desc: '启动参数', 
        required: false,
        default: '--listen --port 7860 --enable-insecure-extension-access',
        help: '自定义启动参数'
      },
    ],
    port: 7860,
    port_suggestion: '默认端口 7860，需要GPU支持',
    tags: ['AI', '图像生成', 'Stable Diffusion', '绘画'],
    features: ['文生图', '图生图', '模型管理', '插件扩展'],
    difficulty: '中等',
    estimated_time: '15-30分钟（首次需要下载模型）',
    notes: '首次启动会自动下载基础模型，需要较长时间和足够磁盘空间（>10GB）',
    system_requirements: {
      gpu: '推荐 NVIDIA GPU',
      memory: '至少 8GB RAM',
      disk: '至少 20GB 可用空间'
    },
    last_updated: '2026-03-20'
  },

  // 3. Next.js - 现代React框架
  {
    id: 'nextjs-market',
    name: 'Next.js',
    category: 'Web开发',
    icon: '⚛️',
    description: '基于 React 的全栈 Web 框架，支持服务端渲染和静态生成',
    stars: '120k+',
    repo_url: 'https://github.com/vercel/next.js',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npx create-next-app@latest .', desc: '创建Next.js项目' },
      { cmd: 'npm install', desc: '安装依赖' },
    ],
    start_cmd: 'npm run dev',
    env_vars: [
      { 
        key: 'NEXT_PUBLIC_API_URL', 
        desc: 'API地址', 
        required: false,
        placeholder: 'http://localhost:3000/api'
      },
    ],
    port: 3000,
    port_suggestion: '默认开发端口 3000',
    tags: ['React', 'SSR', '全栈', 'TypeScript'],
    features: ['服务端渲染', '静态生成', 'API路由', 'TypeScript支持'],
    difficulty: '简单',
    estimated_time: '2-5分钟',
    demo_command: 'npx create-next-app@latest my-app',
    last_updated: '2026-03-10'
  },

  // 4. FastAPI - 现代Python Web框架
  {
    id: 'fastapi-market',
    name: 'FastAPI',
    category: 'API开发',
    icon: '🚀',
    description: '现代、快速的Python Web框架，用于构建API',
    stars: '70k+',
    repo_url: 'https://github.com/tiangolo/fastapi',
    project_type: 'python',
    verified: true,
    setup_steps: [
      { cmd: 'pip install fastapi uvicorn', desc: '安装FastAPI和服务器' },
      { cmd: 'uvicorn main:app --reload', desc: '启动开发服务器' },
    ],
    start_cmd: 'uvicorn main:app --reload --port 8000',
    env_vars: [
      { 
        key: 'DATABASE_URL', 
        desc: '数据库连接字符串', 
        required: false,
        placeholder: 'postgresql://user:password@localhost/dbname'
      },
    ],
    port: 8000,
    port_suggestion: '默认端口 8000',
    tags: ['Python', 'API', '异步', 'Swagger'],
    features: ['自动API文档', '类型提示', '异步支持', '高性能'],
    difficulty: '简单',
    estimated_time: '3-5分钟',
    example_code: `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}`,
    last_updated: '2026-03-12'
  },

  // 5. WordPress - 内容管理系统
  {
    id: 'wordpress-market',
    name: 'WordPress',
    category: '内容管理',
    icon: '📝',
    description: '全球最流行的博客/CMS平台，生态丰富',
    stars: '18k+',
    repo_url: 'https://github.com/WordPress/WordPress',
    project_type: 'php',
    verified: true,
    setup_steps: [
      { cmd: 'docker-compose up -d', desc: '使用Docker Compose启动' },
    ],
    start_cmd: 'docker-compose up -d',
    env_vars: [
      { 
        key: 'WORDPRESS_DB_HOST', 
        desc: '数据库主机', 
        required: true,
        default: 'db'
      },
      { 
        key: 'WORDPRESS_DB_NAME', 
        desc: '数据库名称', 
        required: true,
        default: 'wordpress'
      },
      { 
        key: 'WORDPRESS_DB_USER', 
        desc: '数据库用户', 
        required: true,
        default: 'wordpress'
      },
      { 
        key: 'WORDPRESS_DB_PASSWORD', 
        desc: '数据库密码', 
        required: true,
        default: 'wordpress'
      },
    ],
    port: 80,
    port_suggestion: 'HTTP端口 80，建议使用Nginx反向代理',
    tags: ['博客', 'CMS', 'PHP', 'MySQL'],
    features: ['可视化编辑', '主题插件', '多用户', 'SEO友好'],
    difficulty: '中等',
    estimated_time: '10-15分钟',
    docker_compose: `version: '3.8'
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
  wordpress:
    image: wordpress:latest
    ports:
      - "80:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress`,
    last_updated: '2026-03-05'
  },

  // 6. Vite - 现代前端构建工具
  {
    id: 'vite-market',
    name: 'Vite',
    category: '前端工具',
    icon: '⚡',
    description: '下一代前端构建工具，极速的开发服务器',
    stars: '65k+',
    repo_url: 'https://github.com/vitejs/vite',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npm create vite@latest .', desc: '创建Vite项目' },
      { cmd: 'npm install', desc: '安装依赖' },
    ],
    start_cmd: 'npm run dev',
    env_vars: [
      { 
        key: 'VITE_API_URL', 
        desc: 'API地址前缀', 
        required: false,
        placeholder: 'http://localhost:3000'
      },
    ],
    port: 5173,
    port_suggestion: '默认开发端口 5173',
    tags: ['构建工具', '开发服务器', 'React', 'Vue'],
    features: ['极速HMR', '按需编译', 'TypeScript支持', '插件系统'],
    difficulty: '简单',
    estimated_time: '2-3分钟',
    template_options: ['vanilla', 'vanilla-ts', 'vue', 'vue-ts', 'react', 'react-ts'],
    last_updated: '2026-03-18'
  },

  // 7. Django - Python全栈框架
  {
    id: 'django-market',
    name: 'Django',
    category: 'Web开发',
    icon: '🐍',
    description: '高级Python Web框架，快速开发安全可维护的网站',
    stars: '75k+',
    repo_url: 'https://github.com/django/django',
    project_type: 'python',
    verified: true,
    setup_steps: [
      { cmd: 'pip install django', desc: '安装Django' },
      { cmd: 'django-admin startproject mysite .', desc: '创建Django项目' },
      { cmd: 'python manage.py runserver', desc: '启动开发服务器' },
    ],
    start_cmd: 'python manage.py runserver 0.0.0.0:8000',
    env_vars: [
      { 
        key: 'SECRET_KEY', 
        desc: 'Django密钥', 
        required: true,
        placeholder: '生成随机密钥'
      },
      { 
        key: 'DEBUG', 
        desc: '调试模式', 
        required: true,
        default: 'True'
      },
    ],
    port: 8000,
    port_suggestion: '默认端口 8000',
    tags: ['Python', '全栈', 'ORM', 'Admin'],
    features: ['自带管理后台', 'ORM数据库', '用户认证', '表单验证'],
    difficulty: '中等',
    estimated_time: '5-10分钟',
    admin_url: 'http://localhost:8000/admin',
    last_updated: '2026-03-08'
  },

  // 8. Express.js - Node.js Web框架
  {
    id: 'expressjs-market',
    name: 'Express.js',
    category: 'API开发',
    icon: '🚂',
    description: '快速、极简的Node.js Web框架',
    stars: '63k+',
    repo_url: 'https://github.com/expressjs/express',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npm init -y', desc: '初始化项目' },
      { cmd: 'npm install express', desc: '安装Express' },
    ],
    start_cmd: 'node server.js',
    env_vars: [
      { 
        key: 'PORT', 
        desc: '服务端口', 
        required: false,
        default: '3000'
      },
      { 
        key: 'NODE_ENV', 
        desc: '运行环境', 
        required: false,
        default: 'development'
      },
    ],
    port: 3000,
    port_suggestion: '默认端口 3000',
    tags: ['Node.js', 'API', '中间件', 'REST'],
    features: ['路由系统', '中间件支持', '模板引擎', 'REST API'],
    difficulty: '简单',
    estimated_time: '3-5分钟',
    example_code: `const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});`,
    last_updated: '2026-03-14'
  },

  // 9. Vue.js - 渐进式JavaScript框架
  {
    id: 'vuejs-market',
    name: 'Vue.js',
    category: '前端框架',
    icon: '🟢',
    description: '渐进式JavaScript框架，易于上手，灵活高效',
    stars: '210k+',
    repo_url: 'https://github.com/vuejs/vue',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npm create vue@latest .', desc: '创建Vue项目' },
      { cmd: 'npm install', desc: '安装依赖' },
    ],
    start_cmd: 'npm run dev',
    env_vars: [
      { 
        key: 'VUE_APP_API_URL', 
        desc: 'API地址', 
        required: false,
        placeholder: 'http://localhost:3000'
      },
    ],
    port: 5173,
    port_suggestion: 'Vite开发端口 5173',
    tags: ['前端', '响应式', '组件化', 'TypeScript'],
    features: ['响应式数据', '组件系统', '单文件组件', '开发工具'],
    difficulty: '简单',
    estimated_time: '2-5分钟',
    template_options: ['vue', 'vue-ts'],
    last_updated: '2026-03-16'
  },

  // 10. React - JavaScript UI库
  {
    id: 'react-market',
    name: 'React',
    category: '前端框架',
    icon: '⚛️',
    description: '用于构建用户界面的JavaScript库',
    stars: '220k+',
    repo_url: 'https://github.com/facebook/react',
    project_type: 'nodejs',
    verified: true,
    setup_steps: [
      { cmd: 'npx create-react-app .', desc: '创建React应用' },
      { cmd: 'npm install', desc: '安装依赖' },
    ],
    start_cmd: 'npm start',
    env_vars: [
      { 
        key: 'REACT_APP_API_URL', 
        desc: 'API地址', 
        required: false,
        placeholder: 'http://localhost:3000'
      },
    ],
    port: 3000,
    port_suggestion: '默认开发端口 3000',
    tags: ['UI', '组件', '虚拟DOM', 'Hooks'],
    features: ['组件化', '虚拟DOM', 'Hooks', '状态管理'],
    difficulty: '简单',
    estimated_time: '3-5分钟',
    last_updated: '2026-03-10'
  }
];

// 按分类分组
function groupTemplatesByCategory(templates) {
  const groups = {};
  templates.forEach(t => {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  });
  return groups;
}

// 获取所有分类
function getAllCategories(templates) {
  return [...new Set(templates.map(t => t.category))];
}

// 搜索模板
function searchTemplates(templates, query) {
  const lq = query.toLowerCase();
  return templates.filter(t => 
    t.name.toLowerCase().includes(lq) ||
    t.description.toLowerCase().includes(lq) ||
    t.tags.some(tag => tag.toLowerCase().includes(lq)) ||
    t.category.toLowerCase().includes(lq)
  );
}

// 按难度过滤
function filterByDifficulty(templates, difficulty) {
  return templates.filter(t => t.difficulty === difficulty);
}

// 获取热门模板（按星标数）
function getPopularTemplates(templates, limit = 6) {
  return [...templates]
    .sort((a, b) => {
      const aStars = parseInt(a.stars) || 0;
      const bStars = parseInt(b.stars) || 0;
      return bStars - aStars;
    })
    .slice(0, limit);
}

module.exports = {
  TEMPLATE_MARKET_DATA,
  groupTemplatesByCategory,
  getAllCategories,
  searchTemplates,
  filterByDifficulty,
  getPopularTemplates
};
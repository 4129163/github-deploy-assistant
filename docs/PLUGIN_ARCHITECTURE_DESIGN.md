# 插件化架构设计文档 - 项目类型识别插件接口

## 概述

本文档定义了GitHub Deploy Assistant的项目类型识别插件化架构。该架构允许社区贡献各种项目类型识别器，支持Node.js、Python、Rust、Java、Go等常见技术栈的自动识别。

## 架构设计

### 核心组件

1. **插件接口 (Plugin Interface)** - 定义插件必须实现的标准化接口
2. **插件加载器 (Plugin Loader)** - 负责发现、加载、注册插件
3. **插件管理器 (Plugin Manager)** - 管理插件生命周期和调用
4. **核心服务抽象 (Core Service Abstraction)** - 提供插件所需的公共服务和工具

### 插件目录结构

```
src/plugins/
├── index.js              # 插件管理器入口
├── loader/               # 插件加载器
│   ├── index.js
│   ├── builtin-loader.js
│   └── external-loader.js
├── interfaces/           # 插件接口定义
│   ├── ProjectTypeDetector.js
│   ├── BasePlugin.js
│   └── index.js
├── detectors/           # 内置检测器插件
│   ├── NodejsDetector.js
│   ├── PythonDetector.js
│   ├── RustDetector.js
│   ├── JavaDetector.js
│   ├── GoDetector.js
│   ├── DockerDetector.js
│   └── index.js
└── external/           # 外部插件加载目录（可配置）
```

## 接口规范

### 1. 基础插件接口 (BasePlugin)

所有插件必须继承的基础接口，定义插件的基本属性和生命周期方法。

```javascript
class BasePlugin {
  constructor() {
    this.name = 'Plugin Name';
    this.version = '1.0.0';
    this.description = 'Plugin description';
    this.author = 'Plugin author';
    this.enabled = true;
  }

  /**
   * 初始化插件
   * @param {Object} context - 插件上下文，包含配置、日志等
   * @returns {Promise<void>}
   */
  async init(context) {
    // 插件初始化逻辑
  }

  /**
   * 销毁插件，释放资源
   * @returns {Promise<void>}
   */
  async destroy() {
    // 清理逻辑
  }

  /**
   * 获取插件信息
   * @returns {Object} 插件元数据
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      enabled: this.enabled
    };
  }
}
```

### 2. 项目类型检测器接口 (ProjectTypeDetector)

专用于项目类型识别的插件接口，扩展自BasePlugin。

```javascript
class ProjectTypeDetector extends BasePlugin {
  constructor() {
    super();
    this.supportedTypes = []; // 支持的检测类型数组
    this.priority = 0; // 检测优先级（0-100，数值越高优先级越高）
  }

  /**
   * 检测项目类型
   * @param {Object} projectInfo - 项目信息对象
   * @param {string} projectInfo.path - 项目路径
   * @param {Object} projectInfo.files - 文件列表和内容
   * @param {Object} projectInfo.stats - 项目统计信息
   * @returns {Promise<DetectionResult>} 检测结果
   */
  async detect(projectInfo) {
    throw new Error('detect method must be implemented');
  }

  /**
   * 验证检测结果
   * @param {DetectionResult} result - 检测结果
   * @returns {Promise<ValidationResult>} 验证结果
   */
  async validate(result) {
    // 默认实现，子类可以覆盖
    return {
      valid: true,
      confidence: result.confidence,
      suggestions: []
    };
  }

  /**
   * 获取支持的检测类型
   * @returns {Array<string>} 支持的类型列表
   */
  getSupportedTypes() {
    return this.supportedTypes;
  }

  /**
   * 获取检测优先级
   * @returns {number} 优先级
   */
  getPriority() {
    return this.priority;
  }
}
```

### 3. 检测结果格式 (DetectionResult)

```javascript
{
  // 检测是否成功
  success: true,
  
  // 检测到的项目类型
  projectType: 'nodejs', // 'python', 'rust', 'java', 'go', 'docker', 'composite', 'unknown'
  
  // 检测置信度（0-1）
  confidence: 0.95,
  
  // 检测到的技术栈详情
  stack: {
    // 运行时环境
    runtime: {
      name: 'node',
      version: '18.0.0',
      required: true
    },
    
    // 构建工具
    buildTool: {
      name: 'npm',
      version: '9.0.0',
      required: true
    },
    
    // 包管理器
    packageManager: {
      name: 'npm',
      version: '9.0.0',
      lockFile: 'package-lock.json'
    },
    
    // 框架信息
    frameworks: [
      {
        name: 'express',
        version: '4.18.2',
        required: true
      }
    ],
    
    // 数据库
    databases: [
      {
        name: 'sqlite3',
        version: '6.0.1',
        required: false
      }
    ]
  },
  
  // 检测到的关键文件
  keyFiles: [
    {
      path: 'package.json',
      exists: true,
      content: {}, // 文件内容摘要
      indicators: ['name', 'version', 'dependencies']
    },
    {
      path: 'server.js',
      exists: true,
      indicators: ['express', 'app.listen']
    }
  ],
  
  // 部署建议
  deployment: {
    // 建议的部署方式
    strategy: 'pm2', // 'systemd', 'docker', 'direct'
    
    // 启动命令
    startCommand: 'npm start',
    
    // 构建命令（如果有）
    buildCommand: 'npm run build',
    
    // 环境变量要求
    envVars: [
      {
        key: 'PORT',
        defaultValue: '3000',
        required: false,
        description: '服务监听端口'
      },
      {
        key: 'NODE_ENV',
        defaultValue: 'production',
        required: false,
        description: 'Node.js环境'
      }
    ],
    
    // 端口信息
    ports: [3000],
    
    // 健康检查端点
    healthCheck: '/api/health'
  },
  
  // 插件信息
  plugin: {
    name: 'NodejsDetector',
    version: '1.0.0',
    detectionTime: '2026-04-05T06:30:00Z'
  },
  
  // 错误信息（如果检测失败）
  error: null,
  
  // 警告信息
  warnings: [
    {
      code: 'W001',
      message: '缺少 .env 文件，建议创建环境变量配置文件',
      severity: 'low' // 'low', 'medium', 'high'
    }
  ]
}
```

## 插件加载机制

### 内置插件加载

内置插件在应用启动时自动加载，优先级高于外部插件。

```javascript
// 内置插件注册
const builtinPlugins = {
  'nodejs': require('./detectors/NodejsDetector'),
  'python': require('./detectors/PythonDetector'),
  'rust': require('./detectors/RustDetector'),
  'java': require('./detectors/JavaDetector'),
  'go': require('./detectors/GoDetector'),
  'docker': require('./detectors/DockerDetector')
};
```

### 外部插件加载

外部插件支持从指定目录动态加载：

1. **目录扫描**：扫描配置的插件目录（如 `./plugins/`）
2. **模块发现**：自动发现符合插件接口的模块
3. **安全验证**：验证插件签名和权限
4. **热加载**：支持运行时插件加载和卸载

### 插件配置

```javascript
// 插件系统配置
const pluginConfig = {
  // 插件目录
  directories: {
    builtin: './src/plugins/detectors',
    external: './plugins', // 可配置的外部插件目录
    user: '~/.github-deploy-assistant/plugins' // 用户级插件目录
  },
  
  // 加载策略
  loading: {
    enableExternal: true, // 是否启用外部插件
    autoLoad: true, // 是否自动加载
    scanInterval: 30000, // 目录扫描间隔（毫秒）
    maxPlugins: 100 // 最大插件数量限制
  },
  
  // 安全设置
  security: {
    requireSignature: false, // 是否要求数字签名
    allowedAuthors: [], // 允许的作者列表（空表示全部允许）
    blockList: [], // 阻止的插件列表
    sandboxMode: true // 是否在沙箱中运行插件
  },
  
  // 性能设置
  performance: {
    timeout: 30000, // 插件执行超时时间（毫秒）
    maxMemory: 256, // 最大内存使用（MB）
    concurrentLimit: 5 // 并发插件执行限制
  }
};
```

## 核心服务抽象

### 服务接口

插件可以通过上下文访问核心服务：

```javascript
class PluginContext {
  constructor() {
    this.config = {}; // 应用配置
    this.logger = {}; // 日志服务
    this.fileSystem = {}; // 文件系统服务
    this.httpClient = {}; // HTTP客户端
    this.cache = {}; // 缓存服务
    this.metrics = {}; // 指标收集
  }
}
```

### 服务提供的方法

1. **文件系统服务**
   - 安全读取文件
   - 文件模式匹配
   - 目录遍历
   - 文件内容分析

2. **日志服务**
   - 分级日志（debug, info, warn, error）
   - 插件专用日志通道
   - 结构化日志输出

3. **HTTP客户端**
   - 安全的HTTP请求
   - 代理支持
   - 重试机制

4. **配置服务**
   - 插件配置管理
   - 环境变量访问
   - 用户偏好设置

## 插件开发指南

### 创建新的检测器插件

1. **实现ProjectTypeDetector接口**

```javascript
const { ProjectTypeDetector } = require('./interfaces/ProjectTypeDetector');

class MyLanguageDetector extends ProjectTypeDetector {
  constructor() {
    super();
    this.name = 'MyLanguageDetector';
    this.version = '1.0.0';
    this.description = '检测MyLanguage项目类型';
    this.author = 'Your Name';
    this.supportedTypes = ['mylang'];
    this.priority = 50;
  }

  async detect(projectInfo) {
    // 检测逻辑
    const hasMyLangFile = projectInfo.files.some(file => 
      file.name === 'mylang.config.json' || 
      file.path.endsWith('.mylang')
    );
    
    if (hasMyLangFile) {
      return {
        success: true,
        projectType: 'mylang',
        confidence: 0.85,
        stack: {
          runtime: {
            name: 'mylang',
            version: '1.0.0',
            required: true
          }
        },
        keyFiles: [
          {
            path: 'mylang.config.json',
            exists: true,
            indicators: ['mylang']
          }
        ],
        deployment: {
          strategy: 'direct',
          startCommand: 'mylang start',
          envVars: [],
          ports: [8080]
        },
        plugin: this.getMetadata()
      };
    }
    
    return {
      success: false,
      projectType: 'unknown',
      confidence: 0,
      error: null
    };
  }
}

module.exports = MyLanguageDetector;
```

2. **注册插件**

内置插件：添加到 `src/plugins/detectors/index.js`
外部插件：放置到配置的插件目录中

### 插件测试

```javascript
// 插件单元测试示例
const MyLanguageDetector = require('./MyLanguageDetector');

describe('MyLanguageDetector', () => {
  let detector;
  
  beforeEach(() => {
    detector = new MyLanguageDetector();
  });
  
  test('should have correct metadata', () => {
    const metadata = detector.getMetadata();
    expect(metadata.name).toBe('MyLanguageDetector');
    expect(metadata.version).toBe('1.0.0');
    expect(metadata.enabled).toBe(true);
  });
  
  test('should detect mylang project', async () => {
    const projectInfo = {
      path: '/test/mylang-project',
      files: [
        { name: 'mylang.config.json', path: 'mylang.config.json' },
        { name: 'main.mylang', path: 'src/main.mylang' }
      ],
      stats: { fileCount: 10, size: 1024 }
    };
    
    const result = await detector.detect(projectInfo);
    expect(result.success).toBe(true);
    expect(result.projectType).toBe('mylang');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

## 集成与使用

### 1. 在现有代码中集成

```javascript
// 在现有项目检测逻辑中集成插件系统
const PluginManager = require('./src/plugins');

class EnhancedProjectDoctor {
  constructor() {
    this.pluginManager = new PluginManager();
    this.pluginManager.init();
  }
  
  async detectProjectType(projectPath) {
    // 收集项目信息
    const projectInfo = await this.collectProjectInfo(projectPath);
    
    // 使用插件系统检测项目类型
    const results = await this.pluginManager.detectProjectType(projectInfo);
    
    // 合并和选择最佳结果
    const bestResult = this.selectBestResult(results);
    
    return bestResult;
  }
  
  // ... 其他方法
}
```

### 2. 配置扩展

```javascript
// 应用配置中增加插件配置
module.exports = {
  // ... 现有配置
  
  plugins: {
    enabled: true,
    directories: {
      builtin: './src/plugins/detectors',
      external: './plugins',
      user: '~/.github-deploy-assistant/plugins'
    },
    security: {
      sandboxMode: true,
      requireSignature: false
    }
  }
};
```

## 版本兼容性

### 版本策略

- **主版本号**：不兼容的API变更
- **次版本号**: 向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 向后兼容性保证

1. 插件接口在同一个主版本内保持稳定
2. 新增接口方法时提供默认实现
3. 废弃的方法会保留至少一个主版本周期

## 安全性考虑

1. **沙箱执行**：外部插件在受限环境中运行
2. **权限控制**：插件需要声明所需权限
3. **输入验证**：所有插件输入都经过验证
4. **资源限制**：限制插件可以使用的资源
5. **审计日志**：记录所有插件操作

## 性能优化

1. **懒加载**：插件按需加载
2. **缓存机制**：检测结果缓存
3. **并行执行**：支持并发检测
4. **资源池**：重用插件实例

## 故障处理

1. **优雅降级**：插件失败不影响主系统
2. **超时控制**：防止插件长时间运行
3. **错误隔离**：插件错误不会传播到主系统
4. **恢复机制**：支持插件重试和恢复

---

## 后续计划

### 短期目标（P2阶段）
1. 实现基础插件接口和加载器
2. 提供内置的常见语言检测器
3. 集成到现有项目检测流程

### 中期目标
1. 支持外部插件动态加载
2. 实现插件市场和社区贡献
3. 添加插件签名和验证机制

### 长期目标
1. 支持更多类型的插件（部署器、监控器等）
2. 实现跨语言插件支持
3. 建立完整的插件生态系统
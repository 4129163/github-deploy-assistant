/**
 * 项目编排DSL解析器
 * 负责解析编排配置YAML/JSON文件，验证语法，提取依赖关系
 */

const yaml = require('yaml');
const { logger } = require('./logger');
const { DependencyManager } = require('./dependency-manager');

class OrchestrationParser {
  constructor() {
    this.schema = this.getSchema();
  }

  /**
   * 获取DSL完整schema
   */
  getSchema() {
    return {
      version: { type: 'string', required: true, pattern: /^1\.\d+$/ },
      name: { type: 'string', required: true, maxLength: 100 },
      description: { type: 'string', required: false },
      applications: {
        type: 'array',
        required: true,
        minLength: 1,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true, pattern: /^[a-z0-9_-]+$/i },
            type: { 
              type: 'string', 
              required: true, 
              enum: ['docker-compose', 'docker', 'node', 'python', 'go', 'java', 'custom'] 
            },
            source: { type: 'string', required: true },
            version: { type: 'string', required: false, default: 'latest' },
            dependencies: { 
              type: 'array', 
              required: false, 
              items: { type: 'string' },
              default: [] 
            },
            environment: { 
              type: 'array', 
              required: false, 
              items: { type: 'string', pattern: /^[A-Z_][A-Z0-9_]*=.+$/ },
              default: [] 
            },
            ports: { 
              type: 'array', 
              required: false, 
              items: { type: 'string', pattern: /^\d+(:\d+)?$/ },
              default: [] 
            },
            volumes: { 
              type: 'array', 
              required: false, 
              items: { type: 'string', pattern: /^.+(:.+)?$/ },
              default: [] 
            },
            command: { type: 'string', required: false },
            health_check: {
              type: 'object',
              required: false,
              properties: {
                endpoint: { type: 'string', required: false },
                interval: { type: 'number', required: false, min: 5, default: 30 },
                timeout: { type: 'number', required: false, min: 1, default: 10 },
                retries: { type: 'number', required: false, min: 1, default: 3 }
              }
            },
            networks: { 
              type: 'array', 
              required: false, 
              items: { type: 'string' },
              default: [] 
            }
          }
        }
      },
      networks: {
        type: 'array',
        required: false,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            driver: { type: 'string', required: false, default: 'bridge' },
            subnet: { type: 'string', required: false }
          }
        },
        default: []
      },
      dependencies: {
        type: 'array',
        required: false,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            type: { 
              type: 'string', 
              required: true, 
              enum: ['external-service', 'database', 'cache', 'message-queue', 'storage'] 
            },
            image: { type: 'string', required: true },
            ports: { 
              type: 'array', 
              required: false, 
              items: { type: 'string' },
              default: [] 
            },
            environment: { 
              type: 'array', 
              required: false, 
              items: { type: 'string' },
              default: [] 
            },
            volumes: { 
              type: 'array', 
              required: false, 
              items: { type: 'string' },
              default: [] 
            }
          }
        },
        default: []
      },
      startup_order: {
        type: 'array',
        required: false,
        items: { type: 'string' }
      }
    };
  }

  /**
   * 解析编排配置
   * @param {string} content - YAML或JSON配置内容
   * @returns {Object} 解析后的配置对象
   */
  parse(content) {
    try {
      let config;
      
      // 尝试解析为YAML
      if (content.trim().startsWith('{')) {
        // JSON格式
        config = JSON.parse(content);
      } else {
        // YAML格式
        config = yaml.parse(content);
      }

      // 验证配置
      const validationResult = this.validate(config);
      if (!validationResult.valid) {
        throw new Error(`配置验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 提取依赖关系
      const dependencies = this.extractDependencies(config);
      
      // 生成启动顺序
      const startupOrder = this.generateStartupOrder(config, dependencies);

      return {
        config,
        dependencies,
        startupOrder,
        validation: validationResult
      };

    } catch (error) {
      logger.error(`解析编排配置失败: ${error.message}`);
      throw new Error(`解析编排配置失败: ${error.message}`);
    }
  }

  /**
   * 验证配置是否符合schema
   * @param {Object} config - 配置对象
   * @returns {Object} 验证结果
   */
  validate(config) {
    const errors = [];
    
    // 检查必需字段
    if (!config.version) {
      errors.push('缺少必需字段: version');
    }
    
    if (!config.name) {
      errors.push('缺少必需字段: name');
    }
    
    if (!config.applications || !Array.isArray(config.applications) || config.applications.length === 0) {
      errors.push('applications必须是非空数组');
    }

    // 验证版本格式
    if (config.version && !/^1\.\d+$/.test(config.version)) {
      errors.push(`版本格式错误: ${config.version}，应为1.x格式`);
    }

    // 验证应用定义
    if (config.applications) {
      const appNames = new Set();
      
      config.applications.forEach((app, index) => {
        // 检查应用名称
        if (!app.name) {
          errors.push(`applications[${index}]缺少name字段`);
        } else if (!/^[a-z0-9_-]+$/i.test(app.name)) {
          errors.push(`applications[${index}]名称格式错误: ${app.name}，只能包含字母、数字、下划线和连字符`);
        } else if (appNames.has(app.name)) {
          errors.push(`applications[${index}]名称重复: ${app.name}`);
        } else {
          appNames.add(app.name);
        }

        // 检查类型
        const validTypes = ['docker-compose', 'docker', 'node', 'python', 'go', 'java', 'custom'];
        if (!app.type || !validTypes.includes(app.type)) {
          errors.push(`applications[${index}]类型错误: ${app.type}，有效类型: ${validTypes.join(', ')}`);
        }

        // 检查source
        if (!app.source) {
          errors.push(`applications[${index}]缺少source字段`);
        }

        // 检查环境变量格式
        if (app.environment) {
          app.environment.forEach((env, envIndex) => {
            if (!/^[A-Z_][A-Z0-9_]*=.+$/.test(env)) {
              errors.push(`applications[${index}].environment[${envIndex}]格式错误: ${env}，应为KEY=VALUE格式`);
            }
          });
        }

        // 检查端口格式
        if (app.ports) {
          app.ports.forEach((port, portIndex) => {
            if (!/^\d+(:\d+)?$/.test(port)) {
              errors.push(`applications[${index}].ports[${portIndex}]格式错误: ${port}，应为"端口"或"主机端口:容器端口"格式`);
            }
          });
        }

        // 检查依赖是否存在
        if (app.dependencies) {
          app.dependencies.forEach((dep, depIndex) => {
            // 检查是否是应用依赖
            const isAppDep = config.applications.some(a => a.name === dep);
            // 检查是否是外部依赖
            const isExternalDep = config.dependencies && config.dependencies.some(d => d.name === dep);
            
            if (!isAppDep && !isExternalDep) {
              errors.push(`applications[${index}].dependencies[${depIndex}]依赖不存在: ${dep}`);
            }
          });
        }
      });
    }

    // 检查启动顺序中的应用是否存在
    if (config.startup_order) {
      const allNames = new Set();
      if (config.applications) {
        config.applications.forEach(app => allNames.add(app.name));
      }
      if (config.dependencies) {
        config.dependencies.forEach(dep => allNames.add(dep.name));
      }

      config.startup_order.forEach((appName, index) => {
        if (!allNames.has(appName)) {
          errors.push(`startup_order[${index}]应用不存在: ${appName}`);
        }
      });
    }

    // 检查循环依赖
    if (config.applications) {
      // 构建临时依赖图进行检查
      const tempDepManager = new DependencyManager();
      tempDepManager.buildGraph(config.applications || [], config.dependencies || []);
      const cycleResult = tempDepManager.detectCycles();
      if (cycleResult.hasCycles) {
        errors.push(`发现循环依赖: ${cycleResult.cycles[0]?.join(' -> ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 提取依赖关系图
   * @param {Object} config - 配置对象
   * @returns {Object} 依赖关系图
   */
  extractDependencies(config) {
    const graph = {
      nodes: new Set(),
      edges: [],
      adjacency: new Map()
    };

    // 添加所有节点
    if (config.applications) {
      config.applications.forEach(app => {
        graph.nodes.add(app.name);
        graph.adjacency.set(app.name, []);
      });
    }

    if (config.dependencies) {
      config.dependencies.forEach(dep => {
        graph.nodes.add(dep.name);
        graph.adjacency.set(dep.name, []);
      });
    }

    // 添加边
    if (config.applications) {
      config.applications.forEach(app => {
        if (app.dependencies) {
          app.dependencies.forEach(dep => {
            graph.edges.push({ from: dep, to: app.name });
            const deps = graph.adjacency.get(app.name) || [];
            deps.push(dep);
            graph.adjacency.set(app.name, deps);
          });
        }
      });
    }

    return graph;
  }

  /**
   * 检测循环依赖
   * @param {Object} config - 配置对象
   * @returns {Object} 检测结果
   */
  detectCyclicDependencies(config) {
    const graph = this.extractDependencies(config);
    const visited = new Set();
    const recursionStack = new Set();
    const cycle = [];

    const dfs = (node, path) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.adjacency.get(node) || [];
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, path)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // 找到循环
          const startIndex = path.indexOf(neighbor);
          cycle.push(...path.slice(startIndex));
          cycle.push(neighbor); // 闭合循环
          return true;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        const path = [];
        if (dfs(node, path)) {
          break;
        }
      }
    }

    return {
      hasCycle: cycle.length > 0,
      cycle
    };
  }

  /**
   * 生成启动顺序
   * @param {Object} config - 配置对象
   * @param {Object} dependencies - 依赖关系图
   * @returns {Array} 启动顺序数组
   */
  generateStartupOrder(config, dependencies) {
    // 如果用户指定了启动顺序，使用用户的顺序
    if (config.startup_order && config.startup_order.length > 0) {
      return config.startup_order;
    }

    // 否则使用拓扑排序生成启动顺序
    return this.topologicalSort(dependencies);
  }

  /**
   * 拓扑排序
   * @param {Object} graph - 依赖关系图
   * @returns {Array} 拓扑排序结果
   */
  topologicalSort(graph) {
    const inDegree = new Map();
    const result = [];
    const queue = [];

    // 初始化入度
    for (const node of graph.nodes) {
      inDegree.set(node, 0);
    }

    // 计算入度
    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // 将入度为0的节点加入队列
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // 执行拓扑排序
    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);

      const neighbors = graph.adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 检查是否有循环依赖
    if (result.length !== graph.nodes.size) {
      throw new Error('存在循环依赖，无法生成启动顺序');
    }

    return result;
  }

  /**
   * 解析文件
   * @param {string} filePath - 配置文件路径
   * @returns {Object} 解析结果
   */
  async parseFile(filePath) {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      logger.error(`读取编排配置文件失败: ${error.message}`);
      throw new Error(`读取编排配置文件失败: ${error.message}`);
    }
  }

  /**
   * 生成示例配置
   * @param {string} templateName - 模板名称
   * @returns {Object} 示例配置
   */
  generateExample(templateName = 'lobe-chat-minio') {
    const examples = {
      'lobe-chat-minio': {
        version: '1.0',
        name: 'lobe-chat-minio-stack',
        description: 'Lobe Chat AI助手与MinIO对象存储组合部署',
        applications: [
          {
            name: 'minio',
            type: 'docker',
            source: 'minio/minio:latest',
            environment: [
              'MINIO_ROOT_USER=admin',
              'MINIO_ROOT_PASSWORD=password123'
            ],
            ports: ['9000:9000', '9001:9001'],
            volumes: ['./minio-data:/data'],
            command: 'server /data --console-address :9001',
            health_check: {
              endpoint: '/minio/health/live',
              interval: 30
            }
          },
          {
            name: 'lobe-chat',
            type: 'docker-compose',
            source: 'https://github.com/lobehub/lobe-chat',
            version: 'main',
            dependencies: ['minio'],
            environment: [
              'STORAGE_TYPE=minio',
              'MINIO_ENDPOINT=http://minio:9000',
              'MINIO_ACCESS_KEY=admin',
              'MINIO_SECRET_KEY=password123',
              'MINIO_BUCKET=lobe-chat'
            ],
            ports: ['3210:3210']
          }
        ],
        networks: [
          {
            name: 'chat-network',
            driver: 'bridge'
          }
        ],
        startup_order: ['minio', 'lobe-chat']
      },
      'node-redis-postgres': {
        version: '1.0',
        name: 'node-redis-pg-stack',
        description: 'Node.js应用 + Redis缓存 + PostgreSQL数据库',
        applications: [
          {
            name: 'node-app',
            type: 'node',
            source: 'https://github.com/user/node-app',
            version: 'main',
            dependencies: ['postgres', 'redis'],
            environment: [
              'DATABASE_URL=postgresql://admin:secret@postgres:5432/myapp',
              'REDIS_URL=redis://redis:6379'
            ],
            ports: ['3000:3000']
          }
        ],
        dependencies: [
          {
            name: 'postgres',
            type: 'database',
            image: 'postgres:15-alpine',
            environment: [
              'POSTGRES_DB=myapp',
              'POSTGRES_USER=admin',
              'POSTGRES_PASSWORD=secret'
            ],
            ports: ['5432:5432'],
            volumes: ['./postgres-data:/var/lib/postgresql/data']
          },
          {
            name: 'redis',
            type: 'cache',
            image: 'redis:7-alpine',
            ports: ['6379:6379'],
            volumes: ['./redis-data:/data']
          }
        ],
        startup_order: ['postgres', 'redis', 'node-app']
      }
    };

    return examples[templateName] || examples['lobe-chat-minio'];
  }
}

module.exports = { OrchestrationParser };
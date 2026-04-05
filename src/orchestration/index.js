/**
 * 项目编排服务主入口
 * 整合DSL解析器、依赖管理器、部署执行器
 */

const path = require('path');
const fs = require('fs-extra');
const { logger } = require('./logger');
const { OrchestrationParser } = require('./parser');
const { DependencyManager } = require('./dependency-manager');
const { OrchestrationDeployer } = require('./deployer');

class OrchestrationService {
  constructor() {
    this.parser = new OrchestrationParser();
    this.dependencyManager = new DependencyManager();
    this.activeDeployments = new Map();
  }

  /**
   * 解析编排配置
   * @param {string|Object} config - 配置内容或文件路径
   * @returns {Object} 解析结果
   */
  async parseConfig(config) {
    try {
      let parseResult;
      
      if (typeof config === 'string') {
        // 检查是否是文件路径
        if (await fs.pathExists(config) && (await fs.stat(config)).isFile()) {
          parseResult = await this.parser.parseFile(config);
        } else {
          parseResult = this.parser.parse(config);
        }
      } else if (typeof config === 'object') {
        // 直接使用配置对象
        parseResult = this.parser.parse(JSON.stringify(config));
      } else {
        throw new Error('配置必须是字符串（文件路径或配置内容）或对象');
      }

      // 构建依赖图
      this.dependencyManager.buildGraph(
        parseResult.config.applications || [],
        parseResult.config.dependencies || []
      );

      // 检测循环依赖
      const cycleResult = this.dependencyManager.detectCycles();
      if (cycleResult.hasCycles) {
        throw new Error(cycleResult.message);
      }

      // 生成启动顺序（如果未指定）
      if (!parseResult.config.startup_order || parseResult.config.startup_order.length === 0) {
        parseResult.config.startup_order = this.dependencyManager.topologicalSort();
      }

      // 验证启动顺序
      const validationResult = this.dependencyManager.validateStartupOrder(parseResult.config.startup_order);
      if (!validationResult.valid) {
        throw new Error(`启动顺序验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 获取并行启动组
      const parallelGroups = this.dependencyManager.getParallelGroups();

      return {
        success: true,
        config: parseResult.config,
        dependencies: this.dependencyManager.generateVisualization(),
        startupOrder: parseResult.config.startup_order,
        parallelGroups,
        validation: validationResult
      };

    } catch (error) {
      logger.error(`解析编排配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行编排部署
   * @param {string|Object} config - 配置内容或文件路径
   * @param {Object} options - 部署选项
   * @returns {Object} 部署结果
   */
  async deploy(config, options = {}) {
    try {
      // 解析配置
      const parseResult = await this.parseConfig(config);
      if (!parseResult.success) {
        throw new Error(`配置解析失败: ${parseResult.error}`);
      }

      // 创建部署器
      const deployer = new OrchestrationDeployer(parseResult.config);
      
      // 应用选项
      if (options.parallel) {
        // TODO: 实现并行部署
        logger.info('并行部署选项已启用');
      }

      if (options.timeout) {
        // TODO: 实现超时控制
        logger.info(`部署超时设置为: ${options.timeout}ms`);
      }

      // 执行部署
      const deploymentResult = await deployer.deploy();
      
      // 保存部署引用
      this.activeDeployments.set(deploymentResult.deploymentId, deployer);

      return {
        success: deploymentResult.success,
        deploymentId: deploymentResult.deploymentId,
        state: deploymentResult.state,
        parseResult: parseResult
      };

    } catch (error) {
      logger.error(`编排部署失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取部署状态
   * @param {string} deploymentId - 部署ID
   * @returns {Object} 部署状态
   */
  getDeploymentStatus(deploymentId) {
    const deployer = this.activeDeployments.get(deploymentId);
    
    if (!deployer) {
      return {
        success: false,
        error: `部署未找到: ${deploymentId}`
      };
    }

    return {
      success: true,
      deploymentId,
      state: deployer.getState()
    };
  }

  /**
   * 获取部署日志
   * @param {string} deploymentId - 部署ID
   * @param {string} appName - 应用名称（可选）
   * @returns {Object} 日志信息
   */
  async getDeploymentLogs(deploymentId, appName = null) {
    const deployer = this.activeDeployments.get(deploymentId);
    
    if (!deployer) {
      return {
        success: false,
        error: `部署未找到: ${deploymentId}`
      };
    }

    try {
      if (appName) {
        // 获取单个应用日志
        const logs = await deployer.getAppLogs(appName);
        return {
          success: true,
          deploymentId,
          appName,
          logs
        };
      } else {
        // 获取所有应用日志
        const state = deployer.getState();
        const allLogs = {};
        
        for (const appName in state.applications) {
          try {
            const logs = await deployer.getAppLogs(appName);
            allLogs[appName] = logs;
          } catch (error) {
            allLogs[appName] = `获取日志失败: ${error.message}`;
          }
        }

        return {
          success: true,
          deploymentId,
          logs: allLogs
        };
      }

    } catch (error) {
      logger.error(`获取部署日志失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停止部署
   * @param {string} deploymentId - 部署ID
   * @returns {Object} 停止结果
   */
  async stopDeployment(deploymentId) {
    const deployer = this.activeDeployments.get(deploymentId);
    
    if (!deployer) {
      return {
        success: false,
        error: `部署未找到: ${deploymentId}`
      };
    }

    try {
      await deployer.cleanup();
      this.activeDeployments.delete(deploymentId);
      
      return {
        success: true,
        deploymentId,
        message: '部署已停止并清理'
      };

    } catch (error) {
      logger.error(`停止部署失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 列出所有活跃部署
   * @returns {Array} 部署列表
   */
  listDeployments() {
    const deployments = [];
    
    for (const [deploymentId, deployer] of this.activeDeployments) {
      const state = deployer.getState();
      deployments.push({
        deploymentId,
        name: state.name,
        status: state.status,
        startTime: state.startTime,
        applications: Object.keys(state.applications).length
      });
    }

    return deployments;
  }

  /**
   * 生成示例配置
   * @param {string} template - 模板名称
   * @param {string} outputPath - 输出路径
   * @returns {Object} 生成结果
   */
  async generateExample(template = 'lobe-chat-minio', outputPath = null) {
    try {
      const example = this.parser.generateExample(template);
      
      if (outputPath) {
        const yaml = require('yaml');
        const content = yaml.stringify(example);
        await fs.writeFile(outputPath, content);
        
        return {
          success: true,
          template,
          outputPath,
          config: example
        };
      } else {
        return {
          success: true,
          template,
          config: example
        };
      }

    } catch (error) {
      logger.error(`生成示例配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 验证配置文件
   * @param {string} filePath - 配置文件路径
   * @returns {Object} 验证结果
   */
  async validateConfigFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`配置文件不存在: ${filePath}`);
      }

      const parseResult = await this.parseConfig(filePath);
      
      if (!parseResult.success) {
        return parseResult;
      }

      // 额外验证：检查端口冲突
      const portConflicts = this.detectPortConflicts(parseResult.config);
      
      return {
        success: true,
        config: parseResult.config,
        validation: {
          syntax: 'valid',
          dependencies: 'valid',
          startupOrder: 'valid',
          portConflicts: portConflicts.length > 0 ? 'conflict' : 'valid',
          conflicts: portConflicts
        }
      };

    } catch (error) {
      logger.error(`验证配置文件失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检测端口冲突
   * @param {Object} config - 配置对象
   * @returns {Array} 冲突列表
   */
  detectPortConflicts(config) {
    const portMap = new Map();
    const conflicts = [];

    // 收集所有端口
    const collectPorts = (app) => {
      if (!app.ports || !Array.isArray(app.ports)) {
        return;
      }

      app.ports.forEach(portMapping => {
        const [hostPort] = portMapping.split(':');
        const port = parseInt(hostPort, 10);
        
        if (!isNaN(port)) {
          if (portMap.has(port)) {
            conflicts.push({
              port,
              apps: [...portMap.get(port), app.name]
            });
          } else {
            portMap.set(port, [app.name]);
          }
        }
      });
    };

    // 检查应用
    if (config.applications) {
      config.applications.forEach(collectPorts);
    }

    // 检查依赖
    if (config.dependencies) {
      config.dependencies.forEach(collectPorts);
    }

    return conflicts;
  }

  /**
   * 获取依赖分析
   * @param {Object} config - 配置对象
   * @returns {Object} 依赖分析结果
   */
  analyzeDependencies(config) {
    try {
      this.dependencyManager.buildGraph(
        config.applications || [],
        config.dependencies || []
      );

      const analysis = {
        totalNodes: this.dependencyManager.graph.nodes.size,
        totalEdges: this.dependencyManager.getEdgeCount(),
        cycles: this.dependencyManager.detectCycles(),
        topologicalOrder: this.dependencyManager.topologicalSort(),
        parallelGroups: this.dependencyManager.getParallelGroups(),
        visualization: this.dependencyManager.generateVisualization()
      };

      return {
        success: true,
        analysis
      };

    } catch (error) {
      logger.error(`依赖分析失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 导出部署配置
   * @param {string} deploymentId - 部署ID
   * @param {string} format - 导出格式 (json|yaml|docker-compose)
   * @returns {Object} 导出结果
   */
  async exportDeployment(deploymentId, format = 'json') {
    const deployer = this.activeDeployments.get(deploymentId);
    
    if (!deployer) {
      return {
        success: false,
        error: `部署未找到: ${deploymentId}`
      };
    }

    try {
      const state = deployer.getState();
      const config = this.activeDeployments.get(deploymentId)?.config;
      
      if (!config) {
        throw new Error('无法获取原始配置');
      }

      let exportContent;
      
      switch (format.toLowerCase()) {
        case 'json':
          exportContent = JSON.stringify({
            deploymentId,
            config,
            state,
            exportTime: new Date().toISOString()
          }, null, 2);
          break;
          
        case 'yaml':
          const yaml = require('yaml');
          exportContent = yaml.stringify({
            deploymentId,
            config,
            state,
            exportTime: new Date().toISOString()
          });
          break;
          
        case 'docker-compose':
          exportContent = this.generateDockerComposeExport(config, state);
          break;
          
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }

      return {
        success: true,
        deploymentId,
        format,
        content: exportContent
      };

    } catch (error) {
      logger.error(`导出部署配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成Docker Compose导出
   * @param {Object} config - 配置对象
   * @param {Object} state - 部署状态
   * @returns {string} Docker Compose内容
   */
  generateDockerComposeExport(config, state) {
    const services = {};
    const networks = {};

    // 添加网络
    if (config.networks && Array.isArray(config.networks)) {
      config.networks.forEach(network => {
        networks[network.name] = {
          driver: network.driver || 'bridge',
          ...(network.subnet ? { ipam: { config: [{ subnet: network.subnet }] } } : {})
        };
      });
    }

    // 添加依赖服务
    if (config.dependencies && Array.isArray(config.dependencies)) {
      config.dependencies.forEach(dep => {
        services[dep.name] = {
          image: dep.image,
          ...(dep.environment && dep.environment.length > 0 ? { environment: dep.environment } : {}),
          ...(dep.ports && dep.ports.length > 0 ? { ports: dep.ports } : {}),
          ...(dep.volumes && dep.volumes.length > 0 ? { volumes: dep.volumes } : {}),
          ...(config.networks && config.networks.length > 0 ? { networks: config.networks.map(n => n.name) } : {}),
          restart: 'unless-stopped'
        };
      });
    }

    // 添加应用服务
    if (config.applications && Array.isArray(config.applications)) {
      config.applications.forEach(app => {
        services[app.name] = {
          ...(app.type === 'docker' ? { image: app.source } : { build: '.' }),
          ...(app.environment && app.environment.length > 0 ? { environment: app.environment } : {}),
          ...(app.ports && app.ports.length > 0 ? { ports: app.ports } : {}),
          ...(app.volumes && app.volumes.length > 0 ? { volumes: app.volumes } : {}),
          ...(config.networks && config.networks.length > 0 ? { networks: config.networks.map(n => n.name) } : {}),
          ...(app.command ? { command: app.command } : {}),
          restart: 'unless-stopped',
          depends_on: app.dependencies || []
        };
      });
    }

    const compose = {
      version: '3.8',
      services,
      networks
    };

    const yaml = require('yaml');
    return yaml.stringify(compose);
  }
}

module.exports = { OrchestrationService };
/**
 * 依赖管理器
 * 负责处理应用依赖关系，生成启动顺序，检测循环依赖
 */

const { logger } = require('./logger');

class DependencyManager {
  constructor() {
    this.graph = {
      nodes: new Map(), // name -> node object
      edges: new Map(), // from -> Set(to)
      reverseEdges: new Map() // to -> Set(from)
    };
  }

  /**
   * 构建依赖图
   * @param {Array} applications - 应用列表
   * @param {Array} dependencies - 外部依赖列表
   */
  buildGraph(applications = [], dependencies = []) {
    this.clearGraph();
    
    // 添加所有节点
    [...applications, ...dependencies].forEach(node => {
      this.addNode(node.name, node);
    });

    // 添加依赖边
    applications.forEach(app => {
      if (app.dependencies && Array.isArray(app.dependencies)) {
        app.dependencies.forEach(depName => {
          this.addEdge(depName, app.name);
        });
      }
    });

    logger.debug(`依赖图构建完成: ${this.graph.nodes.size}个节点, ${this.getEdgeCount()}条边`);
  }

  /**
   * 添加节点
   * @param {string} name - 节点名称
   * @param {Object} data - 节点数据
   */
  addNode(name, data) {
    if (!this.graph.nodes.has(name)) {
      this.graph.nodes.set(name, data);
      this.graph.edges.set(name, new Set());
      this.graph.reverseEdges.set(name, new Set());
    } else {
      // 合并数据
      const existing = this.graph.nodes.get(name);
      this.graph.nodes.set(name, { ...existing, ...data });
    }
  }

  /**
   * 添加依赖边
   * @param {string} from - 依赖源
   * @param {string} to - 依赖目标
   */
  addEdge(from, to) {
    // 确保节点存在
    if (!this.graph.nodes.has(from)) {
      this.addNode(from, { name: from, type: 'missing' });
    }
    if (!this.graph.nodes.has(to)) {
      this.addNode(to, { name: to, type: 'missing' });
    }

    // 添加正向边
    const fromEdges = this.graph.edges.get(from);
    fromEdges.add(to);
    
    // 添加反向边
    const toReverseEdges = this.graph.reverseEdges.get(to);
    toReverseEdges.add(from);
  }

  /**
   * 获取边数量
   * @returns {number} 边数量
   */
  getEdgeCount() {
    let count = 0;
    for (const edges of this.graph.edges.values()) {
      count += edges.size;
    }
    return count;
  }

  /**
   * 清空图
   */
  clearGraph() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };
  }

  /**
   * 检测循环依赖
   * @returns {Object} 检测结果
   */
  detectCycles() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];
    const path = [];

    const dfs = (node) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.graph.edges.get(node) || new Set();
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // 找到循环
          const startIndex = path.indexOf(neighbor);
          const cycle = path.slice(startIndex);
          cycle.push(neighbor); // 闭合循环
          cycles.push(cycle);
          return true;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    };

    for (const node of this.graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles: cycles,
      message: cycles.length > 0 
        ? `发现${cycles.length}个循环依赖: ${cycles.map(c => c.join(' -> ')).join('; ')}`
        : '无循环依赖'
    };
  }

  /**
   * 拓扑排序
   * @returns {Array} 拓扑排序结果
   */
  topologicalSort() {
    const inDegree = new Map();
    const result = [];
    const queue = [];

    // 初始化入度
    for (const node of this.graph.nodes.keys()) {
      inDegree.set(node, 0);
    }

    // 计算入度
    for (const [node, edges] of this.graph.edges) {
      for (const neighbor of edges) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
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

      const neighbors = this.graph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 检查是否有循环依赖
    if (result.length !== this.graph.nodes.size) {
      const cycleResult = this.detectCycles();
      throw new Error(`存在循环依赖，无法生成拓扑排序。${cycleResult.message}`);
    }

    return result;
  }

  /**
   * 获取节点的直接依赖
   * @param {string} nodeName - 节点名称
   * @returns {Array} 直接依赖列表
   */
  getDirectDependencies(nodeName) {
    const edges = this.graph.reverseEdges.get(nodeName);
    return edges ? Array.from(edges) : [];
  }

  /**
   * 获取节点的直接被依赖
   * @param {string} nodeName - 节点名称
   * @returns {Array} 直接被依赖列表
   */
  getDirectDependents(nodeName) {
    const edges = this.graph.edges.get(nodeName);
    return edges ? Array.from(edges) : [];
  }

  /**
   * 获取节点的所有依赖（递归）
   * @param {string} nodeName - 节点名称
   * @returns {Array} 所有依赖列表
   */
  getAllDependencies(nodeName) {
    const result = new Set();
    const visited = new Set();

    const dfs = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependencies = this.getDirectDependencies(node);
      dependencies.forEach(dep => {
        result.add(dep);
        dfs(dep);
      });
    };

    dfs(nodeName);
    return Array.from(result);
  }

  /**
   * 获取节点的所有被依赖（递归）
   * @param {string} nodeName - 节点名称
   * @returns {Array} 所有被依赖列表
   */
  getAllDependents(nodeName) {
    const result = new Set();
    const visited = new Set();

    const dfs = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependents = this.getDirectDependents(node);
      dependents.forEach(dep => {
        result.add(dep);
        dfs(dep);
      });
    };

    dfs(nodeName);
    return Array.from(result);
  }

  /**
   * 获取可并行启动的组
   * @returns {Array} 并行启动组
   */
  getParallelGroups() {
    const topoOrder = this.topologicalSort();
    const groups = [];
    let currentGroup = [];

    for (const node of topoOrder) {
      // 检查当前节点是否可以加入当前组
      // 条件是：当前节点的所有依赖都不在当前组中
      const dependencies = this.getAllDependencies(node);
      const canAdd = !currentGroup.some(groupNode => 
        dependencies.includes(groupNode)
      );

      if (canAdd) {
        currentGroup.push(node);
      } else {
        // 开始新的一组
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [node];
      }
    }

    // 添加最后一组
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * 验证启动顺序
   * @param {Array} startupOrder - 启动顺序
   * @returns {Object} 验证结果
   */
  validateStartupOrder(startupOrder) {
    const errors = [];
    const started = new Set();

    for (let i = 0; i < startupOrder.length; i++) {
      const node = startupOrder[i];
      
      // 检查节点是否存在
      if (!this.graph.nodes.has(node)) {
        errors.push(`节点不存在: ${node}`);
        continue;
      }

      // 检查依赖是否已启动
      const dependencies = this.getDirectDependencies(node);
      const missingDeps = dependencies.filter(dep => !started.has(dep));
      
      if (missingDeps.length > 0) {
        errors.push(`节点 ${node} 的依赖未启动: ${missingDeps.join(', ')}`);
      }

      started.add(node);
    }

    // 检查是否所有节点都包含在内
    const allNodes = Array.from(this.graph.nodes.keys());
    const missingNodes = allNodes.filter(node => !startupOrder.includes(node));
    
    if (missingNodes.length > 0) {
      errors.push(`启动顺序缺少节点: ${missingNodes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 生成可视化依赖图
   * @returns {Object} 依赖图数据
   */
  generateVisualization() {
    const nodes = [];
    const edges = [];

    // 生成节点
    for (const [name, data] of this.graph.nodes) {
      nodes.push({
        id: name,
        label: name,
        type: data.type || 'unknown',
        ...data
      });
    }

    // 生成边
    for (const [from, toSet] of this.graph.edges) {
      for (const to of toSet) {
        edges.push({
          from: from,
          to: to,
          id: `${from}->${to}`
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * 根据优先级调整启动顺序
   * @param {Array} priorities - 优先级配置 {name: priority}
   * @returns {Array} 调整后的启动顺序
   */
  adjustByPriority(priorities = {}) {
    const topoOrder = this.topologicalSort();
    
    // 对每个拓扑层级进行排序
    const levelMap = new Map();
    const indegree = new Map();

    // 计算入度
    for (const node of this.graph.nodes.keys()) {
      indegree.set(node, 0);
    }
    for (const [node, edges] of this.graph.edges) {
      for (const neighbor of edges) {
        indegree.set(neighbor, indegree.get(neighbor) + 1);
      }
    }

    // 按拓扑层级分组
    const queue = [];
    for (const [node, degree] of indegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    let level = 0;
    while (queue.length > 0) {
      const levelSize = queue.length;
      const currentLevel = [];

      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift();
        currentLevel.push(node);

        // 更新邻居入度
        const neighbors = this.graph.edges.get(node) || new Set();
        for (const neighbor of neighbors) {
          indegree.set(neighbor, indegree.get(neighbor) - 1);
          if (indegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }

      // 按优先级排序当前层级
      currentLevel.sort((a, b) => {
        const priorityA = priorities[a] || 0;
        const priorityB = priorities[b] || 0;
        return priorityB - priorityA; // 优先级高的先启动
      });

      levelMap.set(level, currentLevel);
      level++;
    }

    // 展平结果
    const result = [];
    for (let i = 0; i < level; i++) {
      result.push(...(levelMap.get(i) || []));
    }

    return result;
  }
}

module.exports = { DependencyManager };
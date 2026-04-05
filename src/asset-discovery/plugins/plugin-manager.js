/**
 * 插件管理器
 * 管理资产发现的插件和规则，支持动态扩展
 * 设计目标：让用户和开发者都能轻松扩展功能
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PluginManager {
  constructor(pluginDir = null) {
    this.pluginDir = pluginDir || this.getDefaultPluginDir();
    this.rulesDir = path.join(this.pluginDir, 'rules');
    this.plugins = {};
    this.rules = {};
    this.initialized = false;
    
    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 获取默认插件目录
   */
  getDefaultPluginDir() {
    const homeDir = os.homedir();
    const platform = os.platform();
    
    if (platform === 'win32') {
      return path.join(homeDir, 'AppData', 'Local', 'gada-asset-discovery', 'plugins');
    } else if (platform === 'darwin') {
      return path.join(homeDir, 'Library', 'Application Support', 'gada-asset-discovery', 'plugins');
    } else {
      return path.join(homeDir, '.config', 'gada-asset-discovery', 'plugins');
    }
  }

  /**
   * 确保必要的目录存在
   */
  ensureDirectories() {
    const dirs = [this.pluginDir, this.rulesDir];
    
    for (const dir of dirs) {
      try {
        fs.ensureDirSync(dir);
      } catch (error) {
        console.warn(`⚠️ 无法创建目录 ${dir}:`, error.message);
      }
    }
  }

  /**
   * 初始化插件管理器
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    console.log('🔌 初始化插件系统...');
    
    try {
      // 加载内置规则
      await this.loadBuiltinRules();
      
      // 加载用户规则
      await this.loadUserRules();
      
      // 加载插件
      await this.loadPlugins();
      
      this.initialized = true;
      console.log(`✅ 插件系统初始化完成`);
      console.log(`   📁 插件目录: ${this.pluginDir}`);
      console.log(`   📋 加载规则: ${Object.keys(this.rules).length}个`);
      console.log(`   🔧 加载插件: ${Object.keys(this.plugins).length}个`);
      
    } catch (error) {
      console.error('❌ 插件系统初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 加载内置规则
   */
  async loadBuiltinRules() {
    const builtinRules = {
      // OpenClaw/龙虾类程序
      'OpenClaw': {
        name: 'OpenClaw',
        description: '开源智能体框架，类似AI助手',
        category: 'ai-agent',
        processNames: ['openclaw', 'claw', 'claw-agent', 'openclawd'],
        cmdlinePatterns: ['--agent', '--serve', '--api', '--port', 'claw'],
        defaultPorts: [3000, 5000, 8000, 8080],
        directoryPatterns: [
          '~/.openclaw',
          '~/.config/openclaw',
          '~/openclaw',
          '/opt/openclaw',
          '/usr/local/openclaw'
        ],
        fileFingerprints: [
          { name: 'config.json', contains: ['openclaw', 'claw', 'agent'] },
          { name: 'package.json', contains: ['openclaw'] },
          { name: 'docker-compose.yml', contains: ['openclaw'] }
        ],
        installationCommands: [
          'git clone https://github.com/openclaw/openclaw.git',
          'pip install openclaw',
          'npm install -g openclaw'
        ],
        website: 'https://github.com/openclaw/openclaw',
        riskLevel: 'low',
        tags: ['ai', 'agent', 'assistant', 'automation']
      },
      
      // AI Agent类程序
      'AI-Agent': {
        name: 'AI-Agent',
        description: '通用AI智能体程序',
        category: 'ai-agent',
        processNames: ['ai-agent', 'agent-service', 'llm-agent', 'ai-assistant'],
        cmdlinePatterns: ['--ai', '--model', '--llm', '--gpt', '--assistant'],
        defaultPorts: [7860, 8888, 9999, 5000],
        directoryPatterns: [
          '~/.ai-agents',
          '~/ai-projects',
          '/opt/ai',
          '/usr/local/ai'
        ],
        fileFingerprints: [
          { name: 'config.yaml', contains: ['ai', 'agent', 'model'] },
          { name: '.env', contains: ['OPENAI_API_KEY', 'API_KEY'] }
        ],
        tags: ['ai', 'llm', 'chatgpt', 'assistant']
      },
      
      // 数据爬虫类
      'WebCrawler': {
        name: 'WebCrawler',
        description: '网络爬虫/数据采集程序',
        category: 'data-collection',
        processNames: ['crawler', 'spider', 'scraper', 'crawl-agent'],
        cmdlinePatterns: ['--crawl', '--spider', '--scrape', '--url'],
        defaultPorts: [6800, 8081, 5001],
        directoryPatterns: [
          '~/.crawler',
          '~/crawlers',
          '/opt/scrapy'
        ],
        fileFingerprints: [
          { name: 'scrapy.cfg', contains: [] },
          { name: 'settings.py', contains: ['crawler', 'spider'] }
        ],
        riskLevel: 'medium',
        tags: ['crawler', 'scraper', 'data', 'web']
      },
      
      // 监控类程序
      'MonitorAgent': {
        name: 'MonitorAgent',
        description: '系统监控代理',
        category: 'monitoring',
        processNames: ['monitor', 'monitoring-agent', 'statsd', 'telegraf'],
        cmdlinePatterns: ['--monitor', '--stats', '--metric', '--telegraf'],
        defaultPorts: [8125, 8094, 9100],
        directoryPatterns: [
          '~/.monitor',
          '/etc/telegraf',
          '/opt/monitor'
        ],
        tags: ['monitoring', 'metrics', 'stats', 'observability']
      },
      
      // 自动化脚本
      'AutomationScript': {
        name: 'AutomationScript',
        description: '自动化任务脚本',
        category: 'automation',
        processNames: ['automation', 'scheduler', 'cron-job', 'task-runner'],
        cmdlinePatterns: ['--automate', '--schedule', '--cron', '--task'],
        directoryPatterns: [
          '~/.automation',
          '~/scripts',
          '/opt/automation'
        ],
        tags: ['automation', 'scheduler', 'cron', 'tasks']
      }
    };
    
    // 合并到规则库
    this.rules = { ...this.rules, ...builtinRules };
    
    // 保存内置规则到文件（供用户参考）
    const builtinRulesPath = path.join(this.rulesDir, 'builtin-rules.json');
    try {
      await fs.writeJson(builtinRulesPath, builtinRules, { spaces: 2 });
    } catch (error) {
      console.warn('无法保存内置规则文件:', error.message);
    }
    
    return builtinRules;
  }

  /**
   * 加载用户规则
   */
  async loadUserRules() {
    const userRulesPath = path.join(this.rulesDir, 'user-rules.json');
    const customRulesPath = path.join(this.rulesDir, 'custom-rules.json');
    
    try {
      // 加载用户规则
      if (await fs.pathExists(userRulesPath)) {
        const userRules = await fs.readJson(userRulesPath);
        this.rules = { ...this.rules, ...userRules };
        console.log(`📖 加载用户规则: ${Object.keys(userRules).length}个`);
      }
      
      // 加载自定义规则
      if (await fs.pathExists(customRulesPath)) {
        const customRules = await fs.readJson(customRulesPath);
        this.rules = { ...this.rules, ...customRules };
        console.log(`🎨 加载自定义规则: ${Object.keys(customRules).length}个`);
      }
      
    } catch (error) {
      console.warn('⚠️ 加载用户规则失败:', error.message);
    }
  }

  /**
   * 加载插件
   */
  async loadPlugins() {
    const pluginsDir = path.join(this.pluginDir, 'installed');
    
    try {
      if (!(await fs.pathExists(pluginsDir))) {
        await fs.ensureDir(pluginsDir);
        return;
      }
      
      const pluginFiles = await fs.readdir(pluginsDir);
      
      for (const file of pluginFiles) {
        if (file.endsWith('.js') || file.endsWith('.json')) {
          try {
            const pluginPath = path.join(pluginsDir, file);
            const plugin = await this.loadPluginFile(pluginPath);
            
            if (plugin && plugin.name) {
              this.plugins[plugin.name] = plugin;
              console.log(`🔧 加载插件: ${plugin.name}`);
            }
          } catch (error) {
            console.warn(`⚠️ 加载插件 ${file} 失败:`, error.message);
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ 加载插件目录失败:', error.message);
    }
  }

  /**
   * 加载单个插件文件
   */
  async loadPluginFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      // JSON配置文件
      const config = await fs.readJson(filePath);
      return {
        type: 'config',
        name: config.name || path.basename(filePath, '.json'),
        version: config.version || '1.0.0',
        description: config.description || '用户自定义插件',
        config: config
      };
    } else if (ext === '.js') {
      // JavaScript插件
      try {
        // 动态加载插件模块
        const pluginModule = require(filePath);
        return {
          type: 'module',
          name: pluginModule.name || path.basename(filePath, '.js'),
          version: pluginModule.version || '1.0.0',
          description: pluginModule.description || 'JavaScript插件',
          module: pluginModule,
          exports: Object.keys(pluginModule)
        };
      } catch (error) {
        console.error(`加载JS插件失败 ${filePath}:`, error.message);
        return null;
      }
    }
    
    return null;
  }

  /**
   * 添加新规则
   */
  async addRule(ruleName, ruleData) {
    await this.initialize();
    
    // 验证规则数据
    if (!ruleName || typeof ruleName !== 'string') {
      throw new Error('规则名称必须是字符串');
    }
    
    if (!ruleData || typeof ruleData !== 'object') {
      throw new Error('规则数据必须是对象');
    }
    
    // 合并规则
    this.rules[ruleName] = {
      name: ruleName,
      description: ruleData.description || '用户自定义规则',
      category: ruleData.category || 'custom',
      processNames: ruleData.processNames || [],
      cmdlinePatterns: ruleData.cmdlinePatterns || [],
      defaultPorts: ruleData.defaultPorts || [],
      directoryPatterns: ruleData.directoryPatterns || [],
      fileFingerprints: ruleData.fileFingerprints || [],
      ...ruleData
    };
    
    // 保存到用户规则文件
    await this.saveUserRules();
    
    console.log(`✅ 添加新规则: ${ruleName}`);
    return this.rules[ruleName];
  }

  /**
   * 更新规则
   */
  async updateRule(ruleName, updates) {
    await this.initialize();
    
    if (!this.rules[ruleName]) {
      throw new Error(`规则 ${ruleName} 不存在`);
    }
    
    // 更新规则
    this.rules[ruleName] = {
      ...this.rules[ruleName],
      ...updates,
      name: ruleName, // 确保名称不变
      updated: new Date().toISOString()
    };
    
    // 保存到用户规则文件
    await this.saveUserRules();
    
    console.log(`✅ 更新规则: ${ruleName}`);
    return this.rules[ruleName];
  }

  /**
   * 删除规则
   */
  async deleteRule(ruleName) {
    await this.initialize();
    
    if (!this.rules[ruleName]) {
      throw new Error(`规则 ${ruleName} 不存在`);
    }
    
    // 标记为删除（实际不删除，只是从用户规则中移除）
    const userRulesPath = path.join(this.rulesDir, 'user-rules.json');
    let userRules = {};
    
    try {
      if (await fs.pathExists(userRulesPath)) {
        userRules = await fs.readJson(userRulesPath);
      }
    } catch (error) {
      // 忽略错误
    }
    
    // 从用户规则中删除
    delete userRules[ruleName];
    
    // 保存用户规则
    await fs.writeJson(userRulesPath, userRules, { spaces: 2 });
    
    // 从内存中移除（如果是用户规则）
    if (this.rules[ruleName]?.source === 'user') {
      delete this.rules[ruleName];
    }
    
    console.log(`🗑️ 删除规则: ${ruleName}`);
    return true;
  }

  /**
   * 保存用户规则
   */
  async saveUserRules() {
    const userRulesPath = path.join(this.rulesDir, 'user-rules.json');
    
    try {
      // 提取用户规则（排除内置规则）
      const userRules = {};
      for (const [name, rule] of Object.entries(this.rules)) {
        if (rule.source === 'user' || !rule.source) {
          userRules[name] = rule;
        }
      }
      
      await fs.writeJson(userRulesPath, userRules, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('❌ 保存用户规则失败:', error.message);
      return false;
    }
  }

  /**
   * 获取所有规则
   */
  getRules() {
    return this.rules;
  }

  /**
   * 获取特定规则
   */
  getRule(ruleName) {
    return this.rules[ruleName] || null;
  }

  /**
   * 搜索规则
   */
  searchRules(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [name, rule] of Object.entries(this.rules)) {
      if (
        name.toLowerCase().includes(queryLower) ||
        (rule.description && rule.description.toLowerCase().includes(queryLower)) ||
        (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(queryLower)))
      ) {
        results.push({
          name,
          description: rule.description,
          category: rule.category,
          matchScore: this.calculateMatchScore(name, rule, queryLower)
        });
      }
    }
    
    // 按匹配度排序
    results.sort((a, b) => b.matchScore - a.matchScore);
    
    return results;
  }

  /**
   * 计算匹配度分数
   */
  calculateMatchScore(name, rule, query) {
    let score = 0;
    
    // 名称完全匹配
    if (name.toLowerCase() === query) {
      score += 100;
    }
    // 名称包含查询
    else if (name.toLowerCase().includes(query)) {
      score += 80;
    }
    
    // 描述匹配
    if (rule.description && rule.description.toLowerCase().includes(query)) {
      score += 40;
    }
    
    // 标签匹配
    if (rule.tags) {
      const tagMatches = rule.tags.filter(tag => 
        tag.toLowerCase().includes(query)
      ).length;
      score += tagMatches * 20;
    }
    
    return score;
  }

  /**
   * 导出规则
   */
  async exportRules(exportPath) {
    await this.initialize();
    
    try {
      const exportData = {
        meta: {
          exportTime: new Date().toISOString(),
          ruleCount: Object.keys(this.rules).length,
          pluginCount: Object.keys(this.plugins).length,
          version: '1.0.0'
        },
        rules: this.rules,
        plugins: this.plugins
      };
      
      await fs.writeJson(exportPath, exportData, { spaces: 2 });
      console.log(`✅ 规则已导出到: ${exportPath}`);
      return true;
    } catch (error) {
      console.error('❌ 导出规则失败:', error.message);
      return false;
    }
  }

  /**
   * 导入规则
   */
  async importRules(importPath) {
    try {
      const importData = await fs.readJson(importPath);
      
      if (!importData.rules || typeof importData.rules !== 'object') {
        throw new Error('导入文件格式错误：缺少rules字段');
      }
      
      // 合并规则
      let importedCount = 0;
      for (const [name, rule] of Object.entries(importData.rules)) {
        if (!this.rules[name]) {
          this.rules[name] = {
            ...rule,
            source: 'imported',
            importedAt: new Date().toISOString()
          };
          importedCount++;
        }
      }
      
      // 保存用户规则
      await this.saveUserRules();
      
      console.log(`✅ 导入完成: ${importedCount}个新规则`);
      return importedCount;
      
    } catch (error) {
      console.error('❌ 导入规则失败:', error.message);
      throw error;
    }
  }

  /**
   * 创建规则模板
   */
  createRuleTemplate() {
    return {
      name: 'NewRule',
      description: '规则描述',
      category: 'custom',
      processNames: ['进程名1', '进程名2'],
      cmdlinePatterns: ['--参数1', '--参数2'],
      defaultPorts: [3000, 5000],
      directoryPatterns: ['~/程序目录', '/opt/程序目录'],
      fileFingerprints: [
        { name: 'config.json', contains: ['关键词1', '关键词2'] }
      ],
      installationCommands: ['安装命令示例'],
      website: 'https://example.com',
      riskLevel: 'low', // low, medium, high
      tags: ['标签1', '标签2'],
      notes: '额外说明'
    };
  }

  /**
   * 验证规则
   */
  validateRule(rule) {
    const errors = [];
    
    if (!rule.name || typeof rule.name !== 'string') {
      errors.push('规则名称无效');
    }
    
    if (!rule.description || typeof rule.description !== 'string') {
      errors.push('规则描述无效');
    }
    
    if (!Array.isArray(rule.processNames)) {
      errors.push('processNames必须是数组');
    }
    
    if (!Array.isArray(rule.cmdlinePatterns)) {
      errors.push('cmdlinePatterns必须是数组');
    }
    
    if (!Array.isArray(rule.defaultPorts)) {
      errors.push('defaultPorts必须是数组');
    }
    
    if (!Array.isArray(rule.directoryPatterns)) {
      errors.push('directoryPatterns必须是数组');
    }
    
    if (rule.fileFingerprints && !Array.isArray(rule.fileFingerprints)) {
      errors.push('fileFingerprints必须是数组');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      pluginDir: this.pluginDir,
      rulesDir: this.rulesDir,
      ruleCount: Object.keys(this.rules).length,
      pluginCount: Object.keys(this.plugins).length,
      initialized: this.initialized,
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  /**
   * 清理插件缓存
   */
  clearCache() {
    // 清理require.cache中的插件模块
    for (const plugin of Object.values(this.plugins)) {
      if (plugin.type === 'module' && plugin.modulePath) {
        delete require.cache[require.resolve(plugin.modulePath)];
      }
    }
    
    this.plugins = {};
    this.initialized = false;
    
    console.log('🧹 插件缓存已清理');
  }
}

module.exports = PluginManager;
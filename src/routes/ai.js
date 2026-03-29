/**
 * AI 相关路由
 */

const express = require('express');
const router = express.Router();
const { 
  getAIStatus, 
  getAvailableProviders,
  getAllProviders,
  addCustomProvider,
  removeCustomProvider,
  chat, 
  answerQuestion,
  parseAIConfig 
} = require('../services/ai');
const { ProjectDB, ConversationDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 获取 AI 状态
 * GET /api/ai/status
 */
router.get('/status', (req, res) => {
  const status = getAIStatus();
  const available = getAvailableProviders();
  
  res.json({
    success: true,
    data: {
      providers: status,
      available: available,
      defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'openai'
    }
  });
});

/**
 * AI 对话
 * POST /api/ai/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, provider, model } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    
    const response = await chat(messages, provider, model);
    
    res.json({
      success: true,
      data: { response }
    });
    
  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 项目部署问答
 * POST /api/ai/ask/:projectId
 */
router.post('/ask/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { question, provider } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const project = await ProjectDB.getById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // 获取历史对话
    const history = await (ConversationDB.getRecentByProjectId || ConversationDB.getByProjectId)(projectId, 20);
    const formattedHistory = history.map(h => ({
      role: h.role,
      content: h.content
    }));
    
    // 调用 AI
    const answer = await answerQuestion(project, question, formattedHistory, provider);
    
    // 保存对话
    await ConversationDB.create({
      project_id: projectId,
      role: 'user',
      content: question
    });
    
    await ConversationDB.create({
      project_id: projectId,
      role: 'assistant',
      content: answer
    });
    
    res.json({
      success: true,
      data: { answer }
    });
    
  } catch (error) {
    logger.error('AI ask error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取项目对话历史
 * GET /api/ai/conversations/:projectId
 */
router.get('/conversations/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const conversations = await ConversationDB.getByProjectId(projectId);
    
    res.json({
      success: true,
      data: conversations
    });
    
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 清除项目对话历史
 * DELETE /api/ai/conversations/:projectId
 */
router.delete('/conversations/:projectId', async (req, res) => {
  try {
    if (ConversationDB.clearByProjectId) {
      await ConversationDB.clearByProjectId(req.params.projectId);
    }
    res.json({ success: true, message: '对话历史已清除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 智能解析 AI 配置
 * POST /api/ai/parse-config
 */
router.post('/parse-config', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const configs = parseAIConfig(text);
    
    res.json({
      success: true,
      data: { configs }
    });
    
  } catch (error) {
    logger.error('Parse config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取所有提供商（含自定义）
 * GET /api/ai/providers
 */

/**
 * 获取当前默认提供商
 * GET /api/ai/providers/default
 */
router.get('/providers/default', async (req, res) => {
  try {
    const { ConfigDB } = require('../services/database');
    const saved = await ConfigDB.get('default_ai_provider').catch(() => null);
    const def = saved || process.env.DEFAULT_AI_PROVIDER || 'openai';
    res.json({ success: true, data: { default: def } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * 设置默认提供商
 * POST /api/ai/providers/default
 * body: { key }
 */
router.post('/providers/default', async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: '缺少 key' });
    const { ConfigDB } = require('../services/database');
    process.env.DEFAULT_AI_PROVIDER = key;
    await ConfigDB.set('default_ai_provider', key);
    logger.info(`Default AI provider set to: ${key}`);
    res.json({ success: true, message: `已将 "${key}" 设为默认` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/providers', (req, res) => {
  const all = getAllProviders();
  const result = Object.entries(all).map(([key, config]) => ({
    key,
    name: config.name,
    baseURL: config.baseURL,
    configured: !!config.apiKey,
    models: config.models,
    defaultModel: config.defaultModel,
    builtin: config.builtin !== false
  }));
  res.json({ success: true, data: result });
});

/**
 * 添加或更新自定义提供商
 * POST /api/ai/providers
 * body: { key, name, baseURL, apiKey, models, defaultModel }
 */
router.post('/providers', async (req, res) => {
  try {
    const { key, name, baseURL, apiKey, models, defaultModel } = req.body;
    if (!key) return res.status(400).json({ error: '缺少 key 字段' });
    const provider = await addCustomProvider(key, { name, baseURL, apiKey, models, defaultModel });
    res.json({ success: true, data: provider, message: `提供商 "${key}" 已保存` });
  } catch (error) {
    logger.error('Add provider error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * 一键粘贴配置接口
 * POST /api/ai/quick-config
 * body: { text } — 用户粘贴的任意文本（包含 key/baseURL 等）
 *
 * 逻辑：
 * 1. 解析文本，提取所有可识别的 AI 配置
 * 2. 对每条配置：
 *    - 如果是内置提供商（openai/deepseek 等）→ 更新 process.env + 数据库
 *    - 如果有自定义 baseURL → 注册为自定义提供商
 * 3. 重复粘贴新 key → 覆盖旧值，不会冲突
 * 4. 返回识别结果，让前端展示确认信息
 */
router.post('/quick-config', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: '请粘贴包含 API Key 的文本' });

    const { parseAIConfig, addCustomProvider, getDefaultBaseURL, getDefaultModel } = require('../services/ai');
    const { ConfigDB } = require('../services/database');

    const parsed = parseAIConfig(text);
    if (parsed.length === 0) {
      return res.status(400).json({ error: '未能识别出有效的 API Key，请检查格式' });
    }

    const results = [];
    for (const cfg of parsed) {
      try {
        const key = cfg.provider;
        const apiKey = cfg.apiKey;
        const baseURL = cfg.baseURL || getDefaultBaseURL(cfg.provider);
        const model = cfg.model || getDefaultModel(cfg.provider);

        // 更新内存中的环境变量（当次运行生效）
        const envKeyMap = {
          openai: 'OPENAI_API_KEY', deepseek: 'DEEPSEEK_API_KEY',
          gemini: 'GEMINI_API_KEY', claude: 'CLAUDE_API_KEY',
          moonshot: 'MOONSHOT_API_KEY', qwen: 'QWEN_API_KEY', zhipu: 'ZHIPU_API_KEY'
        };
        if (envKeyMap[key]) {
          process.env[envKeyMap[key]] = apiKey;
          if (baseURL) process.env[key.toUpperCase() + '_BASE_URL'] = baseURL;
          if (model) process.env[key.toUpperCase() + '_MODEL'] = model;
        }

        // 持久化到数据库（服务重启后仍有效）
        const providerCfg = {
          name: cfg.name,
          baseURL,
          apiKey,
          models: [model],
          defaultModel: model,
          builtin: false
        };
        // 直接用 provider key 存储，覆盖同名旧配置
        await addCustomProvider(key, providerCfg);

        // 同时更新 DEFAULT_AI_PROVIDER
        process.env.DEFAULT_AI_PROVIDER = key;
        await ConfigDB.set('default_ai_provider', key);

        results.push({ provider: cfg.provider, name: cfg.name, model, baseURL, success: true });
        logger.info(`Quick config applied: ${cfg.provider} (${cfg.name})`);
      } catch (err) {
        results.push({ provider: cfg.provider, name: cfg.name, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: successCount > 0,
      data: { results, total: parsed.length, applied: successCount },
      message: successCount > 0
        ? `✅ 已识别并应用 ${successCount} 个 AI 配置`
        : '⚠️ 识别失败，请检查格式'
    });
  } catch (error) {
    logger.error('Quick config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除自定义提供商
 * DELETE /api/ai/providers/:key
 */
router.delete('/providers/:key', async (req, res) => {
  try {
    await removeCustomProvider(req.params.key);
    res.json({ success: true, message: `提供商 "${req.params.key}" 已删除` });
  } catch (error) {
    logger.error('Remove provider error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * 测试提供商连通性
 * POST /api/ai/providers/test
 * body: { key } 或 { baseURL, apiKey, defaultModel }
 */
router.post('/providers/test', async (req, res) => {
  try {
    const { key, baseURL, apiKey, defaultModel } = req.body;
    let providerKey = key;

    // 如果传了临时配置，先临时注册
    if (!key && baseURL && apiKey && defaultModel) {
      providerKey = '__test__';
      await addCustomProvider(providerKey, {
        name: 'Test',
        baseURL,
        apiKey,
        defaultModel,
        models: [defaultModel]
      });
    }

    const response = await chat(
      [{ role: 'user', content: '你好，请回复「连接正常」四个字。' }],
      providerKey
    );

    // 清理临时提供商
    if (providerKey === '__test__') {
      await removeCustomProvider('__test__').catch(() => {});
    }

    res.json({ success: true, data: { response }, message: '连接测试成功' });
  } catch (error) {
    logger.error('Test provider error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

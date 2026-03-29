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
    const history = await ConversationDB.getByProjectId(projectId);
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

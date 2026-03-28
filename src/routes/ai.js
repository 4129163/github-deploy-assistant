/**
 * AI 相关路由
 */

const express = require('express');
const router = express.Router();
const { 
  getAIStatus, 
  getAvailableProviders, 
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

module.exports = router;

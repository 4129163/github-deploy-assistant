/**
 * AI 服务 - 支持多模型
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

// 模型配置
const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4o'
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY,
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: process.env.GEMINI_MODEL || 'gemini-pro'
  },
  claude: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: process.env.CLAUDE_API_KEY,
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229'
  }
};

const DEFAULT_PROVIDER = process.env.DEFAULT_AI_PROVIDER || 'openai';

/**
 * 检查 AI 配置状态
 */
function getAIStatus() {
  const status = {};
  for (const [key, config] of Object.entries(AI_PROVIDERS)) {
    status[key] = {
      name: config.name,
      configured: !!config.apiKey,
      models: config.models,
      defaultModel: config.defaultModel
    };
  }
  return status;
}

/**
 * 获取可用的 AI 提供商
 */
function getAvailableProviders() {
  return Object.entries(AI_PROVIDERS)
    .filter(([_, config]) => config.apiKey)
    .map(([key, config]) => ({
      key,
      name: config.name,
      models: config.models,
      defaultModel: config.defaultModel
    }));
}

/**
 * 调用 AI 接口
 */
async function chat(messages, provider = DEFAULT_PROVIDER, model = null) {
  const config = AI_PROVIDERS[provider];
  
  if (!config) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  
  if (!config.apiKey) {
    throw new Error(`${config.name} API key not configured`);
  }
  
  const selectedModel = model || config.defaultModel;
  
  try {
    logger.info(`Calling ${config.name} with model: ${selectedModel}`);
    
    if (provider === 'gemini') {
      return await callGemini(messages, config, selectedModel);
    } else if (provider === 'claude') {
      return await callClaude(messages, config, selectedModel);
    } else {
      return await callOpenAICompatible(messages, config, selectedModel);
    }
  } catch (error) {
    logger.error(`AI call failed:`, error.message);
    throw error;
  }
}

/**
 * OpenAI 兼容接口调用（OpenAI, DeepSeek）
 */
async function callOpenAICompatible(messages, config, model) {
  const response = await axios.post(
    `${config.baseURL}/chat/completions`,
    {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096
    },
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );
  
  return response.data.choices[0].message.content;
}

/**
 * Google Gemini 调用
 */
async function callGemini(messages, config, model) {
  // 转换消息格式
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  
  const response = await axios.post(
    `${config.baseURL}/models/${model}:generateContent?key=${config.apiKey}`,
    {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    }
  );
  
  return response.data.candidates[0].content.parts[0].text;
}

/**
 * Anthropic Claude 调用
 */
async function callClaude(messages, config, model) {
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  const response = await axios.post(
    `${config.baseURL}/messages`,
    {
      model: model,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemMessage?.content,
      messages: otherMessages.map(m => ({
        role: m.role,
        content: m.content
      }))
    },
    {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );
  
  return response.data.content[0].text;
}

/**
 * 分析 GitHub 仓库
 */
async function analyzeRepo(repoData, provider = DEFAULT_PROVIDER) {
  const messages = [
    {
      role: 'system',
      content: `你是一个专业的项目部署助手。请分析给定的 GitHub 仓库信息，并提供详细的部署指南。

请按以下格式输出：

## 项目概述
[简要描述项目用途和技术栈]

## 系统要求
- Node.js 版本: [如需要]
- Python 版本: [如需要]
- 其他依赖: [如需要]

## 安装步骤
1. [步骤1]
2. [步骤2]
...

## 环境变量配置
[列出需要配置的环境变量]

## 启动命令
[如何启动项目]

## 常见问题
[可能的安装问题和解决方案]

请以中文输出，尽量详细且易于理解。`
    },
    {
      role: 'user',
      content: `请分析以下 GitHub 仓库信息并提供部署指南：\n\n${JSON.stringify(repoData, null, 2)}`
    }
  ];
  
  return await chat(messages, provider);
}

/**
 * 生成部署脚本
 */
async function generateDeployScript(repoData, mode, provider = DEFAULT_PROVIDER) {
  const messages = [
    {
      role: 'system',
      content: mode === 'auto' 
        ? '你是一个自动化部署专家。请根据仓库信息生成可直接执行的 shell 脚本。脚本应该包含完整的安装和部署流程，包含错误处理和状态检查。只输出脚本内容，不要有其他说明。'
        : '你是一个技术文档专家。请根据仓库信息生成详细的逐步部署教程，适合初学者阅读。每个步骤都要有清晰的说明。'
    },
    {
      role: 'user',
      content: `请为以下仓库生成${mode === 'auto' ? '自动化部署脚本' : '详细部署教程'}：\n\n${JSON.stringify(repoData, null, 2)}`
    }
  ];
  
  return await chat(messages, provider);
}

/**
 * 回答部署问题
 */
async function answerQuestion(project, question, history = [], provider = DEFAULT_PROVIDER) {
  const messages = [
    {
      role: 'system',
      content: `你是一个友好的技术支持助手。用户正在部署一个 GitHub 项目，需要你帮助解决遇到的问题。

项目信息：
- 名称: ${project.name}
- 仓库: ${project.repo_url}
- 类型: ${project.project_type || '未知'}

请提供清晰、具体的解决方案。如果不确定，请坦诚告知并给出可能的排查方向。`
    }
  ];
  
  // 添加历史对话
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  
  messages.push({ role: 'user', content: question });
  
  return await chat(messages, provider);
}

/**
 * 解析 AI 配置文本（智能识别）
 */
function parseAIConfig(text) {
  const configs = [];
  
  // 匹配 OpenAI API Key
  const openaiMatch = text.match(/sk-[a-zA-Z0-9]{20,}/);
  if (openaiMatch) {
    configs.push({ provider: 'openai', key: openaiMatch[0] });
  }
  
  // 匹配 DeepSeek API Key
  const deepseekMatch = text.match(/sk-[a-f0-9]{32}/);
  if (deepseekMatch && !openaiMatch) {
    configs.push({ provider: 'deepseek', key: deepseekMatch[0] });
  }
  
  // 匹配 Gemini API Key
  const geminiMatch = text.match(/AIzaSy[a-zA-Z0-9_-]{33}/);
  if (geminiMatch) {
    configs.push({ provider: 'gemini', key: geminiMatch[0] });
  }
  
  // 匹配 Claude API Key
  const claudeMatch = text.match(/sk-ant-[a-zA-Z0-9-_]{40,}/);
  if (claudeMatch) {
    configs.push({ provider: 'claude', key: claudeMatch[0] });
  }
  
  // 匹配 base URL
  const baseUrlMatch = text.match(/https:\/\/[^\s]+/);
  if (baseUrlMatch) {
    configs.forEach(c => c.baseUrl = baseUrlMatch[0]);
  }
  
  return configs;
}

module.exports = {
  getAIStatus,
  getAvailableProviders,
  chat,
  analyzeRepo,
  generateDeployScript,
  answerQuestion,
  parseAIConfig
};

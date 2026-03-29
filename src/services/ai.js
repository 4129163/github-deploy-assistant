/**
 * AI 服务 - 支持多模型（含自定义提供商）
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

// 内置提供商（从环境变量读取）
const BUILTIN_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
    builtin: true
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    builtin: true
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY,
    models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    builtin: true
  },
  claude: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: process.env.CLAUDE_API_KEY,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    defaultModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    builtin: true
  },
  moonshot: {
    name: '月之暗面 Moonshot',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKey: process.env.MOONSHOT_API_KEY,
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
    builtin: true
  },
  qwen: {
    name: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY,
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    defaultModel: process.env.QWEN_MODEL || 'qwen-turbo',
    builtin: true
  },
  zhipu: {
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: process.env.ZHIPU_API_KEY,
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    defaultModel: process.env.ZHIPU_MODEL || 'glm-4-flash',
    builtin: true
  }
};

// 内存缓存自定义提供商（启动时从数据库加载）
let customProviders = {};

/**
 * 获取合并后的所有提供商
 */
function getAllProviders() {
  return { ...BUILTIN_PROVIDERS, ...customProviders };
}

/**
 * 从数据库加载自定义提供商
 */
async function loadCustomProviders() {
  try {
    const { ConfigDB } = require('./database');
    const raw = await ConfigDB.get('custom_ai_providers');
    if (raw) {
      customProviders = JSON.parse(raw);
      logger.info(`Loaded ${Object.keys(customProviders).length} custom AI provider(s)`);
    }
  } catch (err) {
    logger.warn('Failed to load custom AI providers:', err.message);
  }
}

/**
 * 保存自定义提供商到数据库
 */
async function saveCustomProviders() {
  const { ConfigDB } = require('./database');
  await ConfigDB.set('custom_ai_providers', JSON.stringify(customProviders));
}

/**
 * 添加或更新自定义提供商
 * @param {string} key - 唯一标识（英文，如 my-llm）
 * @param {object} config - { name, baseURL, apiKey, models, defaultModel }
 */
async function addCustomProvider(key, config) {
  if (BUILTIN_PROVIDERS[key]) {
    throw new Error(`"${key}" 是内置提供商，不能覆盖。请换一个 key。`);
  }
  if (!config.baseURL || !config.apiKey || !config.defaultModel) {
    throw new Error('缺少必填字段：baseURL、apiKey、defaultModel');
  }
  customProviders[key] = {
    name: config.name || key,
    baseURL: config.baseURL.replace(/\/$/, ''), // 去掉末尾斜杠
    apiKey: config.apiKey,
    models: config.models || [config.defaultModel],
    defaultModel: config.defaultModel,
    builtin: false
  };
  await saveCustomProviders();
  logger.info(`Custom AI provider added/updated: ${key}`);
  return customProviders[key];
}

/**
 * 删除自定义提供商
 */
async function removeCustomProvider(key) {
  if (BUILTIN_PROVIDERS[key]) {
    throw new Error(`"${key}" 是内置提供商，不能删除。`);
  }
  if (!customProviders[key]) {
    throw new Error(`提供商 "${key}" 不存在`);
  }
  delete customProviders[key];
  await saveCustomProviders();
  logger.info(`Custom AI provider removed: ${key}`);
}

/**
 * 检查 AI 配置状态（内置 + 自定义）
 */
function getAIStatus() {
  const all = getAllProviders();
  const status = {};
  for (const [key, config] of Object.entries(all)) {
    status[key] = {
      name: config.name,
      configured: !!config.apiKey,
      models: config.models,
      defaultModel: config.defaultModel,
      builtin: config.builtin !== false
    };
  }
  return status;
}

/**
 * 获取可用的 AI 提供商（已配置 API Key）
 */
function getAvailableProviders() {
  const all = getAllProviders();
  return Object.entries(all)
    .filter(([_, config]) => config.apiKey)
    .map(([key, config]) => ({
      key,
      name: config.name,
      models: config.models,
      defaultModel: config.defaultModel,
      builtin: config.builtin !== false
    }));
}

/**
 * 调用 AI 接口（所有 OpenAI 兼容接口通用）
 */
async function chat(messages, provider = null, model = null) {
  const all = getAllProviders();
  // 自动选择第一个可用提供商
  const providerKey = provider || Object.keys(all).find(k => all[k].apiKey) || 'openai';
  const config = all[providerKey];

  if (!config) {
    throw new Error(`未知提供商: ${providerKey}`);
  }
  if (!config.apiKey) {
    throw new Error(`${config.name} 未配置 API Key`);
  }

  const selectedModel = model || config.defaultModel;
  logger.info(`Calling ${config.name} (${providerKey}) with model: ${selectedModel}`);

  try {
    // Gemini 原生接口单独处理
    if (providerKey === 'gemini' && config.baseURL.includes('generativelanguage')) {
      const geminiMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const systemMsg = messages.find(m => m.role === 'system');
      const resp = await axios.post(
        `${config.baseURL}/models/${selectedModel}:generateContent?key=${config.apiKey}`,
        {
          contents: geminiMessages,
          ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {})
        },
        { timeout: 60000 }
      );
      return resp.data.candidates[0].content.parts[0].text;
    }

    // Claude 原生接口单独处理
    if (providerKey === 'claude' && config.baseURL.includes('anthropic.com')) {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      const resp = await axios.post(
        `${config.baseURL}/messages`,
        {
          model: selectedModel,
          max_tokens: 4096,
          messages: userMessages,
          ...(systemMsg ? { system: systemMsg.content } : {})
        },
        {
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 60000
        }
      );
      return resp.data.content[0].text;
    }

    // 通用 OpenAI 兼容接口（包含自定义提供商）
    const resp = await axios.post(
      `${config.baseURL}/chat/completions`,
      { model: selectedModel, messages, temperature: 0.7 },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    return resp.data.choices[0].message.content;

  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    logger.error(`AI call failed (${providerKey}): ${detail}`);
    throw new Error(`AI 调用失败 [${config.name}]: ${detail}`);
  }
}

/**
 * 分析仓库，生成部署建议
 */
async function analyzeRepo(repoData, provider = null) {
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的 DevOps 工程师，擅长分析 GitHub 项目并给出部署建议。请用中文回答，内容清晰简洁。'
    },
    {
      role: 'user',
      content: `请分析以下 GitHub 仓库信息，给出部署建议：\n\n${JSON.stringify(repoData, null, 2)}\n\n请包括：\n1. 项目类型和技术栈\n2. 前置依赖要求\n3. 推荐部署方式\n4. 可能遇到的问题和解决方案`
    }
  ];
  return await chat(messages, provider);
}

/**
 * 生成部署脚本
 */
async function generateDeployScript(repoData, mode, provider = null) {
  const messages = [
    {
      role: 'system',
      content: '你是一个专业的 DevOps 工程师。请根据项目信息生成部署脚本，只返回可执行的 shell 脚本，不要有多余解释。'
    },
    {
      role: 'user',
      content: `请为以下项目生成${mode === 'auto' ? '自动' : '手动'}部署脚本：\n\n${JSON.stringify(repoData, null, 2)}`
    }
  ];
  return await chat(messages, provider);
}

/**
 * 回答部署问题
 */
async function answerQuestion(project, question, history = [], provider = null) {
  const messages = [
    {
      role: 'system',
      content: `你是一个友好的技术支持助手。用户正在部署一个 GitHub 项目，需要你帮助解决遇到的问题。\n\n项目信息：\n- 名称: ${project.name}\n- 仓库: ${project.repo_url}\n- 类型: ${project.project_type || '未知'}\n\n请提供清晰、具体的解决方案。如果不确定，请坦诚告知并给出可能的排查方向。`
    }
  ];
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: question });
  return await chat(messages, provider);
}

/**
 * 智能识别粘贴文本中的 AI 配置信息
 */
function parseAIConfig(text) {
  const configs = [];

  // OpenAI
  const openaiMatch = text.match(/sk-[a-zA-Z0-9]{20,}/);
  if (openaiMatch) configs.push({ provider: 'openai', key: openaiMatch[0] });

  // DeepSeek（sk- 开头但全小写hex）
  const deepseekMatch = text.match(/sk-[a-f0-9]{32}/);
  if (deepseekMatch && !openaiMatch) configs.push({ provider: 'deepseek', key: deepseekMatch[0] });

  // Gemini
  const geminiMatch = text.match(/AIzaSy[a-zA-Z0-9_-]{33}/);
  if (geminiMatch) configs.push({ provider: 'gemini', key: geminiMatch[0] });

  // Claude
  const claudeMatch = text.match(/sk-ant-[a-zA-Z0-9-_]{40,}/);
  if (claudeMatch) configs.push({ provider: 'claude', key: claudeMatch[0] });

  // Moonshot
  const moonshotMatch = text.match(/sk-[a-zA-Z0-9]{40,}/);
  if (moonshotMatch && text.toLowerCase().includes('moonshot')) {
    configs.push({ provider: 'moonshot', key: moonshotMatch[0] });
  }

  // 提取 base URL
  const baseUrlMatch = text.match(/https:\/\/[^\s"']+v\d+[^\s"']*/);
  if (baseUrlMatch) configs.forEach(c => c.baseUrl = baseUrlMatch[0]);

  return configs;
}

module.exports = {
  getAIStatus,
  getAvailableProviders,
  getAllProviders,
  loadCustomProviders,
  addCustomProvider,
  removeCustomProvider,
  chat,
  analyzeRepo,
  generateDeployScript,
  answerQuestion,
  parseAIConfig
};

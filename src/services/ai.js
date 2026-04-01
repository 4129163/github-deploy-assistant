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
      content: '你是一个专业的 DevOps 工程师，擅长分析 GitHub 项目并给出部署建议。请用中文回答，内容清晰简洁。输出必须包含项目所需的硬件配置（CPU核数、内存GB、磁盘空间GB）。'
    },
    {
      role: 'user', 
      content: `请分析以下 GitHub 仓库信息，并给出详细的部署和硬件建议：\n\n${JSON.stringify(repoData, null, 2)}\n\n请严格按以下 JSON 格式返回：\n{\n  "analysis": "...",\n  "requirements": { "cpu": 1, "memory_gb": 2, "disk_gb": 1 },\n  "stack": ["..."],\n  "recommendation": "..."\n}`
    }
  ];
  return await chat(messages, provider, { jsonMode: true });
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
  // 限制最近 10 轮对话（20条），防止 token 超限
  const recentHistory = history.slice(-20);
  for (const h of recentHistory) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: question });
  return await chat(messages, provider);
}

/**
 * 智能解析粘贴文本中的 AI 配置
 * 支持格式：
 * - 纯 API Key（自动识别提供商）
 * - "baseURL: xxx\napiKey: xxx\nmodel: xxx" 格式
 * - JSON 格式
 * - 中转站常见说明文本（含 baseURL + key）
 * - 重复粘贴新 key 会覆盖旧的，不冲突
 */
function parseAIConfig(text) {
  if (!text || typeof text !== 'string') return [];
  const configs = [];
  const t = text.trim();

  // ── 1. 尝试 JSON 格式 ──
  try {
    const json = JSON.parse(t);
    const baseURL = json.baseURL || json.base_url || json.baseUrl || json.api_base || '';
    const apiKey  = json.apiKey  || json.api_key  || json.key || '';
    const model   = json.model   || json.defaultModel || json.default_model || '';
    const name    = json.name    || json.provider || 'custom';
    if (apiKey) {
      configs.push({ provider: detectProviderByKey(apiKey, baseURL), apiKey, baseURL, model, name, source: 'json' });
      return configs;
    }
  } catch (_) {}

  // ── 2. 提取所有可能的 URL 和 Key ──
  const urlMatches = [...t.matchAll(/https?:\/\/[^\s"'<>，,\n]+/g)].map(m => m[0].replace(/[/]+$/, ''));
  const keyMatches = [
    // Claude
    ...([...t.matchAll(/sk-ant-[a-zA-Z0-9_-]{40,}/g)].map(m => ({ key: m[0], provider: 'claude' }))),
    // Gemini
    ...([...t.matchAll(/AIzaSy[a-zA-Z0-9_-]{33}/g)].map(m => ({ key: m[0], provider: 'gemini' }))),
    // 通用 sk- 前缀（OpenAI / DeepSeek / Moonshot / Qwen 等）
    ...([...t.matchAll(/sk-[a-zA-Z0-9_-]{16,}/g)].map(m => ({ key: m[0], provider: null }))),
  ];

  // ── 3. 提取可能的 model 名 ──
  const modelPatterns = [
    /(?:model|模型)[\s:：=]+([\w./-]+)/i,
    /(gpt-[\w.-]+|deepseek-[\w-]+|claude-[\w-]+|gemini-[\w-]+|moonshot-[\w-]+|qwen-[\w-]+|glm-[\w-]+)/i,
  ];
  let detectedModel = '';
  for (const p of modelPatterns) {
    const m = t.match(p);
    if (m) { detectedModel = m[1]; break; }
  }

  // ── 4. 找 baseURL（优先找 /v1 结尾的）──
  const apiUrls = urlMatches.filter(u => /\/v\d/.test(u) || u.includes('api.') || u.includes('openai') || u.includes('deepseek') || u.includes('anthropic') || u.includes('gemini'));
  const baseURL = apiUrls[0] || '';

  // ── 5. 组合结果 ──
  for (const { key, provider: hintProvider } of keyMatches) {
    const provider = hintProvider || detectProviderByKey(key, baseURL, t);
    // 避免重复
    if (configs.some(c => c.apiKey === key)) continue;
    configs.push({
      provider,
      apiKey: key,
      baseURL: baseURL || getDefaultBaseURL(provider),
      model: detectedModel || getDefaultModel(provider),
      name: getProviderName(provider),
      source: 'text'
    });
  }

  return configs;
}

/**
 * 根据 key 格式和上下文推断提供商
 */
function detectProviderByKey(key, baseURL = '', context = '') {
  const ctx = (baseURL + ' ' + context).toLowerCase();
  if (key.startsWith('sk-ant-')) return 'claude';
  if (key.startsWith('AIzaSy')) return 'gemini';
  if (ctx.includes('deepseek')) return 'deepseek';
  if (ctx.includes('moonshot') || ctx.includes('kimi')) return 'moonshot';
  if (ctx.includes('qwen') || ctx.includes('dashscope') || ctx.includes('aliyun')) return 'qwen';
  if (ctx.includes('zhipu') || ctx.includes('glm') || ctx.includes('bigmodel')) return 'zhipu';
  if (ctx.includes('openai') || ctx.includes('gpt')) return 'openai';
  // 根据 key 长度/格式猜测
  if (/sk-[a-f0-9]{32}$/.test(key)) return 'deepseek';
  if (key.length > 80) return 'claude';
  return 'openai'; // 默认
}

function getDefaultBaseURL(provider) {
  const map = {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    claude: 'https://api.anthropic.com/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  };
  return map[provider] || '';
}

function getDefaultModel(provider) {
  const map = {
    openai: 'gpt-4o',
    deepseek: 'deepseek-chat',
    gemini: 'gemini-pro',
    claude: 'claude-3-sonnet-20240229',
    moonshot: 'moonshot-v1-8k',
    qwen: 'qwen-turbo',
    zhipu: 'glm-4-flash',
  };
  return map[provider] || '';
}

function getProviderName(provider) {
  const map = {
    openai: 'OpenAI', deepseek: 'DeepSeek', gemini: 'Google Gemini',
    claude: 'Anthropic Claude', moonshot: '月之暗面 Kimi',
    qwen: '通义千问', zhipu: '智谱 GLM',
  };
  return map[provider] || provider;
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
  parseAIConfig,
  detectProviderByKey,
  getDefaultBaseURL,
  getDefaultModel,
  getProviderName
};

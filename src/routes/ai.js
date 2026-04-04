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

/**
 * AI 故障自愈
 * POST /api/ai/heal/:projectId        — 分析错误日志，生成修复建议
 * POST /api/ai/heal/:projectId/apply  — 执行修复命令
 */
router.post('/heal/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { error_log = '' } = req.body;
    if (!error_log.trim()) return res.status(400).json({ error: '缺少 error_log' });

    const { chat } = require('../services/ai');
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的 DevOps 工程师，擅长分析项目部署错误并给出修复方案。请用简体中文回复，回复格式必须是合法 JSON。'
      },
      {
        role: 'user',
        content: `项目名称: ${project.name}\n项目类型: ${project.project_type || '未知'}\n仓库: ${project.repo_url || '未知'}\n\n错误日志:\n${error_log.slice(0, 3000)}\n\n请分析原因并给出修复方案。返回 JSON 格式：\n{\n  "analysis": "错误原因分析（1-3句话）",\n  "suggestion": "修复步骤说明（给用户看的文字，可包含命令）",\n  "auto_fixable": true/false,\n  "fix_command": "可自动执行的单条命令（若 auto_fixable=true），否则为 null"\n}`
      }
    ];

    const raw = await chat(messages);
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (_) {
      parsed = { analysis: raw, suggestion: raw, auto_fixable: false, fix_command: null };
    }

    // 安全检查：fix_command 必须在白名单内
    if (parsed.auto_fixable && parsed.fix_command) {
      const { validateCommand } = require('../services/deploy');
      if (!validateCommand(parsed.fix_command)) {
        parsed.auto_fixable = false;
        parsed.fix_command = null;
        parsed.suggestion += '\n\n（自动修复命令不在安全白名单内，请手动执行）';
      }
    }

    logger.info(`[AIHeal] Project ${project.name}: auto_fixable=${parsed.auto_fixable}`);
    res.json({ success: true, data: parsed });
  } catch (err) {
    logger.error('AI heal error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/heal/:projectId/apply', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { fix_command } = req.body;
    if (!fix_command) return res.status(400).json({ error: '缺少 fix_command' });

    const { executeCommand, validateCommand } = require('../services/deploy');
    if (!validateCommand(fix_command)) {
      return res.status(403).json({ error: '命令不在安全白名单内，禁止执行' });
    }

    if (global.broadcastLog) global.broadcastLog(String(project.id), `🔧 执行修复命令: ${fix_command}`);
    const result = await executeCommand(fix_command, project.local_path || require('../config').WORK_DIR);
    if (global.broadcastLog) {
      result.outputs?.forEach(o => global.broadcastLog(String(project.id), o.data));
    }

    res.json({
      success: result.success,
      message: result.success ? '修复命令执行成功' : `修复命令失败（exit ${result.exitCode}）`,
      data: result
    });
  } catch (err) {
    logger.error('AI heal apply error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI智能诊断闭环功能 ====================

/**
 * 部署错误诊断
 * POST /api/ai/deploy-diagnose
 */
router.post('/deploy-diagnose', async (req, res) => {
  try {
    const { project_id, error_log, command = 'unknown', provider = null } = req.body;
    
    if (!project_id) {
      return res.status(400).json({ error: '缺少 project_id' });
    }
    if (!error_log) {
      return res.status(400).json({ error: '缺少 error_log' });
    }
    
    const project = await ProjectDB.getById(project_id);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    // 调用手动触发诊断
    const { manualTriggerDiagnosis } = require('../middleware/deploy-error-catcher');
    const result = await manualTriggerDiagnosis(project_id, error_log, command);
    
    res.json({
      success: true,
      data: {
        diagnosis_id: result.diagnosisId,
        analysis: result.analysis,
        suggestion: result.suggestion,
        auto_fixable: result.auto_fixable,
        fix_commands: result.fix_commands || [],
        risk_level: result.risk_level || 'MEDIUM',
        estimated_time: result.estimated_time || '未知',
        commands_validated: result.commands_validated
      }
    });
    
  } catch (error) {
    logger.error('部署错误诊断失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取诊断详情
 * GET /api/ai/diagnosis/:diagnosisId
 */
router.get('/diagnosis/:diagnosisId', async (req, res) => {
  try {
    const { diagnosisId } = req.params;
    const { getDiagnosisDetail } = require('../middleware/deploy-error-catcher');
    
    const diagnosis = await getDiagnosisDetail(diagnosisId);
    if (!diagnosis) {
      return res.status(404).json({ error: '诊断记录不存在' });
    }
    
    res.json({
      success: true,
      data: diagnosis
    });
    
  } catch (error) {
    logger.error('获取诊断详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取项目诊断历史
 * GET /api/ai/diagnosis/project/:projectId
 */
router.get('/diagnosis/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const { getRecentDiagnoses } = require('../middleware/deploy-error-catcher');
    
    const diagnoses = await getRecentDiagnoses(projectId, limit);
    
    res.json({
      success: true,
      data: diagnoses
    });
    
  } catch (error) {
    logger.error('获取诊断历史失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 应用修复命令（需要用户确认）
 * POST /api/ai/diagnosis/:diagnosisId/apply
 */
router.post('/diagnosis/:diagnosisId/apply', async (req, res) => {
  try {
    const { diagnosisId } = req.params;
    const { confirmation_token, commands } = req.body;
    
    if (!confirmation_token) {
      return res.status(400).json({ error: '缺少确认令牌' });
    }
    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({ error: '缺少修复命令' });
    }
    
    // 获取诊断记录
    const { DeploymentDiagnosisDB } = require('../services/database');
    const diagnosis = await DeploymentDiagnosisDB.getById(diagnosisId);
    if (!diagnosis) {
      return res.status(404).json({ error: '诊断记录不存在' });
    }
    
    // 验证确认令牌
    const { verifyFixConfirmationToken } = require('../services/ai');
    if (!verifyFixConfirmationToken(confirmation_token, diagnosisId, commands)) {
      return res.status(403).json({ error: '确认令牌无效' });
    }
    
    // 验证命令安全性
    const { validateFixCommands } = require('../services/ai');
    const validation = validateFixCommands(commands);
    if (!validation.all_safe) {
      return res.status(403).json({ 
        error: '修复命令包含不安全操作', 
        details: validation.results.filter(r => !r.safe) 
      });
    }
    
    // 获取项目信息
    const project = await ProjectDB.getById(diagnosis.project_id);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    
    // 更新状态为已确认
    await DeploymentDiagnosisDB.updateStatus(diagnosisId, 'CONFIRMED', {
      applied_fix: commands
    });
    
    // 执行修复命令
    const { executeCommand } = require('../services/deploy');
    const results = [];
    let allSuccess = true;
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      logger.info(`执行修复命令 ${i+1}/${commands.length}: ${cmd}`);
      
      try {
        const result = await executeCommand(cmd, project.local_path || require('../config').WORK_DIR);
        results.push({
          command: cmd,
          success: result.success,
          exitCode: result.exitCode,
          output: result.outputs?.map(o => o.data).join('\n') || '',
          error: result.error
        });
        
        if (!result.success) {
          allSuccess = false;
          break; // 失败则停止执行后续命令
        }
        
        // 短暂延迟，避免命令冲突
        if (i < commands.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (cmdError) {
        results.push({
          command: cmd,
          success: false,
          exitCode: -1,
          output: '',
          error: cmdError.message
        });
        allSuccess = false;
        break;
      }
    }
    
    // 更新最终状态
    const finalStatus = allSuccess ? 'SUCCESS' : 'FAILED';
    await DeploymentDiagnosisDB.updateStatus(diagnosisId, finalStatus, {
      fix_result: results
    });
    
    // 通知前端
    if (global.broadcastLog && project.id) {
      const statusMsg = allSuccess ? '✅ 修复成功' : '❌ 修复失败';
      global.broadcastLog(String(project.id), `${statusMsg}: 执行了 ${results.length} 个修复命令`);
    }
    
    res.json({
      success: allSuccess,
      message: allSuccess ? '所有修复命令执行成功' : '部分修复命令执行失败',
      data: {
        status: finalStatus,
        results,
        total_commands: commands.length,
        successful_commands: results.filter(r => r.success).length
      }
    });
    
  } catch (error) {
    logger.error('应用修复命令失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 生成修复确认令牌
 * POST /api/ai/diagnosis/:diagnosisId/generate-token
 */
router.post('/diagnosis/:diagnosisId/generate-token', async (req, res) => {
  try {
    const { diagnosisId } = req.params;
    const { commands } = req.body;
    
    if (!commands || !Array.isArray(commands)) {
      return res.status(400).json({ error: '缺少修复命令' });
    }
    
    // 获取诊断记录
    const { DeploymentDiagnosisDB } = require('../services/database');
    const diagnosis = await DeploymentDiagnosisDB.getById(diagnosisId);
    if (!diagnosis) {
      return res.status(404).json({ error: '诊断记录不存在' });
    }
    
    // 生成确认令牌
    const { generateFixConfirmationToken } = require('../services/ai');
    const token = generateFixConfirmationToken(diagnosisId, commands);
    
    res.json({
      success: true,
      data: { token }
    });
    
  } catch (error) {
    logger.error('生成确认令牌失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 验证修复命令安全性
 * POST /api/ai/validate-commands
 */
router.post('/validate-commands', async (req, res) => {
  try {
    const { commands } = req.body;
    
    if (!commands || !Array.isArray(commands)) {
      return res.status(400).json({ error: '缺少命令列表' });
    }
    
    const { validateFixCommands } = require('../services/ai');
    const result = validateFixCommands(commands);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('验证命令失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

/**
 * AI 自动报错诊断与一键修复服务
 * 核心逻辑：监听部署/启动日志 -> 捕获错误关键行 -> AI 分析病因 -> 生成修复指令/代码修改方案
 */

const { chat } = require('./ai');
const { logger } = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

/**
 * 诊断错误并生成修复建议
 * @param {string} logContent 错误日志文本
 * @param {Object} projectContext 项目上下文 (技术栈, 路径)
 */
async function diagnoseAndSuggestFix(logContent, projectContext) {
  const prompt = `
    你是一个顶级的 DevOps 专家和全栈工程师。用户在部署/运行 GitHub 项目时遇到了报错。
    
    【报错日志】:
    ${logContent.slice(-2000)}  // 仅取最近 2000 字符
    
    【项目背景】:
    技术栈: ${projectContext.types || '未知'}
    本地路径: ${projectContext.local_path}
    
    【任务】:
    1. 诊断病因：用一句话说清楚为什么报错（小白听得懂）。
    2. 自动修复方案：如果是环境缺失、配置错误等，请给出一个可执行的 shell 命令。
    3. 代码修复建议：如果是代码问题，请给出具体的修改方案。
    
    请直接输出 JSON 格式：
    {
      "reason": "...",
      "fix_command": "...",
      "code_suggestion": "...",
      "level": "easy/medium/hard"
    }
  `;

  try {
    const response = await chat([{ role: 'user', content: prompt }], null, { jsonMode: true });
    return JSON.parse(response);
  } catch (err) {
    logger.error('AI diagnosis failed:', err);
    throw new Error('AI 诊断失败，请检查网络或配置。');
  }
}

/**
 * 执行一键修复命令
 */
async function applyAutoFix(projectId, fixCommand) {
  const { ProjectDB } = require('./database');
  const { executeCommand } = require('./deploy');
  const project = await ProjectDB.getById(projectId);

  if (!project) throw new Error('项目不存在');
  if (!fixCommand) throw new Error('未发现可自动修复的命令');

  logger.info(`Applying auto fix for ${project.name}: ${fixCommand}`);
  return await executeCommand(fixCommand, project.local_path);
}

module.exports = { diagnoseAndSuggestFix, applyAutoFix };
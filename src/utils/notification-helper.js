/**
 * 通知助手 - 集成邮件、日志、Webhook等多种通知方式
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('./logger');

const execAsync = promisify(exec);

/**
 * 发送邮件通知
 * @param {string} receiverEmail - 接收邮箱
 * @param {string} subject - 邮件标题
 * @param {string} content - 邮件内容（支持HTML）
 * @returns {Promise<Object>} - 发送结果
 */
async function sendEmailNotification(receiverEmail, subject, content) {
  try {
    // 构建HTML邮件内容
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-critical { background-color: #ffeaea; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
        .alert-high { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
        .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .vulnerability-item { background: white; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px; margin: 10px 0; }
        .severity-critical { color: #dc3545; font-weight: bold; }
        .severity-high { color: #ffc107; font-weight: bold; }
        .severity-moderate { color: #17a2b8; font-weight: bold; }
        .severity-low { color: #28a745; font-weight: bold; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 GADA 安全警报</h1>
        <p>${subject}</p>
    </div>
    <div class="content">
        ${content}
        <div class="footer">
            <p>此邮件由 <strong>GitHub Deploy Assistant (GADA)</strong> 自动发送</p>
            <p>访问 <a href="http://localhost:3456">GADA控制台</a> 查看详情</p>
            <p>如需取消此类通知，请在GADA设置中调整通知偏好</p>
        </div>
    </div>
</body>
</html>`;

    // 调用Python邮件发送服务
    const pythonScript = path.join(__dirname, '../services/mail_sender.py');
    const pythonModule = path.join(__dirname, '../services/event_hooks.py');
    
    // 检查Python服务是否存在
    if (!await fs.pathExists(pythonScript)) {
      logger.warn('Python邮件服务不存在，跳过邮件发送');
      return {
        success: false,
        error: 'Mail service not available',
        type: 'email'
      };
    }

    // 构建Python命令来发送邮件
    const pythonCode = `
import sys
sys.path.append('${path.join(__dirname, '..')}')
from services.mail_sender import send_mail

receiver_email = '${receiverEmail}'
subject = '''${subject}'''
content = '''${htmlContent}'''

success = send_mail(receiver_email, subject, content)
print(success)
`;

    // 将Python代码保存到临时文件
    const tempFile = path.join(__dirname, '../temp_email_sender.py');
    await fs.writeFile(tempFile, pythonCode);
    
    // 执行Python脚本
    const { stdout, stderr } = await execAsync(`python3 "${tempFile}"`);
    
    // 清理临时文件
    await fs.remove(tempFile).catch(() => {});
    
    const success = stdout.trim() === 'True';
    
    if (success) {
      logger.info(`邮件通知已发送到 ${receiverEmail}`);
      return {
        success: true,
        message: 'Email notification sent successfully',
        type: 'email',
        receiver: receiverEmail
      };
    } else {
      logger.error(`邮件发送失败到 ${receiverEmail}: ${stderr}`);
      return {
        success: false,
        error: stderr || 'Email sending failed',
        type: 'email',
        receiver: receiverEmail
      };
    }
    
  } catch (error) {
    logger.error(`发送邮件通知时发生错误: ${error.message}`, error);
    return {
      success: false,
      error: error.message,
      type: 'email'
    };
  }
}

/**
 * 发送安全警报（集成邮件和日志）
 * @param {Object} auditResult - npm audit结果
 * @param {string} projectName - 项目名称
 * @param {Object} options - 通知选项
 * @returns {Promise<Object>} - 通知结果
 */
async function sendSecurityAlert(auditResult, projectName, options = {}) {
  const defaultOptions = {
    channel: 'deploy', // 部署通道
    priority: auditResult.hasCriticalVulnerabilities ? 'high' : 'medium',
    sendEmail: true, // 默认发送邮件
    emailReceiver: '19106440339@163.com', // 默认接收邮箱
    ...options
  };

  const results = {
    email: null,
    log: null,
    webhook: null
  };

  try {
    // 1. 记录到日志
    logger.warn(`安全警报: 在项目 ${projectName} 中发现 ${auditResult.totalVulnerabilities} 个安全漏洞`, {
      project: projectName,
      hasCritical: auditResult.hasCriticalVulnerabilities,
      hasHigh: auditResult.hasHighVulnerabilities,
      totalVulnerabilities: auditResult.totalVulnerabilities,
      severityCounts: auditResult.severityCounts
    });
    
    results.log = {
      success: true,
      message: 'Logged security alert successfully'
    };

    // 2. 发送邮件通知（如果启用）
    if (defaultOptions.sendEmail && defaultOptions.emailReceiver) {
      const { generateVulnerabilityReport } = require('../services/vulnerability-scanner');
      const report = generateVulnerabilityReport(auditResult);
      
      // 构建邮件标题
      let emailSubject;
      if (auditResult.hasCriticalVulnerabilities) {
        emailSubject = `🔴 紧急：项目 ${projectName} 发现严重安全漏洞 (${auditResult.severityCounts.critical}个严重)`;
      } else if (auditResult.hasHighVulnerabilities) {
        emailSubject = `🟠 警告：项目 ${projectName} 发现高危安全漏洞 (${auditResult.severityCounts.high}个高危)`;
      } else {
        emailSubject = `🟡 通知：项目 ${projectName} 发现安全漏洞 (${auditResult.totalVulnerabilities}个)`;
      }
      
      // 构建邮件内容
      let emailContent = `
<h2>项目安全漏洞报告</h2>
<p><strong>项目名称：</strong> ${projectName}</p>
<p><strong>扫描时间：</strong> ${new Date().toLocaleString('zh-CN')}</p>
<p><strong>漏洞总数：</strong> ${auditResult.totalVulnerabilities}</p>
<p><strong>严重程度分布：</strong></p>
<ul>
    <li>🔴 严重 (Critical): ${auditResult.severityCounts.critical}</li>
    <li>🟠 高危 (High): ${auditResult.severityCounts.high}</li>
    <li>🟡 中危 (Moderate): ${auditResult.severityCounts.moderate}</li>
    <li>🔵 低危 (Low): ${auditResult.severityCounts.low}</li>
</ul>

<div class="${auditResult.hasCriticalVulnerabilities ? 'alert-critical' : 'alert-high'}">
    <h3>${auditResult.hasCriticalVulnerabilities ? '🔴 紧急安全警报' : '🟠 高危安全警告'}</h3>
    <p>发现 ${auditResult.hasCriticalVulnerabilities ? auditResult.severityCounts.critical + '个严重' : auditResult.severityCounts.high + '个高危'} 安全漏洞，可能导致：</p>
    <ul>
        <li>远程代码执行 (RCE)</li>
        <li>敏感数据泄露</li>
        <li>服务拒绝攻击</li>
        <li>权限提升漏洞</li>
    </ul>
</div>

<h3>修复建议</h3>
<ol>
    <li><strong>立即执行自动修复：</strong><br>
        <code>npm audit fix --force</code>
    </li>
    <li><strong>重新检查修复结果：</strong><br>
        <code>npm audit</code>
    </li>
    <li><strong>如果自动修复失败：</strong><br>
        - 查看详细报告：<code>npm audit --json</code><br>
        - 手动更新特定包：<code>npm update &lt;package-name&gt;</code>
    </li>
</ol>

<p><a href="http://localhost:3456" class="btn">前往GADA控制台查看详情</a></p>

<hr>
<h3>详细漏洞列表</h3>
`;

      // 添加严重和高危漏洞详情
      const criticalHighVulns = auditResult.detailedVulnerabilities.filter(v => 
        v.severity === 'critical' || v.severity === 'high'
      );
      
      if (criticalHighVulns.length > 0) {
        criticalHighVulns.forEach((vuln, index) => {
          const severityClass = `severity-${vuln.severity}`;
          emailContent += `
<div class="vulnerability-item">
    <h4><span class="${severityClass}">${vuln.severity.toUpperCase()}</span> ${vuln.name}</h4>
    <p><strong>依赖路径：</strong> ${vuln.dependencyOf}</p>
    <p><strong>受影响的版本：</strong> <code>${vuln.vulnerableVersions}</code></p>
    <p><strong>安全版本：</strong> <code>${vuln.patchedVersions}</code></p>
    ${vuln.description ? `<p><strong>描述：</strong> ${vuln.description}</p>` : ''}
    ${vuln.recommendation ? `<p><strong>建议：</strong> ${vuln.recommendation}</p>` : ''}
</div>`;
        });
      }
      
      // 发送邮件
      results.email = await sendEmailNotification(
        defaultOptions.emailReceiver,
        emailSubject,
        emailContent
      );
    }

    // 3. 发送Webhook通知（如果有配置）
    // TODO: 集成现有webhook系统

    return {
      success: results.email?.success || results.log?.success || false,
      results,
      alert: {
        type: 'security_alert',
        timestamp: new Date().toISOString(),
        project: projectName,
        priority: defaultOptions.priority,
        summary: `在项目 ${projectName} 中发现 ${auditResult.totalVulnerabilities} 个安全漏洞`,
        hasCritical: auditResult.hasCriticalVulnerabilities,
        hasHigh: auditResult.hasHighVulnerabilities,
        severityCounts: auditResult.severityCounts
      }
    };
    
  } catch (error) {
    logger.error(`发送安全警报时发生错误: ${error.message}`, error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

/**
 * 发送部署成功通知
 * @param {string} projectName - 项目名称
 * @param {string} accessUrl - 访问地址
 * @param {Object} options - 通知选项
 */
async function sendDeploySuccessNotification(projectName, accessUrl, options = {}) {
  const defaultOptions = {
    emailReceiver: '19106440339@163.com',
    ...options
  };

  try {
    const subject = `✅ 项目部署成功 - ${projectName}`;
    const content = `
<h2>项目部署成功通知</h2>
<p><strong>项目名称：</strong> ${projectName}</p>
<p><strong>部署时间：</strong> ${new Date().toLocaleString('zh-CN')}</p>
<p><strong>访问地址：</strong> <a href="${accessUrl}">${accessUrl}</a></p>
<p>项目已成功部署并启动运行。</p>
`;

    return await sendEmailNotification(defaultOptions.emailReceiver, subject, content);
    
  } catch (error) {
    logger.error(`发送部署成功通知时发生错误: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendEmailNotification,
  sendSecurityAlert,
  sendDeploySuccessNotification
};
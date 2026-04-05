/**
 * 验证器工具
 * 提供各种验证函数
 */

const URL = require('url');

/**
 * 验证仓库URL
 * @param {string} url - 仓库URL
 * @returns {object} 验证结果
 */
function validateRepositoryUrl(url) {
  if (!url) {
    return { valid: false, error: 'URL不能为空' };
  }
  
  try {
    const urlObj = new URL.URL(url);
    
    // 检查协议
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL必须使用HTTP或HTTPS协议' };
    }
    
    // 检查域名
    const validDomains = ['github.com', 'gitee.com'];
    if (!validDomains.includes(urlObj.hostname)) {
      return { 
        valid: false, 
        error: '仅支持 GitHub (github.com) 和 Gitee (gitee.com) 仓库' 
      };
    }
    
    // 检查路径格式：/owner/repo
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) {
      return { 
        valid: false, 
        error: 'URL必须包含仓库所有者名称和仓库名称' 
      };
    }
    
    // 检查是否包含不必要的内容（如tree/branch等）
    if (pathParts.length > 2) {
      const extraParts = pathParts.slice(2);
      const allowedExtra = ['tree', 'blob', 'commit', 'pull', 'issues'];
      const firstExtra = extraParts[0];
      
      if (!allowedExtra.includes(firstExtra)) {
        return { 
          valid: false, 
          error: 'URL应该指向仓库根目录，而不是特定文件或分支' 
        };
      }
    }
    
    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // 清理仓库名称（移除.git后缀）
    const cleanRepo = repo.replace(/\.git$/, '');
    
    return { 
      valid: true,
      platform: urlObj.hostname.includes('github.com') ? 'github' : 'gitee',
      owner,
      repo: cleanRepo,
      fullName: `${owner}/${cleanRepo}`,
      fullUrl: url
    };
  } catch (error) {
    return { valid: false, error: '无效的URL格式' };
  }
}

/**
 * 验证URL是否指向有效的仓库
 * @param {string} url - 仓库URL
 * @returns {Promise<object>} 验证结果
 */
async function validateRepositoryExists(url) {
  const validation = validateRepositoryUrl(url);
  if (!validation.valid) {
    return validation;
  }
  
  // TODO: 这里可以添加实际的API调用来验证仓库是否存在
  // 暂时返回成功
  return {
    ...validation,
    exists: true,
    isPublic: true,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * 验证部署配置
 * @param {object} config - 部署配置
 * @returns {object} 验证结果
 */
function validateDeployConfig(config) {
  const errors = [];
  
  if (!config) {
    return { valid: false, errors: ['配置不能为空'] };
  }
  
  // 验证必要字段
  if (!config.name) {
    errors.push('项目名称不能为空');
  }
  
  if (!config.repo_url) {
    errors.push('仓库URL不能为空');
  } else {
    const urlValidation = validateRepositoryUrl(config.repo_url);
    if (!urlValidation.valid) {
      errors.push(`仓库URL无效: ${urlValidation.error}`);
    }
  }
  
  // 验证可选字段
  if (config.port && (isNaN(parseInt(config.port)) || parseInt(config.port) < 1 || parseInt(config.port) > 65535)) {
    errors.push('端口号必须在1-65535之间');
  }
  
  if (config.auto_deploy && typeof config.auto_deploy !== 'boolean') {
    errors.push('auto_deploy必须是布尔值');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    validatedConfig: config
  };
}

/**
 * 验证浏览器扩展请求
 * @param {object} request - 浏览器扩展请求
 * @returns {object} 验证结果
 */
function validateBrowserRequest(request) {
  const errors = [];
  
  if (!request) {
    return { valid: false, errors: ['请求不能为空'] };
  }
  
  // 验证必要字段
  if (!request.repositoryUrl) {
    errors.push('repositoryUrl不能为空');
  }
  
  if (!request.action) {
    errors.push('action不能为空');
  } else if (!['deploy', 'validate', 'status'].includes(request.action)) {
    errors.push(`不支持的action: ${request.action}`);
  }
  
  // 验证时间戳格式（如果提供）
  if (request.timestamp) {
    const timestamp = new Date(request.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push('timestamp格式无效');
    }
    
    // 检查时间戳是否在未来（不应该）
    if (timestamp > new Date()) {
      errors.push('timestamp不能是未来时间');
    }
    
    // 检查时间戳是否太旧（超过24小时）
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (timestamp < twentyFourHoursAgo) {
      errors.push('timestamp太旧（超过24小时）');
    }
  }
  
  // 验证扩展ID格式（如果提供）
  if (request.extensionId) {
    const validPatterns = [
      /^chrome-extension-[\w-]+$/,
      /^moz-extension-[\w-]+$/,
      /^edge-extension-[\w-]+$/
    ];
    
    const isValid = validPatterns.some(pattern => pattern.test(request.extensionId));
    if (!isValid) {
      errors.push('extensionId格式无效');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    validatedRequest: request
  };
}

/**
 * 验证本地服务地址
 * @param {string} url - 服务地址
 * @returns {object} 验证结果
 */
function validateServiceUrl(url) {
  if (!url) {
    return { valid: false, error: '服务地址不能为空' };
  }
  
  try {
    const urlObj = new URL.URL(url);
    
    // 检查协议
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: '服务地址必须使用HTTP或HTTPS协议' };
    }
    
    // 检查主机名（只允许localhost或本地IP）
    const validHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (!validHostnames.includes(urlObj.hostname)) {
      return { 
        valid: false, 
        error: '服务地址必须指向本地主机（localhost, 127.0.0.1）' 
      };
    }
    
    return { 
      valid: true,
      protocol: urlObj.protocol.replace(':', ''),
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
      fullUrl: url
    };
  } catch (error) {
    return { valid: false, error: '无效的服务地址格式' };
  }
}

/**
 * 验证电子邮件地址
 * @param {string} email - 电子邮件地址
 * @returns {boolean} 是否有效
 */
function validateEmail(email) {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证GitHub/Gitee用户名
 * @param {string} username - 用户名
 * @returns {boolean} 是否有效
 */
function validateUsername(username) {
  if (!username) return false;
  
  // GitHub/Gitee用户名规则：
  // - 只包含字母数字字符和连字符
  // - 不能以连字符开头或结尾
  // - 不能有两个连续的连字符
  // - 长度在1-39个字符之间
  const usernameRegex = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;
  return usernameRegex.test(username);
}

/**
 * 验证仓库名称
 * @param {string} repoName - 仓库名称
 * @returns {boolean} 是否有效
 */
function validateRepoName(repoName) {
  if (!repoName) return false;
  
  // GitHub/Gitee仓库名称规则：
  // - 只包含字母数字字符、连字符、下划线和点
  // - 不能以点、下划线或连字符开头
  // - 不能以.git结尾
  // - 长度在1-100个字符之间
  const repoNameRegex = /^(?![-._])(?!.*\.git$)[a-zA-Z\d._-]{1,100}$/;
  return repoNameRegex.test(repoName);
}

module.exports = {
  validateRepositoryUrl,
  validateRepositoryExists,
  validateDeployConfig,
  validateBrowserRequest,
  validateServiceUrl,
  validateEmail,
  validateUsername,
  validateRepoName
};
// GitHub Deploy Assistant 浏览器扩展 - 工具函数

class GADAUtils {
  // 生成唯一ID
  static generateId() {
    return 'gada_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 验证仓库URL
  static validateRepositoryUrl(url) {
    if (!url) return { valid: false, error: 'URL不能为空' };
    
    try {
      const urlObj = new URL(url);
      
      // 检查域名
      const validDomains = ['github.com', 'gitee.com'];
      if (!validDomains.includes(urlObj.hostname)) {
        return { 
          valid: false, 
          error: '仅支持 GitHub 和 Gitee 仓库' 
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
      
      return { 
        valid: true, 
        platform: urlObj.hostname.includes('github.com') ? 'github' : 'gitee',
        owner: pathParts[0],
        repo: pathParts[1],
        fullUrl: url
      };
    } catch (error) {
      return { valid: false, error: '无效的URL格式' };
    }
  }

  // 从URL提取仓库信息
  static extractRepoInfo(url) {
    const validation = this.validateRepositoryUrl(url);
    if (!validation.valid) {
      return null;
    }
    
    return {
      url: validation.fullUrl,
      platform: validation.platform,
      owner: validation.owner,
      repo: validation.repo,
      fullName: `${validation.owner}/${validation.repo}`,
      apiUrl: validation.platform === 'github' 
        ? `https://api.github.com/repos/${validation.owner}/${validation.repo}`
        : `https://gitee.com/api/v5/repos/${validation.owner}/${validation.repo}`
    };
  }

  // 防抖函数
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // 本地存储操作
  static storage = {
    async get(key, defaultValue = null) {
      try {
        const result = await chrome.storage.local.get(key);
        return result[key] !== undefined ? result[key] : defaultValue;
      } catch (error) {
        console.warn('存储读取失败:', error);
        return defaultValue;
      }
    },

    async set(key, value) {
      try {
        await chrome.storage.local.set({ [key]: value });
        return true;
      } catch (error) {
        console.error('存储写入失败:', error);
        return false;
      }
    },

    async remove(key) {
      try {
        await chrome.storage.local.remove(key);
        return true;
      } catch (error) {
        console.error('存储删除失败:', error);
        return false;
      }
    },

    async clear() {
      try {
        await chrome.storage.local.clear();
        return true;
      } catch (error) {
        console.error('存储清空失败:', error);
        return false;
      }
    }
  };

  // 日志工具
  static logger = {
    log: function(...args) {
      console.log('[GADA]', ...args);
    },
    
    info: function(...args) {
      console.info('[GADA]', ...args);
    },
    
    warn: function(...args) {
      console.warn('[GADA]', ...args);
    },
    
    error: function(...args) {
      console.error('[GADA]', ...args);
    },
    
    debug: function(...args) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[GADA]', ...args);
      }
    }
  };

  // 错误处理
  static handleError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    this.logger.error('错误发生:', errorInfo);
    
    // 可以发送错误报告到服务器
    this.reportError(errorInfo);
    
    return errorInfo;
  }

  // 错误报告（占位函数）
  static async reportError(errorInfo) {
    // 这里可以集成错误报告服务
    // 例如：Sentry, LogRocket 等
    console.log('错误报告（模拟）:', errorInfo);
  }

  // 检查浏览器环境
  static getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let version = 'unknown';
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Firefox')) {
      browser = 'firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (userAgent.includes('Edg')) {
      browser = 'edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      version = match ? match[1] : 'unknown';
    }
    
    return { browser, version, userAgent };
  }

  // 格式化时间
  static formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = date instanceof Date ? date : new Date(date);
    
    const pad = (n) => n.toString().padStart(2, '0');
    
    const replacements = {
      YYYY: d.getFullYear(),
      MM: pad(d.getMonth() + 1),
      DD: pad(d.getDate()),
      HH: pad(d.getHours()),
      mm: pad(d.getMinutes()),
      ss: pad(d.getSeconds())
    };
    
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match]);
  }

  // 等待函数
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 深度合并对象
  static deepMerge(target, source) {
    const output = Object.assign({}, target);
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  // 检查是否为对象
  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  // 生成随机颜色
  static generateRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }

  // 复制文本到剪贴板
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // 降级方案
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackError) {
        console.error('复制到剪贴板失败:', fallbackError);
        return false;
      }
    }
  }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GADAUtils;
}

// 全局可用
window.GADAUtils = GADAUtils;
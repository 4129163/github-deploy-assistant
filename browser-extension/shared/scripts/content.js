// GitHub Deploy Assistant 浏览器扩展 - 内容脚本
// 在GitHub/Gitee仓库页面注入一键部署按钮

class GADAInjector {
  constructor() {
    this.observer = null;
    this.isInjected = false;
    this.init();
  }

  // 初始化
  init() {
    this.setupMutationObserver();
    this.injectButton();
    this.setupMessageListener();
  }

  // 设置Mutation Observer监听DOM变化
  setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          this.injectButton();
        }
      });
    });

    // 监听整个文档的变化
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 检测是否为仓库页面
  isRepositoryPage() {
    const path = window.location.pathname;
    const isGitHubRepo = window.location.hostname.includes('github.com') && 
                         path.split('/').length >= 3;
    const isGiteeRepo = window.location.hostname.includes('gitee.com') && 
                        path.split('/').length >= 3;
    
    return isGitHubRepo || isGiteeRepo;
  }

  // 获取仓库信息
  getRepositoryInfo() {
    const url = window.location.href;
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      
      return {
        url,
        owner,
        repo,
        fullName: `${owner}/${repo}`,
        platform: window.location.hostname.includes('github.com') ? 'github' : 'gitee'
      };
    }
    
    return null;
  }

  // 查找注入按钮的位置
  findInjectionPoint() {
    // GitHub仓库页面
    if (window.location.hostname.includes('github.com')) {
      // 尝试在仓库标题右侧注入
      const titleElement = document.querySelector('[itemprop="name"]');
      if (titleElement && titleElement.parentElement) {
        return titleElement.parentElement;
      }
      
      // 备用位置：仓库操作按钮区域
      const actionsElement = document.querySelector('.pagehead-actions');
      if (actionsElement) {
        return actionsElement;
      }
      
      // 备用位置：仓库标题区域
      const repoHead = document.querySelector('.repository-content');
      if (repoHead) {
        return repoHead;
      }
    }
    
    // Gitee仓库页面
    if (window.location.hostname.includes('gitee.com')) {
      // Gitee仓库标题区域
      const titleElement = document.querySelector('.repository-title');
      if (titleElement) {
        return titleElement.parentElement;
      }
      
      // 备用位置：仓库操作区域
      const actionsElement = document.querySelector('.repository-actions');
      if (actionsElement) {
        return actionsElement;
      }
    }
    
    return null;
  }

  // 创建部署按钮
  createDeployButton(repoInfo) {
    const button = document.createElement('button');
    button.className = 'gada-deploy-button';
    button.innerHTML = `
      <span class="gada-button-icon">🚀</span>
      <span class="gada-button-text">通过 GADA 一键部署</span>
    `;
    
    button.title = `快速部署 ${repoInfo.fullName} 到本地环境`;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleDeployClick(repoInfo);
    });
    
    return button;
  }

  // 处理部署按钮点击
  async handleDeployClick(repoInfo) {
    try {
      // 更新按钮状态
      const button = document.querySelector('.gada-deploy-button');
      if (button) {
        button.disabled = true;
        button.innerHTML = `
          <span class="gada-button-icon">⏳</span>
          <span class="gada-button-text">正在连接 GADA...</span>
        `;
      }

      // 发送消息给背景脚本
      const response = await chrome.runtime.sendMessage({
        action: 'deploy',
        repositoryUrl: repoInfo.url,
        repositoryInfo: repoInfo,
        timestamp: new Date().toISOString()
      });

      if (response.success) {
        this.showNotification('success', '部署请求已发送到本地GADA应用');
        
        // 恢复按钮状态
        if (button) {
          setTimeout(() => {
            button.disabled = false;
            button.innerHTML = `
              <span class="gada-button-icon">🚀</span>
              <span class="gada-button-text">通过 GADA 一键部署</span>
            `;
          }, 2000);
        }
      } else {
        throw new Error(response.message || '部署请求失败');
      }
    } catch (error) {
      console.error('GADA部署失败:', error);
      this.showNotification('error', `部署失败: ${error.message}`);
      
      // 恢复按钮状态
      const button = document.querySelector('.gada-deploy-button');
      if (button) {
        button.disabled = false;
        button.innerHTML = `
          <span class="gada-button-icon">🚀</span>
          <span class="gada-button-text">通过 GADA 一键部署</span>
        `;
      }
    }
  }

  // 显示通知
  showNotification(type, message) {
    // 移除已有的通知
    const existingNotification = document.querySelector('.gada-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `gada-notification gada-notification-${type}`;
    notification.innerHTML = `
      <span class="gada-notification-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="gada-notification-text">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动消失
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  // 注入按钮到页面
  injectButton() {
    // 如果不是仓库页面，不注入
    if (!this.isRepositoryPage()) {
      return;
    }
    
    // 如果已经注入，跳过
    if (this.isInjected && document.querySelector('.gada-deploy-button')) {
      return;
    }
    
    // 获取仓库信息
    const repoInfo = this.getRepositoryInfo();
    if (!repoInfo) {
      return;
    }
    
    // 查找注入位置
    const injectionPoint = this.findInjectionPoint();
    if (!injectionPoint) {
      return;
    }
    
    // 创建并注入按钮
    const button = this.createDeployButton(repoInfo);
    
    // 检查是否已存在按钮
    const existingButton = injectionPoint.querySelector('.gada-deploy-button');
    if (existingButton) {
      existingButton.replaceWith(button);
    } else {
      // 在合适位置插入按钮
      if (window.location.hostname.includes('github.com')) {
        injectionPoint.insertBefore(button, injectionPoint.firstChild);
      } else {
        injectionPoint.appendChild(button);
      }
    }
    
    this.isInjected = true;
    console.log('GADA按钮已注入:', repoInfo.fullName);
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'checkInjection') {
        sendResponse({ injected: this.isInjected });
      }
      return true;
    });
  }

  // 清理
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    const button = document.querySelector('.gada-deploy-button');
    if (button) {
      button.remove();
    }
    
    const notification = document.querySelector('.gada-notification');
    if (notification) {
      notification.remove();
    }
  }
}

// 初始化注入器
let gadaInjector = null;

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gadaInjector = new GADAInjector();
  });
} else {
  gadaInjector = new GADAInjector();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (gadaInjector) {
    gadaInjector.cleanup();
  }
});
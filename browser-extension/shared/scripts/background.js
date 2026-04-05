// GitHub Deploy Assistant 浏览器扩展 - 背景脚本
// 处理与本地GADA服务的通信

class GADABackground {
  constructor() {
    this.localServiceUrl = 'http://localhost:3000';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    this.init();
  }

  // 初始化
  init() {
    this.setupMessageListeners();
    this.setupAlarms();
    this.checkLocalService();
  }

  // 设置消息监听器
  setupMessageListeners() {
    // 处理来自内容脚本的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('收到消息:', request.action, request);
      
      switch (request.action) {
        case 'deploy':
          this.handleDeployRequest(request, sender, sendResponse);
          return true; // 保持消息通道开放
          
        case 'checkService':
          this.checkLocalService().then(status => {
            sendResponse({ status });
          });
          return true;
          
        case 'getStatus':
          this.getDeploymentStatus(request.deploymentId).then(status => {
            sendResponse(status);
          });
          return true;
          
        default:
          sendResponse({ error: '未知的操作类型' });
          return false;
      }
    });
  }

  // 设置定时任务
  setupAlarms() {
    // 每分钟检查一次本地服务状态
    chrome.alarms.create('checkService', { periodInMinutes: 1 });
    
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'checkService') {
        this.checkLocalService();
      }
    });
  }

  // 检查本地服务状态
  async checkLocalService() {
    try {
      const response = await fetch(`${this.localServiceUrl}/api/health`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('GADA本地服务正常:', data);
        return { online: true, ...data };
      } else {
        console.warn('GADA本地服务响应异常:', response.status);
        return { online: false, status: response.status };
      }
    } catch (error) {
      console.warn('无法连接到GADA本地服务:', error.message);
      return { online: false, error: error.message };
    }
  }

  // 处理部署请求
  async handleDeployRequest(request, sender, sendResponse) {
    try {
      // 验证请求数据
      if (!request.repositoryUrl) {
        throw new Error('缺少仓库URL');
      }

      // 验证URL格式
      const urlPattern = /^(https?:\/\/)(github\.com|gitee\.com)\/[^/]+\/[^/]+/;
      if (!urlPattern.test(request.repositoryUrl)) {
        throw new Error('无效的仓库URL格式');
      }

      // 首先检查本地服务是否可用
      const serviceStatus = await this.checkLocalService();
      if (!serviceStatus.online) {
        throw new Error('GADA本地服务未启动。请确保已安装并启动GADA应用。');
      }

      // 发送部署请求到本地服务
      const deploymentResponse = await this.sendDeployRequest(request);
      
      // 发送响应
      sendResponse({
        success: true,
        message: '部署请求已成功发送',
        deploymentId: deploymentResponse.deploymentId,
        statusUrl: deploymentResponse.statusUrl
      });
      
      // 可选：发送通知
      this.sendNotification('部署请求已发送', `正在处理仓库: ${request.repositoryInfo?.fullName || request.repositoryUrl}`);
      
    } catch (error) {
      console.error('部署请求处理失败:', error);
      
      sendResponse({
        success: false,
        message: error.message,
        error: error.toString()
      });
      
      // 发送错误通知
      this.sendNotification('部署失败', error.message);
    }
  }

  // 发送部署请求到本地服务
  async sendDeployRequest(request, retryCount = 0) {
    try {
      const payload = {
        repositoryUrl: request.repositoryUrl,
        repositoryInfo: request.repositoryInfo,
        action: 'deploy',
        timestamp: new Date().toISOString(),
        source: 'browser-extension',
        userAgent: navigator.userAgent
      };

      const response = await fetch(`${this.localServiceUrl}/api/browser/deploy`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '部署请求被拒绝');
      }
      
      return data;
      
    } catch (error) {
      // 重试逻辑
      if (retryCount < this.maxRetries) {
        console.log(`重试部署请求 (${retryCount + 1}/${this.maxRetries})...`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.sendDeployRequest(request, retryCount + 1);
      }
      
      throw error;
    }
  }

  // 获取部署状态
  async getDeploymentStatus(deploymentId) {
    try {
      const response = await fetch(`${this.localServiceUrl}/api/deployments/${deploymentId}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('获取部署状态失败:', error);
      return { error: error.message };
    }
  }

  // 发送浏览器通知
  sendNotification(title, message) {
    // 检查通知权限
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: `GADA: ${title}`,
        message: message,
        priority: 2
      });
    } else {
      console.log(`通知: ${title} - ${message}`);
    }
  }

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 清理资源
  cleanup() {
    // 清理定时任务
    chrome.alarms.clear('checkService');
  }
}

// 初始化背景脚本
let gadaBackground = null;

// 扩展安装/更新时初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('GADA扩展已安装/更新:', details.reason);
  gadaBackground = new GADABackground();
  
  // 创建默认设置
  chrome.storage.local.set({
    gadaSettings: {
      localServiceUrl: 'http://localhost:3000',
      autoCheckService: true,
      showNotifications: true,
      maxRetries: 3
    }
  });
});

// 扩展启动时初始化
if (!gadaBackground) {
  gadaBackground = new GADABackground();
}

// 扩展卸载时清理
chrome.runtime.onSuspend.addListener(() => {
  if (gadaBackground) {
    gadaBackground.cleanup();
  }
});
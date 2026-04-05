/**
 * 轻量级国际化(i18n)框架
 * 支持英文(en)、中文(zh-CN)、日文(ja)三种语言
 */

const I18n = {
  // 当前语言设置
  currentLang: 'zh-CN',
  
  // 浏览器语言检测
  detectBrowserLanguage: function() {
    const browserLang = navigator.language || navigator.userLanguage;
    const supportedLangs = ['en', 'zh-CN', 'ja'];
    
    // 检查完整语言代码
    if (supportedLangs.includes(browserLang)) {
      return browserLang;
    }
    
    // 检查语言前缀
    const langPrefix = browserLang.split('-')[0];
    if (supportedLangs.includes(langPrefix)) {
      return langPrefix;
    }
    
    // 检查语言前缀匹配
    for (const supportedLang of supportedLangs) {
      if (supportedLang.startsWith(langPrefix)) {
        return supportedLang;
      }
    }
    
    // 默认返回中文
    return 'zh-CN';
  },
  
  // 初始化语言
  init: function() {
    // 从localStorage获取保存的语言设置
    const savedLang = localStorage.getItem('gda_language');
    if (savedLang && translations[savedLang]) {
      this.currentLang = savedLang;
    } else {
      // 自动检测浏览器语言
      this.currentLang = this.detectBrowserLanguage();
      localStorage.setItem('gda_language', this.currentLang);
    }
    
    // 设置HTML lang属性
    document.documentElement.lang = this.currentLang;
    
    // 应用翻译
    this.applyTranslations();
    
    // 设置语言选择器
    this.setupLanguageSelector();
    
    console.log(`I18n initialized with language: ${this.currentLang}`);
  },
  
  // 切换语言
  setLanguage: function(lang) {
    if (translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('gda_language', lang);
      document.documentElement.lang = lang;
      this.applyTranslations();
      
      // 触发语言变化事件
      const event = new CustomEvent('languageChanged', { detail: { language: lang } });
      document.dispatchEvent(event);
      
      // 重新加载页面数据（如果需要）
      if (typeof window.loadProjectList === 'function') {
        window.loadProjectList();
      }
      
      console.log(`Language changed to: ${lang}`);
      return true;
    }
    return false;
  },
  
  // 获取当前语言
  getCurrentLanguage: function() {
    return this.currentLang;
  },
  
  // 翻译函数
  t: function(key, params = {}) {
    const translation = translations[this.currentLang] || translations['zh-CN'];
    
    // 获取翻译文本
    let text = translation[key];
    if (!text) {
      console.warn(`Translation key not found: ${key} for language ${this.currentLang}`);
      return key;
    }
    
    // 替换参数
    if (Object.keys(params).length > 0) {
      Object.keys(params).forEach(param => {
        const placeholder = `{${param}}`;
        text = text.replace(new RegExp(placeholder, 'g'), params[param]);
      });
    }
    
    return text;
  },
  
  // 格式化数字
  formatNumber: function(number) {
    const formatter = new Intl.NumberFormat(this.currentLang);
    return formatter.format(number);
  },
  
  // 格式化日期
  formatDate: function(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    const localeOptions = { ...defaultOptions, ...options };
    const formatter = new Intl.DateTimeFormat(this.currentLang, localeOptions);
    return formatter.format(new Date(date));
  },
  
  // 应用翻译到页面
  applyTranslations: function() {
    // 翻译所有带有 data-i18n 属性的元素
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.t(key);
      
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = text;
      } else {
        element.textContent = text;
      }
    });
    
    // 翻译所有带有 data-i18n-title 属性的元素
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });
    
    // 翻译所有带有 data-i18n-placeholder 属性的元素
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });
    
    // 更新语言选择器状态
    this.updateLanguageSelector();
  },
  
  // 设置语言选择器
  setupLanguageSelector: function() {
    // 创建或获取语言选择器
    let selector = document.getElementById('language-selector');
    if (!selector) {
      // 如果没有语言选择器，创建一个
      selector = document.createElement('div');
      selector.id = 'language-selector';
      selector.className = 'language-selector';
      selector.innerHTML = `
        <select id="language-dropdown" class="language-dropdown">
          <option value="en" data-icon="🇺🇸">English</option>
          <option value="zh-CN" data-icon="🇨🇳">中文</option>
          <option value="ja" data-icon="🇯🇵">日本語</option>
        </select>
      `;
      
      // 添加到页面
      const header = document.querySelector('.header-right');
      if (header) {
        header.insertBefore(selector, header.firstChild);
      } else {
        document.body.appendChild(selector);
      }
      
      // 添加事件监听
      const dropdown = document.getElementById('language-dropdown');
      dropdown.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    }
    
    this.updateLanguageSelector();
  },
  
  // 更新语言选择器状态
  updateLanguageSelector: function() {
    const dropdown = document.getElementById('language-dropdown');
    if (dropdown) {
      dropdown.value = this.currentLang;
    }
  },
  
  // 获取所有支持的语言
  getSupportedLanguages: function() {
    return Object.keys(translations);
  },
  
  // 获取语言名称
  getLanguageName: function(langCode) {
    const languageNames = {
      'en': 'English',
      'zh-CN': '中文',
      'ja': '日本語'
    };
    return languageNames[langCode] || langCode;
  }
};

// 初始化翻译数据
const translations = {
  'en': {
    // 通用
    'app.title': 'GitHub Deploy Assistant',
    'app.subtitle': 'Visual Deployment Manager',
    'app.version': 'Version',
    'app.loading': 'Loading...',
    'app.error': 'Error',
    'app.success': 'Success',
    'app.warning': 'Warning',
    'app.info': 'Information',
    'app.confirm': 'Confirm',
    'app.cancel': 'Cancel',
    'app.save': 'Save',
    'app.delete': 'Delete',
    'app.edit': 'Edit',
    'app.add': 'Add',
    'app.refresh': 'Refresh',
    'app.settings': 'Settings',
    'app.close': 'Close',
    'app.back': 'Back',
    'app.next': 'Next',
    'app.finish': 'Finish',
    'app.search': 'Search',
    'app.filter': 'Filter',
    'app.sort': 'Sort',
    'app.export': 'Export',
    'app.import': 'Import',
    'app.help': 'Help',
    'app.about': 'About',
    'app.language': 'Language',
    
    // 状态
    'status.running': 'Running',
    'status.stopped': 'Stopped',
    'status.starting': 'Starting',
    'status.stopping': 'Stopping',
    'status.restarting': 'Restarting',
    'status.error': 'Error',
    'status.unknown': 'Unknown',
    'status.healthy': 'Healthy',
    'status.warning': 'Warning',
    'status.critical': 'Critical',
    'status.offline': 'Offline',
    'status.online': 'Online',
    'status.paused': 'Paused',
    'status.resuming': 'Resuming',
    
    // 导航
    'nav.projects': 'Projects',
    'nav.dashboard': 'Dashboard',
    'nav.deployments': 'Deployments',
    'nav.monitoring': 'Monitoring',
    'nav.logs': 'Logs',
    'nav.templates': 'Templates',
    'nav.settings': 'Settings',
    'nav.help': 'Help',
    
    // 项目相关
    'project.list': 'Project List',
    'project.add': 'Add Project',
    'project.quick_add': 'Quick Add',
    'project.no_projects': 'No projects yet',
    'project.name': 'Project Name',
    'project.type': 'Project Type',
    'project.port': 'Port',
    'project.path': 'Path',
    'project.status': 'Status',
    'project.actions': 'Actions',
    'project.details': 'Details',
    'project.config': 'Configuration',
    'project.dependencies': 'Dependencies',
    'project.environment': 'Environment',
    'project.backup': 'Backup',
    'project.restore': 'Restore',
    'project.clone': 'Clone',
    'project.export': 'Export',
    
    // 操作按钮
    'action.start': 'Start',
    'action.stop': 'Stop',
    'action.restart': 'Restart',
    'action.logs': 'View Logs',
    'action.edit_port': 'Edit Port',
    'action.edit_env': 'Edit Environment',
    'action.update_deps': 'Update Dependencies',
    'action.rebuild': 'Rebuild',
    'action.backup': 'Backup',
    'action.monitor': 'Monitor',
    'action.deploy': 'Deploy',
    'action.undeploy': 'Undeploy',
    'action.scale': 'Scale',
    'action.migrate': 'Migrate',
    
    // 系统信息
    'system.status': 'System Status',
    'system.cpu': 'CPU',
    'system.memory': 'Memory',
    'system.disk': 'Disk',
    'system.network': 'Network',
    'system.uptime': 'Uptime',
    'system.load': 'Load Average',
    'system.processes': 'Processes',
    'system.connections': 'Connections',
    'system.health': 'Health Check',
    'system.metrics': 'Metrics',
    'system.alerts': 'Alerts',
    'system.events': 'Events',
    'system.audit': 'Audit Log',
    
    // 模板市场
    'template.market': 'Template Market',
    'template.market.description': 'Discover popular projects, deploy with one click',
    'template.browse': 'Browse Templates',
    'template.popular': 'Popular',
    'template.recent': 'Recent',
    'template.featured': 'Featured',
    'template.categories': 'Categories',
    'template.rating': 'Rating',
    'template.downloads': 'Downloads',
    'template.deploy': 'Deploy Now',
    'template.preview': 'Preview',
    'template.details': 'Template Details',
    'template.requirements': 'Requirements',
    'template.instructions': 'Instructions',
    'template.notes': 'Notes',
    
    // 监控
    'monitoring.detailed': 'View Detailed Monitoring',
    'monitoring.real_time': 'Real-time Monitoring',
    'monitoring.history': 'Historical Data',
    'monitoring.alerts': 'Alert Configuration',
    'monitoring.thresholds': 'Thresholds',
    'monitoring.notifications': 'Notifications',
    'monitoring.reports': 'Reports',
    'monitoring.dashboard': 'Monitoring Dashboard',
    'monitoring.performance': 'Performance',
    'monitoring.availability': 'Availability',
    'monitoring.latency': 'Latency',
    'monitoring.throughput': 'Throughput',
    'monitoring.errors': 'Error Rate',
    
    // 部署向导
    'wizard.title': 'Deployment Wizard',
    'wizard.step1': 'Select Project',
    'wizard.step2': 'Configuration',
    'wizard.step3': 'Dependencies',
    'wizard.step4': 'Environment',
    'wizard.step5': 'Deployment',
    'wizard.step6': 'Verification',
    'wizard.next': 'Next Step',
    'wizard.previous': 'Previous',
    'wizard.skip': 'Skip',
    'wizard.complete': 'Complete',
    'wizard.cancel': 'Cancel Wizard',
    
    // 错误消息
    'error.network': 'Network error, please check your connection',
    'error.server': 'Server error, please try again later',
    'error.validation': 'Validation failed, please check your input',
    'error.auth': 'Authentication failed, please login again',
    'error.permission': 'Permission denied',
    'error.not_found': 'Resource not found',
    'error.conflict': 'Resource conflict',
    'error.timeout': 'Request timeout',
    'error.rate_limit': 'Rate limit exceeded, please try again later',
    'error.maintenance': 'System under maintenance',
    'error.unknown': 'Unknown error occurred',
    
    // 成功消息
    'success.saved': 'Saved successfully',
    'success.deleted': 'Deleted successfully',
    'success.updated': 'Updated successfully',
    'success.created': 'Created successfully',
    'success.deployed': 'Deployed successfully',
    'success.started': 'Started successfully',
    'success.stopped': 'Stopped successfully',
    'success.restarted': 'Restarted successfully',
    'success.backed_up': 'Backed up successfully',
    'success.restored': 'Restored successfully',
    'success.cloned': 'Cloned successfully',
    
    // 确认对话框
    'confirm.delete': 'Are you sure you want to delete this item?',
    'confirm.stop': 'Are you sure you want to stop this project?',
    'confirm.restart': 'Are you sure you want to restart this project?',
    'confirm.deploy': 'Are you sure you want to deploy this project?',
    'confirm.undeploy': 'Are you sure you want to undeploy this project?',
    'confirm.exit': 'Are you sure you want to exit? Unsaved changes will be lost.',
    
    // 占位符文本
    'placeholder.search': 'Search projects...',
    'placeholder.name': 'Enter project name',
    'placeholder.url': 'Enter repository URL',
    'placeholder.path': 'Enter project path',
    'placeholder.port': 'Enter port number',
    'placeholder.env': 'Enter environment variables',
    'placeholder.command': 'Enter command',
    'placeholder.filter': 'Filter results...',
    
    // 工具提示
    'tooltip.refresh': 'Refresh project list',
    'tooltip.settings': 'Open settings',
    'tooltip.add_project': 'Add new project',
    'tooltip.quick_add': 'Quick add project',
    'tooltip.start': 'Start project',
    'tooltip.stop': 'Stop project',
    'tooltip.restart': 'Restart project',
    'tooltip.logs': 'View project logs',
    'tooltip.edit_port': 'Edit project port',
    'tooltip.edit_env': 'Edit environment variables',
    'tooltip.update_deps': 'Update dependencies',
    'tooltip.rebuild': 'Rebuild project',
    'tooltip.backup': 'Backup project',
    'tooltip.monitor': 'Monitor project',
    'tooltip.deploy': 'Deploy project',
    'tooltip.help': 'Get help',
    'tooltip.about': 'About this application',
    
    // 时间单位
    'time.seconds': 'seconds',
    'time.minutes': 'minutes',
    'time.hours': 'hours',
    'time.days': 'days',
    'time.weeks': 'weeks',
    'time.months': 'months',
    'time.years': 'years',
    
    // 单位
    'unit.percent': '%',
    'unit.mb': 'MB',
    'unit.gb': 'GB',
    'unit.tb': 'TB',
    'unit.mbps': 'Mbps',
    'unit.kbps': 'Kbps',
    'unit.rps': 'req/s',
    
    // 月份
    'month.january': 'January',
    'month.february': 'February',
    'month.march': 'March',
    'month.april': 'April',
    'month.may': 'May',
    'month.june': 'June',
    'month.july': 'July',
    'month.august': 'August',
    'month.september': 'September',
    'month.october': 'October',
    'month.november': 'November',
    'month.december': 'December',
    
    // 星期
    'weekday.sunday': 'Sunday',
    'weekday.monday': 'Monday',
    'weekday.tuesday': 'Tuesday',
    'weekday.wednesday': 'Wednesday',
    'weekday.thursday': 'Thursday',
    'weekday.friday': 'Friday',
    'weekday.saturday': 'Saturday'
  },
  
  'zh-CN': {
    // 通用
    'app.title': 'GitHub Deploy Assistant',
    'app.subtitle': '可视化部署管理器',
    'app.version': '版本',
    'app.loading': '加载中...',
    'app.error': '错误',
    'app.success': '成功',
    'app.warning': '警告',
    'app.info': '信息',
    'app.confirm': '确认',
    'app.cancel': '取消',
    'app.save': '保存',
    'app.delete': '删除',
    'app.edit': '编辑',
    'app.add': '添加',
    'app.refresh': '刷新',
    'app.settings': '设置',
    'app.close': '关闭',
    'app.back': '返回',
    'app.next': '下一步',
    'app.finish': '完成',
    'app.search': '搜索',
    'app.filter': '筛选',
    'app.sort': '排序',
    'app.export': '导出',
    'app.import': '导入',
    'app.help': '帮助',
    'app.about': '关于',
    'app.language': '语言',
    
    // 状态
    'status.running': '运行中',
    'status.stopped': '已停止',
    'status.starting': '启动中',
    'status.stopping': '停止中',
    'status.restarting': '重启中',
    'status.error': '错误',
    'status.unknown': '未知',
    'status.healthy': '健康',
    'status.warning': '警告',
    'status.critical': '严重',
    'status.offline': '离线',
    'status.online': '在线',
    'status.paused': '已暂停',
    'status.resuming': '恢复中',
    
    // 导航
    'nav.projects': '项目',
    'nav.dashboard': '仪表盘',
    'nav.deployments': '部署',
    'nav.monitoring': '监控',
    'nav.logs': '日志',
    'nav.templates': '模板',
    'nav.settings': '设置',
    'nav.help': '帮助',
    
    // 项目相关
    'project.list': '项目列表',
    'project.add': '添加项目',
    'project.quick_add': '快速添加',
    'project.no_projects': '暂无项目',
    'project.name': '项目名称',
    'project.type': '项目类型',
    'project.port': '端口',
    'project.path': '路径',
    'project.status': '状态',
    'project.actions': '操作',
    'project.details': '详情',
    'project.config': '配置',
    'project.dependencies': '依赖',
    'project.environment': '环境变量',
    'project.backup': '备份',
    'project.restore': '恢复',
    'project.clone': '克隆',
    'project.export': '导出',
    
    // 操作按钮
    'action.start': '启动',
    'action.stop': '停止',
    'action.restart': '重启',
    'action.logs': '查看日志',
    'action.edit_port': '编辑端口',
    'action.edit_env': '编辑环境变量',
    'action.update_deps': '更新依赖',
    'action.rebuild': '重新构建',
    'action.backup': '备份',
    'action.monitor': '监控',
    'action.deploy': '部署',
    'action.undeploy': '取消部署',
    'action.scale': '扩缩容',
    'action.migrate': '迁移',
    
    // 系统信息
    'system.status': '系统状态',
    'system.cpu': 'CPU',
    'system.memory': '内存',
    'system.disk': '磁盘',
    'system.network': '网络',
    'system.uptime': '运行时间',
    'system.load': '负载',
    'system.processes': '进程',
    'system.connections': '连接',
    'system.health': '健康检查',
    'system.metrics': '指标',
    'system.alerts': '告警',
    'system.events': '事件',
    'system.audit': '审计日志',
    
    // 模板市场
    'template.market': '模板市场',
    'template.market.description': '发现热门项目，一键部署',
    'template.browse': '浏览模板',
    'template.popular': '热门',
    'template.recent': '最近',
    'template.featured': '精选',
    'template.categories': '分类',
    'template.rating': '评分',
    'template.downloads': '下载量',
    'template.deploy': '立即部署',
    'template.preview': '预览',
    'template.details': '模板详情',
    'template.requirements': '要求',
    'template.instructions': '说明',
    'template.notes': '备注',
    
    // 监控
    'monitoring.detailed': '查看详细监控',
    'monitoring.real_time': '实时监控',
    'monitoring.history': '历史数据',
    'monitoring.alerts': '告警配置',
    'monitoring.thresholds': '阈值',
    'monitoring.notifications': '通知',
    'monitoring.reports': '报告',
    'monitoring.dashboard': '监控仪表盘',
    'monitoring.performance': '性能',
    'monitoring.availability': '可用性',
    'monitoring.latency': '延迟',
    'monitoring.throughput': '吞吐量',
    'monitoring.errors': '错误率',
    
    // 部署向导
    'wizard.title': '部署向导',
    'wizard.step1': '选择项目',
    'wizard.step2': '配置',
    'wizard.step3': '依赖',
    'wizard.step4': '环境变量',
    'wizard.step5': '部署',
    'wizard.step6': '验证',
    'wizard.next': '下一步',
    'wizard.previous': '上一步',
    'wizard.skip': '跳过',
    'wizard.complete': '完成',
    'wizard.cancel': '取消向导',
    
    // 错误消息
    'error.network': '网络错误，请检查网络连接',
    'error.server': '服务器错误，请稍后重试',
    'error.validation': '验证失败，请检查输入',
    'error.auth': '认证失败，请重新登录',
    'error.permission': '权限不足',
    'error.not_found': '资源未找到',
    'error.conflict': '资源冲突',
    'error.timeout': '请求超时',
    'error.rate_limit': '请求频率过高，请稍后重试',
    'error.maintenance': '系统维护中',
    'error.unknown': '发生未知错误',
    
    // 成功消息
    'success.saved': '保存成功',
    'success.deleted': '删除成功',
    'success.updated': '更新成功',
    'success.created': '创建成功',
    'success.deployed': '部署成功',
    'success.started': '启动成功',
    'success.stopped': '停止成功',
    'success.restarted': '重启成功',
    'success.backed_up': '备份成功',
    'success.restored': '恢复成功',
    'success.cloned': '克隆成功',
    
    // 确认对话框
    'confirm.delete': '确定要删除此项吗？',
    'confirm.stop': '确定要停止此项目吗？',
    'confirm.restart': '确定要重启此项目吗？',
    'confirm.deploy': '确定要部署此项目吗？',
    'confirm.undeploy': '确定要取消部署此项目吗？',
    'confirm.exit': '确定要退出吗？未保存的更改将丢失。',
    
    // 占位符文本
    'placeholder.search': '搜索项目...',
    'placeholder.name': '输入项目名称',
    'placeholder.url': '输入仓库URL',
    'placeholder.path': '输入项目路径',
    'placeholder.port': '输入端口号',
    'placeholder.env': '输入环境变量',
    'placeholder.command': '输入命令',
    'placeholder.filter': '筛选结果...',
    
    // 工具提示
    'tooltip.refresh': '刷新项目列表',
    'tooltip.settings': '打开设置',
    'tooltip.add_project': '添加新项目',
    'tooltip.quick_add': '快速添加项目',
    'tooltip.start': '启动项目',
    'tooltip.stop': '停止项目',
    'tooltip.restart': '重启项目',
    'tooltip.logs': '查看项目日志',
    'tooltip.edit_port': '编辑项目端口',
    'tooltip.edit_env': '编辑环境变量',
    'tooltip.update_deps': '更新依赖',
    'tooltip.rebuild': '重新构建项目',
    'tooltip.backup': '备份项目',
    'tooltip.monitor': '监控项目',
    'tooltip.deploy': '部署项目',
    'tooltip.help': '获取帮助',
    'tooltip.about': '关于此应用',
    
    // 时间单位
    'time.seconds': '秒',
    'time.minutes': '分钟',
    'time.hours': '小时',
    'time.days': '天',
    'time.weeks': '周',
    'time.months': '月',
    'time.years': '年',
    
    // 单位
    'unit.percent': '%',
    'unit.mb': 'MB',
    'unit.gb': 'GB',
    'unit.tb': 'TB',
    'unit.mbps': 'Mbps',
    'unit.kbps': 'Kbps',
    'unit.rps': '请求/秒',
    
    // 月份
    'month.january': '一月',
    'month.february': '二月',
    'month.march': '三月',
    'month.april': '四月',
    'month.may': '五月',
    'month.june': '六月',
    'month.july': '七月',
    'month.august': '八月',
    'month.september': '九月',
    'month.october': '十月',
    'month.november': '十一月',
    'month.december': '十二月',
    
    // 星期
    'weekday.sunday': '星期日',
    'weekday.monday': '星期一',
    'weekday.tuesday': '星期二',
    'weekday.wednesday': '星期三',
    'weekday.thursday': '星期四',
    'weekday.friday': '星期五',
    'weekday.saturday': '星期六'
  },
  
  'ja': {
    // 通用
    'app.title': 'GitHub Deploy Assistant',
    'app.subtitle': 'ビジュアルデプロイマネージャー',
    'app.version': 'バージョン',
    'app.loading': '読み込み中...',
    'app.error': 'エラー',
    'app.success': '成功',
    'app.warning': '警告',
    'app.info': '情報',
    'app.confirm': '確認',
    'app.cancel': 'キャンセル',
    'app.save': '保存',
    'app.delete': '削除',
    'app.edit': '編集',
    'app.add': '追加',
    'app.refresh': '更新',
    'app.settings': '設定',
    'app.close': '閉じる',
    'app.back': '戻る',
    'app.next': '次へ',
    'app.finish': '完了',
    'app.search': '検索',
    'app.filter': 'フィルター',
    'app.sort': '並び替え',
    'app.export': 'エクスポート',
    'app.import': 'インポート',
    'app.help': 'ヘルプ',
    'app.about': 'について',
    'app.language': '言語',
    
    // 状态
    'status.running': '実行中',
    'status.stopped': '停止済み',
    'status.starting': '起動中',
    'status.stopping': '停止中',
    'status.restarting': '再起動中',
    'status.error': 'エラー',
    'status.unknown': '不明',
    'status.healthy': '正常',
    'status.warning': '警告',
    'status.critical': '重大',
    'status.offline': 'オフライン',
    'status.online': 'オンライン',
    'status.paused': '一時停止',
    'status.resuming': '再開中',
    
    // 导航
    'nav.projects': 'プロジェクト',
    'nav.dashboard': 'ダッシュボード',
    'nav.deployments': 'デプロイ',
    'nav.monitoring': '監視',
    'nav.logs': 'ログ',
    'nav.templates': 'テンプレート',
    'nav.settings': '設定',
    'nav.help': 'ヘルプ',
    
    // 项目相关
    'project.list': 'プロジェクト一覧',
    'project.add': 'プロジェクト追加',
    'project.quick_add': 'クイック追加',
    'project.no_projects': 'プロジェクトがありません',
    'project.name': 'プロジェクト名',
    'project.type': 'プロジェクトタイプ',
    'project.port': 'ポート',
    'project.path': 'パス',
    'project.status': '状態',
    'project.actions': '操作',
    'project.details': '詳細',
    'project.config': '設定',
    'project.dependencies': '依存関係',
    'project.environment': '環境変数',
    'project.backup': 'バックアップ',
    'project.restore': '復元',
    'project.clone': 'クローン',
    'project.export': 'エクスポート',
    
    // 操作按钮
    'action.start': '起動',
    'action.stop': '停止',
    'action.restart': '再起動',
    'action.logs': 'ログを表示',
    'action.edit_port': 'ポートを編集',
    'action.edit_env': '環境変数を編集',
    'action.update_deps': '依存関係を更新',
    'action.rebuild': '再構築',
    'action.backup': 'バックアップ',
    'action.monitor': '監視',
    'action.deploy': 'デプロイ',
    'action.undeploy': 'デプロイ解除',
    'action.scale': 'スケーリング',
    'action.migrate': '移行',
    
    // 系统信息
    'system.status': 'システム状態',
    'system.cpu': 'CPU',
    'system.memory': 'メモリ',
    'system.disk': 'ディスク',
    'system.network': 'ネットワーク',
    'system.uptime': '稼働時間',
    'system.load': '負荷',
    'system.processes': 'プロセス',
    'system.connections': '接続',
    'system.health': 'ヘルスチェック',
    'system.metrics': 'メトリクス',
    'system.alerts': 'アラート',
    'system.events': 'イベント',
    'system.audit': '監査ログ',
    
    // 模板市场
    'template.market': 'テンプレートマーケット',
    'template.market.description': '人気プロジェクトを発見、ワンクリックでデプロイ',
    'template.browse': 'テンプレートを閲覧',
    'template.popular': '人気',
    'template.recent': '最近',
    'template.featured': 'おすすめ',
    'template.categories': 'カテゴリー',
    'template.rating': '評価',
    'template.downloads': 'ダウンロード数',
    'template.deploy': '今すぐデプロイ',
    'template.preview': 'プレビュー',
    'template.details': 'テンプレート詳細',
    'template.requirements': '要件',
    'template.instructions': '説明',
    'template.notes': '備考',
    
    // 监控
    'monitoring.detailed': '詳細な監視を表示',
    'monitoring.real_time': 'リアルタイム監視',
    'monitoring.history': '履歴データ',
    'monitoring.alerts': 'アラート設定',
    'monitoring.thresholds': '閾値',
    'monitoring.notifications': '通知',
    'monitoring.reports': 'レポート',
    'monitoring.dashboard': '監視ダッシュボード',
    'monitoring.performance': 'パフォーマンス',
    'monitoring.availability': '可用性',
    'monitoring.latency': 'レイテンシ',
    'monitoring.throughput': 'スループット',
    'monitoring.errors': 'エラー率',
    
    // 部署向导
    'wizard.title': 'デプロイウィザード',
    'wizard.step1': 'プロジェクト選択',
    'wizard.step2': '設定',
    'wizard.step3': '依存関係',
    'wizard.step4': '環境変数',
    'wizard.step5': 'デプロイ',
    'wizard.step6': '検証',
    'wizard.next': '次へ',
    'wizard.previous': '前へ',
    'wizard.skip': 'スキップ',
    'wizard.complete': '完了',
    'wizard.cancel': 'ウィザードをキャンセル',
    
    // 错误消息
    'error.network': 'ネットワークエラー、接続を確認してください',
    'error.server': 'サーバーエラー、後でもう一度お試しください',
    'error.validation': '検証に失敗しました、入力を確認してください',
    'error.auth': '認証に失敗しました、再度ログインしてください',
    'error.permission': '権限がありません',
    'error.not_found': 'リソースが見つかりません',
    'error.conflict': 'リソースの競合',
    'error.timeout': 'リクエストがタイムアウトしました',
    'error.rate_limit': 'リクエスト制限を超えました、後でもう一度お試しください',
    'error.maintenance': 'システムメンテナンス中',
    'error.unknown': '不明なエラーが発生しました',
    
    // 成功消息
    'success.saved': '保存しました',
    'success.deleted': '削除しました',
    'success.updated': '更新しました',
    'success.created': '作成しました',
    'success.deployed': 'デプロイしました',
    'success.started': '起動しました',
    'success.stopped': '停止しました',
    'success.restarted': '再起動しました',
    'success.backed_up': 'バックアップしました',
    'success.restored': '復元しました',
    'success.cloned': 'クローンしました',
    
    // 确认对话框
    'confirm.delete': 'この項目を削除してもよろしいですか？',
    'confirm.stop': 'このプロジェクトを停止してもよろしいですか？',
    'confirm.restart': 'このプロジェクトを再起動してもよろしいですか？',
    'confirm.deploy': 'このプロジェクトをデプロイしてもよろしいですか？',
    'confirm.undeploy': 'このプロジェクトのデプロイを解除してもよろしいですか？',
    'confirm.exit': '終了してもよろしいですか？保存されていない変更は失われます。',
    
    // 占位符文本
    'placeholder.search': 'プロジェクトを検索...',
    'placeholder.name': 'プロジェクト名を入力',
    'placeholder.url': 'リポジトリURLを入力',
    'placeholder.path': 'プロジェクトパスを入力',
    'placeholder.port': 'ポート番号を入力',
    'placeholder.env': '環境変数を入力',
    'placeholder.command': 'コマンドを入力',
    'placeholder.filter': '結果をフィルター...',
    
    // 工具提示
    'tooltip.refresh': 'プロジェクト一覧を更新',
    'tooltip.settings': '設定を開く',
    'tooltip.add_project': '新しいプロジェクトを追加',
    'tooltip.quick_add': 'プロジェクトをクイック追加',
    'tooltip.start': 'プロジェクトを起動',
    'tooltip.stop': 'プロジェクトを停止',
    'tooltip.restart': 'プロジェクトを再起動',
    'tooltip.logs': 'プロジェクトログを表示',
    'tooltip.edit_port': 'プロジェクトポートを編集',
    'tooltip.edit_env': '環境変数を編集',
    'tooltip.update_deps': '依存関係を更新',
    'tooltip.rebuild': 'プロジェクトを再構築',
    'tooltip.backup': 'プロジェクトをバックアップ',
    'tooltip.monitor': 'プロジェクトを監視',
    'tooltip.deploy': 'プロジェクトをデプロイ',
    'tooltip.help': 'ヘルプを取得',
    'tooltip.about': 'このアプリについて',
    
    // 时间单位
    'time.seconds': '秒',
    'time.minutes': '分',
    'time.hours': '時間',
    'time.days': '日',
    'time.weeks': '週',
    'time.months': '月',
    'time.years': '年',
    
    // 单位
    'unit.percent': '%',
    'unit.mb': 'MB',
    'unit.gb': 'GB',
    'unit.tb': 'TB',
    'unit.mbps': 'Mbps',
    'unit.kbps': 'Kbps',
    'unit.rps': 'リクエスト/秒',
    
    // 月份
    'month.january': '1月',
    'month.february': '2月',
    'month.march': '3月',
    'month.april': '4月',
    'month.may': '5月',
    'month.june': '6月',
    'month.july': '7月',
    'month.august': '8月',
    'month.september': '9月',
    'month.october': '10月',
    'month.november': '11月',
    'month.december': '12月',
    
    // 星期
    'weekday.sunday': '日曜日',
    'weekday.monday': '月曜日',
    'weekday.tuesday': '火曜日',
    'weekday.wednesday': '水曜日',
    'weekday.thursday': '木曜日',
    'weekday.friday': '金曜日',
    'weekday.saturday': '土曜日'
  }
};

// 导出到全局作用域
window.I18n = I18n;
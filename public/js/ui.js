// GitHub Deploy Assistant - UI交互增强

// UI状态管理
const UIState = {
    currentView: 'dashboard',
    selectedTab: 'projects',
    isDarkMode: false,
    sidebarCollapsed: false,
    logsVisible: true
};

// 初始化UI组件
function initUI() {
    console.log('初始化UI组件...');
    
    // 初始化工具提示
    initTooltips();
    
    // 初始化拖拽功能
    initDragAndDrop();
    
    // 初始化主题切换
    initThemeToggle();
    
    // 初始化响应式布局
    initResponsiveLayout();
    
    // 初始化动画效果
    initAnimations();
    
    console.log('UI组件初始化完成');
}

// 工具提示系统
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        const tooltipText = element.getAttribute('data-tooltip');
        
        element.addEventListener('mouseenter', (e) => {
            showTooltip(e.target, tooltipText);
        });
        
        element.addEventListener('mouseleave', () => {
            hideTooltip();
        });
        
        element.addEventListener('focus', (e) => {
            showTooltip(e.target, tooltipText);
        });
        
        element.addEventListener('blur', () => {
            hideTooltip();
        });
    });
}

function showTooltip(element, text) {
    // 移除现有工具提示
    hideTooltip();
    
    // 创建新工具提示
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.id = 'current-tooltip';
    
    // 计算位置
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    tooltip.style.position = 'absolute';
    tooltip.style.top = `${rect.top + scrollTop - 35}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.transform = 'translateX(-50%)';
    
    document.body.appendChild(tooltip);
    
    // 添加箭头
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    tooltip.appendChild(arrow);
}

function hideTooltip() {
    const tooltip = document.getElementById('current-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// 拖拽功能（用于重新排序项目列表）
function initDragAndDrop() {
    const projectList = document.getElementById('project-list');
    
    // 使用Sortable.js的简化实现
    let dragItem = null;
    
    projectList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('project-item')) {
            dragItem = e.target;
            setTimeout(() => {
                dragItem.style.opacity = '0.4';
            }, 0);
        }
    });
    
    projectList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(projectList, e.clientY);
        const draggable = document.querySelector('.dragging');
        
        if (afterElement == null) {
            projectList.appendChild(draggable);
        } else {
            projectList.insertBefore(draggable, afterElement);
        }
    });
    
    projectList.addEventListener('dragend', (e) => {
        if (dragItem) {
            dragItem.style.opacity = '1';
            dragItem = null;
            
            // 保存新的顺序
            saveProjectOrder();
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.project-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveProjectOrder() {
    const projectItems = document.querySelectorAll('.project-item');
    const order = Array.from(projectItems).map(item => item.dataset.id);
    
    console.log('保存项目顺序:', order);
    // 这里可以调用API保存顺序
}

// 主题切换
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        // 如果没有主题切换按钮，创建一个
        createThemeToggle();
        return;
    }
    
    themeToggle.addEventListener('click', toggleTheme);
    
    // 检查本地存储的主题设置
    const savedTheme = localStorage.getItem('gada-theme');
    if (savedTheme === 'dark') {
        enableDarkMode();
    }
}

function createThemeToggle() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    
    const themeToggle = document.createElement('button');
    themeToggle.id = 'theme-toggle';
    themeToggle.className = 'btn btn-icon btn-dark';
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.title = '切换主题';
    
    themeToggle.addEventListener('click', toggleTheme);
    headerRight.insertBefore(themeToggle, headerRight.firstChild);
}

function toggleTheme() {
    if (UIState.isDarkMode) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    UIState.isDarkMode = true;
    localStorage.setItem('gada-theme', 'dark');
    
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        toggleBtn.title = '切换到浅色模式';
    }
}

function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    UIState.isDarkMode = false;
    localStorage.setItem('gada-theme', 'light');
    
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        toggleBtn.title = '切换到深色模式';
    }
}

// 响应式布局
function initResponsiveLayout() {
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
    
    // 初始检查
    handleResize();
    
    // 初始化侧边栏切换
    initSidebarToggle();
}

function handleResize() {
    const width = window.innerWidth;
    
    if (width < 768) {
        // 移动端布局
        enableMobileLayout();
    } else if (width < 1200) {
        // 平板布局
        enableTabletLayout();
    } else {
        // 桌面布局
        enableDesktopLayout();
    }
}

function enableMobileLayout() {
    document.body.classList.add('mobile-view');
    document.body.classList.remove('tablet-view');
    
    // 自动折叠侧边栏
    if (!UIState.sidebarCollapsed) {
        toggleSidebar();
    }
    
    // 隐藏右侧面板
    const sidebarRight = document.querySelector('.sidebar-right');
    if (sidebarRight) {
        sidebarRight.style.display = 'none';
    }
}

function enableTabletLayout() {
    document.body.classList.add('tablet-view');
    document.body.classList.remove('mobile-view');
    
    // 显示侧边栏
    if (UIState.sidebarCollapsed) {
        toggleSidebar();
    }
    
    // 隐藏右侧面板
    const sidebarRight = document.querySelector('.sidebar-right');
    if (sidebarRight) {
        sidebarRight.style.display = 'none';
    }
}

function enableDesktopLayout() {
    document.body.classList.remove('mobile-view', 'tablet-view');
    
    // 显示所有面板
    const sidebarRight = document.querySelector('.sidebar-right');
    if (sidebarRight) {
        sidebarRight.style.display = 'flex';
    }
}

function initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!sidebarToggle) {
        createSidebarToggle();
        return;
    }
    
    sidebarToggle.addEventListener('click', toggleSidebar);
}

function createSidebarToggle() {
    const headerLeft = document.querySelector('.header-left');
    if (!headerLeft) return;
    
    const sidebarToggle = document.createElement('button');
    sidebarToggle.id = 'sidebar-toggle';
    sidebarToggle.className = 'btn btn-icon btn-secondary';
    sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    sidebarToggle.title = '切换侧边栏';
    
    sidebarToggle.addEventListener('click', toggleSidebar);
    headerLeft.appendChild(sidebarToggle);
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    UIState.sidebarCollapsed = !UIState.sidebarCollapsed;
    
    if (UIState.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '60px';
        
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        }
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = '';
        
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        }
    }
    
    // 保存状态到本地存储
    localStorage.setItem('sidebar-collapsed', UIState.sidebarCollapsed);
}

// 动画效果
function initAnimations() {
    // 添加按钮点击动画
    initButtonAnimations();
    
    // 添加页面切换动画
    initPageTransitions();
    
    // 添加加载动画
    initLoadingAnimations();
}

function initButtonAnimations() {
    const buttons = document.querySelectorAll('.btn:not(.btn-icon)');
    
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // 添加涟漪效果
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.7);
                transform: scale(0);
                animation: ripple-animation 0.6s linear;
                width: ${size}px;
                height: ${size}px;
                top: ${y}px;
                left: ${x}px;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

function initPageTransitions() {
    // 页面切换时的淡入效果
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
}

function initLoadingAnimations() {
    // 为加载状态添加动画
    const loadingElements = document.querySelectorAll('.loading');
    
    loadingElements.forEach(element => {
        element.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
            </div>
        `;
    });
}

// 通知系统
function showNotification(type, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const iconMap = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 关闭按钮事件
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        hideNotification(notification);
    });
    
    // 自动关闭
    if (duration > 0) {
        setTimeout(() => {
            hideNotification(notification);
        }, duration);
    }
    
    return notification;
}

function hideNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 300);
}

// 表单验证
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true;
    
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            markInvalid(input, '此字段为必填项');
            isValid = false;
        } else {
            markValid(input);
            
            // 特定字段验证
            if (input.type === 'email') {
                if (!isValidEmail(input.value)) {
                    markInvalid(input, '请输入有效的邮箱地址');
                    isValid = false;
                }
            }
            
            if (input.type === 'url') {
                if (!isValidUrl(input.value)) {
                    markInvalid(input, '请输入有效的URL地址');
                    isValid = false;
                }
            }
            
            if (input.type === 'number') {
                const min = input.getAttribute('min');
                const max = input.getAttribute('max');
                
                if (min && parseInt(input.value) < parseInt(min)) {
                    markInvalid(input, `最小值不能小于 ${min}`);
                    isValid = false;
                }
                
                if (max && parseInt(input.value) > parseInt(max)) {
                    markInvalid(input, `最大值不能大于 ${max}`);
                    isValid = false;
                }
            }
        }
    });
    
    return isValid;
}

function markInvalid(input, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    
    // 移除现有错误消息
    const existingError = input.parentNode.querySelector('.invalid-feedback');
    if (existingError) {
        existingError.remove();
    }
    
    // 添加错误消息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
}

function markValid(input) {
    input.classList.add('is-valid');
    input.classList.remove('is-invalid');
    
    // 移除错误消息
    const existingError = input.parentNode.querySelector('.invalid-feedback');
    if (existingError) {
        existingError.remove();
    }
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

// 数据可视化
function createChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const defaultOptions = {
        type: 'line',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            }
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // 创建Canvas元素
    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);
    
    // 这里可以集成实际的图表库，如Chart.js
    // 为了简单起见，我们使用模拟图表
    
    const chart = {
        update: function(newData) {
            console.log('图表更新:', newData);
            // 实际实现中这里会更新图表
        },
        destroy: function() {
            canvas.remove();
        }
    };
    
    // 绘制一个简单的模拟图表
    drawMockChart(canvas, data, mergedOptions);
    
    return chart;
}

function drawMockChart(canvas, data, options) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentNode.clientWidth;
    const height = canvas.height = canvas.parentNode.clientHeight;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // 绘制标题
    if (options.title && options.title.text) {
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.fillText(options.title.text, width / 2, 30);
    }
    
    // 绘制简单的柱状图
    if (options.type === 'bar' && data && data.labels && data.datasets) {
        const dataset = data.datasets[0];
        const barCount = data.labels.length;
        const barWidth = (width - 100) / barCount;
        const maxValue = Math.max(...dataset.data);
        
        // 绘制坐标轴
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(50, height - 50);
        ctx.lineTo(width - 50, height - 50);
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制柱状图
        dataset.data.forEach((value, index) => {
            const barHeight = ((value / maxValue) * (height - 150));
            const x = 50 + (index * barWidth) + (barWidth / 4);
            const y = height - 50 - barHeight;
            
            ctx.fillStyle = dataset.backgroundColor || '#007bff';
            ctx.fillRect(x, y, barWidth / 2, barHeight);
            
            // 绘制标签
            ctx.font = '12px Inter, sans-serif';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(data.labels[index], x + (barWidth / 4), height - 35);
            
            // 绘制数值
            ctx.fillText(value.toString(), x + (barWidth / 4), y - 5);
        });
    }
}

// 搜索功能
function initSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            clearSearch();
        }
    });
}

function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();
    
    if (query.length < 2) {
        clearSearch();
        return;
    }
    
    // 搜索项目
    const searchResults = searchProjects(query);
    
    // 显示搜索结果
    displaySearchResults(searchResults);
}

function searchProjects(query) {
    const results = {
        projects: [],
        actions: [],
        settings: []
    };
    
    // 搜索项目名称和描述
    results.projects = projects.filter(project => 
        project.name.toLowerCase().includes(query) ||
        project.type.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query)
    );
    
    // 搜索操作（根据按钮文本）
    const actions = [
        { name: '启动项目', action: 'start' },
        { name: '停止项目', action: 'stop' },
        { name: '重启项目', action: 'restart' },
        { name: '部署项目', action: 'deploy' },
        { name: '备份项目', action: 'backup' },
        { name: '回滚项目', action: 'rollback' }
    ];
    
    results.actions = actions.filter(action => 
        action.name.toLowerCase().includes(query)
    );
    
    return results;
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) {
        createSearchResultsPanel();
    }
    
    const totalResults = results.projects.length + results.actions.length;
    
    if (totalResults === 0) {
        searchResults.innerHTML = `
            <div class="search-empty">
                <i class="fas fa-search"></i>
                <p>未找到匹配的结果</p>
            </div>
        `;
    } else {
        let html = `<div class="search-header">找到 ${totalResults} 个结果</div>`;
        
        if (results.projects.length > 0) {
            html += `<div class="search-section">
                <h5>项目 (${results.projects.length})</h5>
                <div class="search-items">`;
            
            results.projects.forEach(project => {
                html += `
                    <div class="search-item" onclick="selectProject(${project.id})">
                        <i class="fas fa-project-diagram"></i>
                        <div>
                            <strong>${project.name}</strong>
                            <small>${project.type} · 端口: ${project.port}</small>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        if (results.actions.length > 0) {
            html += `<div class="search-section">
                <h5>操作 (${results.actions.length})</h5>
                <div class="search-items">`;
            
            results.actions.forEach(action => {
                html += `
                    <div class="search-item" onclick="executeSearchAction('${action.action}')">
                        <i class="fas fa-play-circle"></i>
                        <div>
                            <strong>${action.name}</strong>
                            <small>点击执行此操作</small>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        }
        
        searchResults.innerHTML = html;
    }
    
    searchResults.style.display = 'block';
}

function createSearchResultsPanel() {
    const searchResults = document.createElement('div');
    searchResults.id = 'search-results';
    searchResults.className = 'search-results-panel';
    
    document.body.appendChild(searchResults);
}

function clearSearch() {
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.style.display = 'none';
    }
}

function executeSearchAction(action) {
    switch (action) {
        case 'start':
            if (currentProject) startProject();
            break;
        case 'stop':
            if (currentProject) stopProject();
            break;
        case 'restart':
            if (currentProject) restartProject();
            break;
        case 'deploy':
            oneClickDeploy();
            break;
        case 'backup':
            if (currentProject) backupProject();
            break;
        case 'rollback':
            if (currentProject) rollbackProject();
            break;
    }
    
    clearSearch();
}

// 实用函数
function debounce(func, wait) {
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

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1分钟内
        return '刚刚';
    } else if (diff < 3600000) { // 1小时内
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
    } else if (diff < 86400000) { // 1天内
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    } else if (diff < 604800000) { // 1周内
        const days = Math.floor(diff / 86400000);
        return `${days}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 导出函数
window.initUI = initUI;
window.showNotification = showNotification;
window.validateForm = validateForm;
window.createChart = createChart;
window.formatBytes = formatBytes;
window.formatTime = formatTime;

// 在main.js初始化后调用
setTimeout(initUI, 100);
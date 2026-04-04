/**
 * 模板市场JavaScript
 * 负责模板市场的UI交互、数据加载、筛选搜索等功能
 */

class TemplateMarket {
    constructor() {
        this.templates = [];
        this.filteredTemplates = [];
        this.categories = [];
        this.currentPage = 1;
        this.pageSize = 12;
        this.currentFilters = {
            category: '',
            difficulty: '',
            projectType: '',
            searchQuery: '',
            sort: 'popular'
        };
        
        this.init();
    }
    
    async init() {
        // 绑定事件
        this.bindEvents();
        
        // 加载模板数据
        await this.loadTemplates();
        
        // 加载统计数据
        await this.loadStats();
        
        // 初始化UI
        this.updateUI();
    }
    
    bindEvents() {
        // 搜索输入
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentFilters.searchQuery = e.target.value.trim();
                this.applyFilters();
            }, 300);
        });
        
        // 分类筛选
        const categoryFilter = document.getElementById('category-filter');
        categoryFilter.addEventListener('change', (e) => {
            this.currentFilters.category = e.target.value;
            this.applyFilters();
        });
        
        // 难度筛选
        const difficultyFilter = document.getElementById('difficulty-filter');
        difficultyFilter.addEventListener('change', (e) => {
            this.currentFilters.difficulty = e.target.value;
            this.applyFilters();
        });
        
        // 排序筛选
        const sortFilter = document.getElementById('sort-filter');
        sortFilter.addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.applyFilters();
        });
        
        // 分页按钮
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateUI();
            }
        });
        
        document.getElementById('next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredTemplates.length / this.pageSize);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updateUI();
            }
        });
        
        // 点击外部关闭详情模态框
        const modal = document.getElementById('template-detail-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDetailModal();
            }
        });
        
        // ESC键关闭详情模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDetailModal();
            }
        });
    }
    
    async loadTemplates() {
        try {
            const response = await fetch('/api/template-market/list?limit=100');
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.data.templates;
                this.categories = data.data.categories;
                
                // 更新分类筛选器选项
                this.updateCategoryFilter();
                
                // 更新项目类型筛选器
                this.updateProjectTypeFilter();
                
                // 更新热门标签
                this.updatePopularTags();
                
                console.log(`已加载 ${this.templates.length} 个模板`);
            } else {
                throw new Error(data.error || '加载模板失败');
            }
        } catch (error) {
            console.error('加载模板数据失败:', error);
            this.showError('加载模板数据失败，请刷新页面重试');
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/template-market/stats');
            const data = await response.json();
            
            if (data.success) {
                const stats = data.data;
                
                // 更新统计数据
                document.getElementById('total-templates').textContent = stats.total_templates;
                document.getElementById('total-categories').textContent = stats.total_categories;
                
                // 计算热门项目数量（星标数 > 50k）
                const popularCount = this.templates.filter(t => {
                    const stars = parseInt(t.stars) || 0;
                    return stars > 50000;
                }).length;
                document.getElementById('popular-count').textContent = popularCount;
                
                // 更新部署统计
                this.updateDeployStats(stats);
            }
        } catch (error) {
            console.error('加载统计信息失败:', error);
        }
    }
    
    updateCategoryFilter() {
        const categoryFilter = document.getElementById('category-filter');
        
        // 清空现有选项（保留第一个"所有分类"选项）
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }
        
        // 添加分类选项
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }
    
    updateProjectTypeFilter() {
        const container = document.getElementById('project-type-filters');
        container.innerHTML = '';
        
        // 获取所有项目类型
        const projectTypes = [...new Set(this.templates.map(t => t.project_type))];
        
        projectTypes.forEach(type => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `type-${type}`;
            checkbox.value = type;
            
            const label = document.createElement('label');
            label.htmlFor = `type-${type}`;
            label.textContent = type;
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            
            // 绑定点击事件
            checkbox.addEventListener('change', () => {
                this.currentFilters.projectType = checkbox.checked ? type : '';
                this.applyFilters();
            });
            
            container.appendChild(optionDiv);
        });
    }
    
    updatePopularTags() {
        const container = document.getElementById('popular-tags');
        container.innerHTML = '';
        
        // 收集所有标签并计算出现次数
        const tagCounts = {};
        this.templates.forEach(template => {
            (template.tags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        
        // 按出现次数排序，取前8个
        const popularTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([tag]) => tag);
        
        popularTags.forEach(tag => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `tag-${tag}`;
            checkbox.value = tag;
            
            const label = document.createElement('label');
            label.htmlFor = `tag-${tag}`;
            label.textContent = tag;
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            
            // 标签点击事件（暂时只显示，不筛选）
            optionDiv.addEventListener('click', (e) => {
                e.preventDefault();
                // 在搜索框中显示标签
                document.getElementById('search-input').value = tag;
                this.currentFilters.searchQuery = tag;
                this.applyFilters();
            });
            
            container.appendChild(optionDiv);
        });
    }
    
    updateDeployStats(stats) {
        const container = document.getElementById('deploy-stats');
        container.innerHTML = '';
        
        // 创建统计信息
        const statsItems = [
            { label: '简单项目', value: stats.difficulty.easy, color: '#10b981' },
            { label: '中等项目', value: stats.difficulty.medium, color: '#f59e0b' },
            { label: '困难项目', value: stats.difficulty.hard, color: '#ef4444' },
            { label: '30天内更新', value: stats.updated_recently, color: '#3b82f6' }
        ];
        
        statsItems.forEach(item => {
            const statDiv = document.createElement('div');
            statDiv.className = 'stat-item';
            statDiv.style.marginBottom = '15px';
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'stat-value';
            valueSpan.textContent = item.value;
            valueSpan.style.color = item.color;
            valueSpan.style.fontSize = '1.2rem';
            valueSpan.style.fontWeight = '600';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'stat-label';
            labelSpan.textContent = item.label;
            labelSpan.style.display = 'block';
            labelSpan.style.fontSize = '0.85rem';
            labelSpan.style.color = '#6b7280';
            labelSpan.style.marginTop = '4px';
            
            statDiv.appendChild(valueSpan);
            statDiv.appendChild(labelSpan);
            container.appendChild(statDiv);
        });
    }
    
    applyFilters() {
        let filtered = [...this.templates];
        
        // 按搜索关键词过滤
        if (this.currentFilters.searchQuery) {
            const query = this.currentFilters.searchQuery.toLowerCase();
            filtered = filtered.filter(template => 
                template.name.toLowerCase().includes(query) ||
                template.description.toLowerCase().includes(query) ||
                (template.tags || []).some(tag => tag.toLowerCase().includes(query)) ||
                template.category.toLowerCase().includes(query)
            );
        }
        
        // 按分类过滤
        if (this.currentFilters.category) {
            filtered = filtered.filter(template => 
                template.category === this.currentFilters.category
            );
        }
        
        // 按难度过滤
        if (this.currentFilters.difficulty) {
            filtered = filtered.filter(template => 
                template.difficulty === this.currentFilters.difficulty
            );
        }
        
        // 按项目类型过滤
        if (this.currentFilters.projectType) {
            filtered = filtered.filter(template => 
                template.project_type === this.currentFilters.projectType
            );
        }
        
        // 排序
        switch (this.currentFilters.sort) {
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'updated':
                filtered.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
                break;
            case 'popular':
            default:
                filtered.sort((a, b) => {
                    const aStars = parseInt(a.stars) || 0;
                    const bStars = parseInt(b.stars) || 0;
                    return bStars - aStars;
                });
                break;
        }
        
        this.filteredTemplates = filtered;
        this.currentPage = 1; // 重置到第一页
        this.updateUI();
    }
    
    updateUI() {
        // 显示/隐藏加载状态
        const loadingState = document.getElementById('loading-state');
        loadingState.style.display = this.templates.length === 0 ? 'block' : 'none';
        
        // 更新模板网格
        this.updateTemplatesGrid();
        
        // 更新分页
        this.updatePagination();
    }
    
    updateTemplatesGrid() {
        const container = document.getElementById('templates-grid');
        
        // 如果过滤后没有结果
        if (this.filteredTemplates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>未找到匹配的模板</h3>
                    <p>请尝试不同的搜索词或筛选条件</p>
                </div>
            `;
            return;
        }
        
        // 计算当前页显示的模板
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageTemplates = this.filteredTemplates.slice(startIndex, endIndex);
        
        // 生成模板卡片HTML
        container.innerHTML = pageTemplates.map(template => this.createTemplateCardHTML(template)).join('');
        
        // 为每个卡片绑定事件
        pageTemplates.forEach((template, index) => {
            const card = container.children[index];
            const deployBtn = card.querySelector('.deploy-btn');
            const detailsBtn = card.querySelector('.details-btn');
            
            if (deployBtn) {
                deployBtn.addEventListener('click', () => this.deployTemplate(template));
            }
            
            if (detailsBtn) {
                detailsBtn.addEventListener('click', () => this.showTemplateDetails(template));
            }
        });
    }
    
    createTemplateCardHTML(template) {
        return `
            <div class="template-card ${template.verified ? 'featured' : ''}">
                <div class="template-header">
                    <div class="template-icon">
                        <span>${template.icon}</span>
                    </div>
                    <div class="template-info">
                        <h3 class="template-name">${template.name}</h3>
                        <span class="template-category">${template.category}</span>
                    </div>
                    <div class="template-stars">
                        <i class="fas fa-star"></i>
                        <span>${template.stars}</span>
                    </div>
                </div>
                
                <div class="template-body">
                    <p class="template-description">${template.description}</p>
                    
                    <div class="template-tags">
                        ${(template.tags || []).slice(0, 4).map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                    
                    <div class="template-features">
                        ${(template.features || []).slice(0, 3).map(feature => `
                            <span class="feature">
                                <i class="fas fa-check"></i>
                                ${feature}
                            </span>
                        `).join('')}
                    </div>
                    
                    <div class="template-meta">
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${template.estimated_time}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-plug"></i>
                            <span>端口 ${template.port}</span>
                        </div>
                    </div>
                </div>
                
                <div class="template-footer">
                    <span class="difficulty ${template.difficulty}">
                        ${template.difficulty}
                    </span>
                    <div class="template-actions">
                        <button class="btn btn-secondary details-btn" style="margin-right: 8px;">
                            <i class="fas fa-info-circle"></i> 详情
                        </button>
                        <button class="btn btn-primary deploy-btn">
                            <i class="fas fa-rocket"></i> 一键部署
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    updatePagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredTemplates.length / this.pageSize);
        
        // 如果只有一页或没有结果，隐藏分页
        if (totalPages <= 1 || this.filteredTemplates.length === 0) {
            pagination.style.display = 'none';
            return;
        }
        
        pagination.style.display = 'flex';
        
        // 更新分页信息
        document.getElementById('page-info').textContent = 
            `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        
        // 更新按钮状态
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= totalPages;
    }
    
    async deployTemplate(template) {
        if (!confirm(`确定要部署「${template.name}」吗？\n\n项目地址：${template.repo_url}`)) {
            return;
        }
        
        try {
            // 显示加载状态
            this.showLoading('正在准备部署...');
            
            // 调用部署API
            const response = await fetch(`/api/template-market/${template.id}/deploy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_name: `${template.name}-${Date.now()}`,
                    custom_env_vars: {}
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 跳转到部署向导
                alert('模板部署配置已生成，正在跳转到部署页面...');
                
                // 将配置传递给主页面
                localStorage.setItem('templateDeploymentConfig', JSON.stringify(data.data.config));
                
                // 跳转到主页，由主页处理部署流程
                window.location.href = 'index.html';
            } else {
                throw new Error(data.error || '部署失败');
            }
        } catch (error) {
            console.error('部署失败:', error);
            this.showError(`部署失败: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }
    
    showTemplateDetails(template) {
        const modal = document.getElementById('template-detail-modal');
        const content = document.getElementById('template-detail-content');
        
        // 生成详情内容
        content.innerHTML = this.createTemplateDetailHTML(template);
        
        // 显示模态框
        modal.style.display = 'flex';
        
        // 为详情页面的部署按钮绑定事件
        setTimeout(() => {
            const deployBtn = document.getElementById('detail-deploy-btn');
            if (deployBtn) {
                deployBtn.addEventListener('click', () => {
                    this.closeDetailModal();
                    this.deployTemplate(template);
                });
            }
        }, 100);
    }
    
    createTemplateDetailHTML(template) {
        const requiredEnvVars = (template.env_vars || []).filter(v => v.required);
        const optionalEnvVars = (template.env_vars || []).filter(v => !v.required);
        
        return `
            <div class="template-detail">
                <div class="detail-header">
                    <button class="btn btn-text close-btn" onclick="templateMarket.closeDetailModal()">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="detail-title">
                        <span class="detail-icon">${template.icon}</span>
                        <h2>${template.name}</h2>
                        <span class="detail-category">${template.category}</span>
                    </div>
                </div>
                
                <div class="detail-body">
                    <div class="detail-section">
                        <h3><i class="fas fa-info-circle"></i> 项目描述</h3>
                        <p class="detail-description">${template.description}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-tags"></i> 标签</h3>
                        <div class="detail-tags">
                            ${(template.tags || []).map(tag => `
                                <span class="detail-tag">${tag}</span>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3><i class="fas fa-star"></i> 项目热度</h3>
                        <div class="detail-stats">
                            <div class="stat-item">
                                <span class="stat-label">星标数</span>
                                <span class="stat-value">${template.stars}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">最后更新</span>
                                <span class="stat-value">${template.last_updated}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">项目类型</span>
                                <span class="stat-value">${template.project_type}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${requiredEnvVars.length > 0 ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-key"></i> 必填环境变量</h3>
                            <div class="env-vars">
                                ${requiredEnvVars.map(env => `
                                    <div class="env-var">
                                        <div class="env-key">${env.key}</div>
                                        <div class="env-desc">${env.desc}</div>
                                        ${env.default ? `<div class="env-default">默认值: ${env.default}</div>` : ''}
                                        ${env.help ? `<div class="env-help">${env.help}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${optionalEnvVars.length > 0 ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-cogs"></i> 可选环境变量</h3>
                            <div class="env-vars">
                                ${optionalEnvVars.map(env => `
                                    <div class="env-var optional">
                                        <div class="env-key">${env.key}</div>
                                        <div class="env-desc">${env.desc}</div>
                                        ${env.default ? `<div class="env-default">默认值: ${env.default}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${template.setup_steps && template.setup_steps.length > 0 ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-list-ol"></i> 部署步骤</h3>
                            <ol class="setup-steps">
                                ${template.setup_steps.map(step => `
                                    <li class="setup-step">
                                        <span class="step-desc">${step.desc}</span>
                                        <code class="step-cmd">${step.cmd}</code>
                                    </li>
                                `).join('')}
                            </ol>
                        </div>
                    ` : ''}
                    
                    ${template.system_requirements ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-server"></i> 系统要求</h3>
                            <div class="system-requirements">
                                ${Object.entries(template.system_requirements).map(([key, value]) => `
                                    <div class="requirement">
                                        <span class="req-key">${key}:</span>
                                        <span class="req-value">${value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${template.example_code ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-code"></i> 示例代码</h3>
                            <pre class="example-code"><code>${template.example_code}</code></pre>
                        </div>
                    ` : ''}
                </div>
                
                <div class="detail-footer">
                    <button class="btn btn-secondary" onclick="templateMarket.closeDetailModal()">
                        <i class="fas fa-times"></i> 关闭
                    </button>
                    <button class="btn btn-primary" id="detail-deploy-btn">
                        <i class="fas fa-rocket"></i> 一键部署
                    </button>
                </div>
            </div>
        `;
    }
    
    closeDetailModal() {
        const modal = document.getElementById('template-detail-modal');
        modal.style.display = 'none';
    }
    
    showLoading(message = '加载中...') {
        // 创建或显示加载遮罩
        let loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            
            const spinner = document.createElement('div');
            spinner.innerHTML = `
                <div style="text-align: center;">
                    <i class="fas fa-spinner fa-spin fa-3x" style="color: #3b82f6;"></i>
                    <p style="margin-top: 15px; color: #4b5563;">${message}</p>
                </div>
            `;
            
            loadingOverlay.appendChild(spinner);
            document.body.appendChild(loadingOverlay);
        } else {
            loadingOverlay.style.display = 'flex';
        }
    }
    
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    showError(message) {
        alert(`错误: ${message}`);
    }
}

// 全局实例
let templateMarket;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    templateMarket = new TemplateMarket();
});
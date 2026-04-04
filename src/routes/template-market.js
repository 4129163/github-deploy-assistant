/**
 * 模板市场路由
 * 提供热门项目模板的浏览、搜索、一键部署功能
 * 
 * API端点：
 * GET  /api/template-market/list          - 获取所有模板
 * GET  /api/template-market/categories    - 获取所有分类
 * GET  /api/template-market/search        - 搜索模板
 * GET  /api/template-market/popular       - 获取热门模板
 * GET  /api/template-market/:id           - 获取单个模板详情
 * POST /api/template-market/:id/deploy    - 使用模板一键部署
 * GET  /api/template-market/stats         - 获取模板市场统计信息
 */

const express = require('express');
const router = express.Router();
const {
  TEMPLATE_MARKET_DATA,
  groupTemplatesByCategory,
  getAllCategories,
  searchTemplates,
  getPopularTemplates
} = require('../data/template-market');
const { logger } = require('../utils/logger');

// 获取所有模板
router.get('/list', async (req, res) => {
  try {
    const { 
      category, 
      difficulty, 
      sort = 'popular', 
      limit = 50,
      page = 1 
    } = req.query;
    
    let templates = [...TEMPLATE_MARKET_DATA];
    
    // 按分类过滤
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    // 按难度过滤
    if (difficulty) {
      templates = templates.filter(t => t.difficulty === difficulty);
    }
    
    // 排序
    if (sort === 'popular') {
      templates.sort((a, b) => {
        const aStars = parseInt(a.stars) || 0;
        const bStars = parseInt(b.stars) || 0;
        return bStars - aStars;
      });
    } else if (sort === 'name') {
      templates.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'updated') {
      templates.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
    }
    
    // 分页
    const pageSize = parseInt(limit);
    const pageNum = parseInt(page);
    const startIndex = (pageNum - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTemplates = templates.slice(startIndex, endIndex);
    
    // 分组数据
    const grouped = groupTemplatesByCategory(templates);
    
    res.json({
      success: true,
      data: {
        templates: paginatedTemplates,
        total: templates.length,
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(templates.length / pageSize),
        groups: grouped,
        categories: getAllCategories(templates)
      }
    });
  } catch (err) {
    logger.error('获取模板列表失败:', err);
    res.status(500).json({ error: '获取模板列表失败: ' + err.message });
  }
});

// 获取所有分类
router.get('/categories', async (req, res) => {
  try {
    const categories = getAllCategories(TEMPLATE_MARKET_DATA);
    res.json({
      success: true,
      data: categories
    });
  } catch (err) {
    logger.error('获取分类失败:', err);
    res.status(500).json({ error: '获取分类失败: ' + err.message });
  }
});

// 搜索模板
router.get('/search', async (req, res) => {
  try {
    const { q, category, difficulty } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: '请输入搜索关键词' });
    }
    
    let results = searchTemplates(TEMPLATE_MARKET_DATA, q);
    
    // 可选过滤
    if (category) {
      results = results.filter(t => t.category === category);
    }
    
    if (difficulty) {
      results = results.filter(t => t.difficulty === difficulty);
    }
    
    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query: q
      }
    });
  } catch (err) {
    logger.error('搜索模板失败:', err);
    res.status(500).json({ error: '搜索模板失败: ' + err.message });
  }
});

// 获取热门模板
router.get('/popular', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const popularTemplates = getPopularTemplates(TEMPLATE_MARKET_DATA, parseInt(limit));
    
    res.json({
      success: true,
      data: popularTemplates
    });
  } catch (err) {
    logger.error('获取热门模板失败:', err);
    res.status(500).json({ error: '获取热门模板失败: ' + err.message });
  }
});

// 获取单个模板详情
router.get('/:id', async (req, res) => {
  try {
    const template = TEMPLATE_MARKET_DATA.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    
    // 获取相关模板（同分类）
    const relatedTemplates = TEMPLATE_MARKET_DATA
      .filter(t => t.category === template.category && t.id !== template.id)
      .slice(0, 4);
    
    res.json({
      success: true,
      data: {
        template,
        relatedTemplates,
        categoryCount: TEMPLATE_MARKET_DATA.filter(t => t.category === template.category).length
      }
    });
  } catch (err) {
    logger.error('获取模板详情失败:', err);
    res.status(500).json({ error: '获取模板详情失败: ' + err.message });
  }
});

// 使用模板一键部署
router.post('/:id/deploy', async (req, res) => {
  try {
    const template = TEMPLATE_MARKET_DATA.find(t => t.id === req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    
    const { custom_env_vars = {}, project_name } = req.body;
    
    // 验证必填环境变量
    const requiredVars = template.env_vars.filter(v => v.required);
    const missingVars = requiredVars.filter(v => !custom_env_vars[v.key]);
    
    if (missingVars.length > 0) {
      return res.status(400).json({
        error: '缺少必填环境变量',
        missing: missingVars.map(v => ({ key: v.key, desc: v.desc }))
      });
    }
    
    // 构建部署配置
    const deploymentConfig = {
      template_id: template.id,
      template_name: template.name,
      repo_url: template.repo_url,
      project_type: template.project_type,
      start_cmd: template.start_cmd,
      port: template.port,
      env_vars: {
        ...Object.fromEntries(template.env_vars.filter(v => v.default).map(v => [v.key, v.default])),
        ...custom_env_vars
      },
      setup_steps: template.setup_steps,
      project_name: project_name || `${template.name}-${Date.now()}`,
      deployed_at: new Date().toISOString()
    };
    
    // 记录部署日志
    logger.info(`模板部署开始: ${template.name}`, {
      template_id: template.id,
      project_name: deploymentConfig.project_name,
      user: req.user?.id || 'anonymous'
    });
    
    // 这里应该调用现有的部署服务
    // 暂时返回配置，由前端处理实际的部署流程
    res.json({
      success: true,
      data: {
        config: deploymentConfig,
        redirect: {
          type: 'template_deployment',
          template: template.name,
          repo_url: template.repo_url,
          next_step: '/deploy'
        },
        message: '模板配置已生成，即将开始部署...'
      }
    });
    
  } catch (err) {
    logger.error('模板部署失败:', err);
    res.status(500).json({ error: '模板部署失败: ' + err.message });
  }
});

// 获取模板市场统计信息
router.get('/stats', async (req, res) => {
  try {
    const categories = getAllCategories(TEMPLATE_MARKET_DATA);
    
    const stats = {
      total_templates: TEMPLATE_MARKET_DATA.length,
      total_categories: categories.length,
      categories: categories.map(category => ({
        name: category,
        count: TEMPLATE_MARKET_DATA.filter(t => t.category === category).length
      })),
      difficulty: {
        easy: TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '简单').length,
        medium: TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '中等').length,
        hard: TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '困难').length
      },
      project_types: {
        nodejs: TEMPLATE_MARKET_DATA.filter(t => t.project_type === 'nodejs').length,
        python: TEMPLATE_MARKET_DATA.filter(t => t.project_type === 'python').length,
        docker: TEMPLATE_MARKET_DATA.filter(t => t.project_type === 'docker').length,
        php: TEMPLATE_MARKET_DATA.filter(t => t.project_type === 'php').length
      },
      updated_recently: TEMPLATE_MARKET_DATA.filter(t => {
        const updatedDate = new Date(t.last_updated);
        const now = new Date();
        const daysDiff = (now - updatedDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      }).length
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    logger.error('获取模板统计失败:', err);
    res.status(500).json({ error: '获取模板统计失败: ' + err.message });
  }
});

module.exports = router;
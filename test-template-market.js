/**
 * 模板市场功能测试脚本
 */

const assert = require('assert');

// 测试模板市场数据
const { 
  TEMPLATE_MARKET_DATA, 
  getAllCategories,
  searchTemplates,
  getPopularTemplates 
} = require('./src/data/template-market');

console.log('🧪 开始测试模板市场功能...\n');

// 测试1: 检查模板数据
console.log('📊 测试1: 检查模板数据');
console.log(`模板总数: ${TEMPLATE_MARKET_DATA.length}`);
assert(TEMPLATE_MARKET_DATA.length >= 5, '模板数量应至少为5个');
assert(TEMPLATE_MARKET_DATA.length <= 10, '模板数量应不超过10个');
console.log('✅ 模板数量符合要求 (5-10个)\n');

// 测试2: 检查模板结构
console.log('📋 测试2: 检查模板结构');
const sampleTemplate = TEMPLATE_MARKET_DATA[0];
const requiredFields = [
  'id', 'name', 'category', 'icon', 'description', 'stars',
  'repo_url', 'project_type', 'start_cmd', 'port', 'tags',
  'difficulty', 'estimated_time', 'last_updated'
];

requiredFields.forEach(field => {
  assert(sampleTemplate[field] !== undefined, `模板缺少必要字段: ${field}`);
});
console.log('✅ 模板结构完整\n');

// 测试3: 检查分类功能
console.log('🏷️ 测试3: 检查分类功能');
const categories = getAllCategories(TEMPLATE_MARKET_DATA);
console.log(`分类列表: ${categories.join(', ')}`);
assert(categories.length > 0, '应至少有一个分类');
console.log('✅ 分类功能正常\n');

// 测试4: 检查搜索功能
console.log('🔍 测试4: 检查搜索功能');
const searchResults = searchTemplates(TEMPLATE_MARKET_DATA, 'AI');
console.log(`搜索 "AI" 结果数: ${searchResults.length}`);
assert(searchResults.length > 0, '搜索功能应返回结果');
console.log('✅ 搜索功能正常\n');

// 测试5: 检查热门模板功能
console.log('🔥 测试5: 检查热门模板功能');
const popularTemplates = getPopularTemplates(TEMPLATE_MARKET_DATA, 3);
console.log(`热门模板数量: ${popularTemplates.length}`);
assert(popularTemplates.length === 3, '应返回指定数量的热门模板');
console.log('✅ 热门模板功能正常\n');

// 测试6: 检查每个模板的详细信息
console.log('📝 测试6: 检查每个模板的详细信息');
TEMPLATE_MARKET_DATA.forEach((template, index) => {
  console.log(`\n模板 ${index + 1}: ${template.name}`);
  console.log(`  • 分类: ${template.category}`);
  console.log(`  • 类型: ${template.project_type}`);
  console.log(`  • 难度: ${template.difficulty}`);
  console.log(`  • 端口: ${template.port}`);
  console.log(`  • 启动命令: ${template.start_cmd}`);
  
  // 验证关键字段
  assert(template.repo_url.startsWith('https://github.com/'), '仓库地址应为GitHub URL');
  assert(['简单', '中等', '困难'].includes(template.difficulty), '难度应为简单/中等/困难');
  assert(Number.isInteger(template.port) && template.port > 0, '端口应为正整数');
  assert(template.tags && Array.isArray(template.tags), '标签应为数组');
  assert(template.env_vars && Array.isArray(template.env_vars), '环境变量应为数组');
});
console.log('✅ 所有模板信息完整有效\n');

// 测试7: 检查环境变量配置
console.log('⚙️ 测试7: 检查环境变量配置');
TEMPLATE_MARKET_DATA.forEach(template => {
  template.env_vars.forEach(env => {
    assert(env.key, '环境变量应有key字段');
    assert(env.desc, '环境变量应有desc字段');
    assert(typeof env.required === 'boolean', '环境变量应有required字段');
  });
});
console.log('✅ 环境变量配置正确\n');

// 测试8: 检查部署步骤
console.log('🚀 测试8: 检查部署步骤');
TEMPLATE_MARKET_DATA.forEach(template => {
  if (template.setup_steps) {
    assert(Array.isArray(template.setup_steps), '部署步骤应为数组');
    template.setup_steps.forEach(step => {
      assert(step.cmd, '部署步骤应有cmd字段');
      assert(step.desc, '部署步骤应有desc字段');
    });
  }
});
console.log('✅ 部署步骤配置正确\n');

console.log('🎉 所有测试通过！');
console.log(`\n📋 测试总结:`);
console.log(`• 模板数量: ${TEMPLATE_MARKET_DATA.length}`);
console.log(`• 分类数量: ${categories.length}`);
console.log(`• 项目类型: ${[...new Set(TEMPLATE_MARKET_DATA.map(t => t.project_type))].join(', ')}`);
console.log(`• 难度分布: 简单(${TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '简单').length}), 中等(${TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '中等').length}), 困难(${TEMPLATE_MARKET_DATA.filter(t => t.difficulty === '困难').length})`);

// 输出热门模板推荐
console.log(`\n🌟 热门模板推荐:`);
getPopularTemplates(TEMPLATE_MARKET_DATA, 3).forEach((template, i) => {
  console.log(`${i + 1}. ${template.name} (⭐ ${template.stars}) - ${template.description}`);
});
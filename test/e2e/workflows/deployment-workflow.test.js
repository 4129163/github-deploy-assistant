const { test, expect } = require('@playwright/test');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

test.describe('Deployment Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到应用首页
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load homepage with correct title', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/GitHub Deploy Assistant/i);
    
    // 验证页面包含关键元素
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/deploy|assistant/i)).toBeVisible();
  });

  test('should display project list', async ({ page }) => {
    // 假设项目列表在页面上显示
    await expect(page.locator('.project-list, table, [data-testid="projects"]')).toBeVisible();
    
    // 验证至少有一个项目显示
    const projectItems = page.locator('.project-item, tr, [data-testid^="project-"]');
    await expect(projectItems.first()).toBeVisible();
  });

  test('should navigate to deployment page', async ({ page }) => {
    // 点击部署按钮或链接
    const deployButton = page.locator('button:has-text("Deploy"), a:has-text("Deploy"), [data-testid="deploy-button"]').first();
    await deployButton.click();
    
    // 验证导航到部署页面
    await expect(page).toHaveURL(/deploy|new/);
    await expect(page.locator('h1, h2').filter({ hasText: /deploy|new project/i })).toBeVisible();
  });

  test('should fill deployment form', async ({ page }) => {
    // 导航到部署页面
    await page.goto('/deploy');
    await page.waitForLoadState('networkidle');
    
    // 填写表单
    const repoUrl = 'https://github.com/example/test-repo.git';
    await page.fill('input[name="repoUrl"], [data-testid="repo-url"]', repoUrl);
    
    // 选择分支
    await page.fill('input[name="branch"], [data-testid="branch"]', 'main');
    
    // 填写目标路径
    const targetPath = '/tmp/test-deployment-e2e';
    await page.fill('input[name="targetPath"], [data-testid="target-path"]', targetPath);
    
    // 选择项目类型
    const typeSelect = page.locator('select[name="type"], [data-testid="project-type"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption({ label: /node|react/i });
    }
    
    // 验证表单值
    const repoUrlValue = await page.inputValue('input[name="repoUrl"], [data-testid="repo-url"]');
    expect(repoUrlValue).toBe(repoUrl);
  });

  test('should submit deployment form', async ({ page }) => {
    // 导航到部署页面
    await page.goto('/deploy');
    await page.waitForLoadState('networkidle');
    
    // 填写必填字段
    await page.fill('input[name="repoUrl"], [data-testid="repo-url"]', 'https://github.com/example/test-repo.git');
    
    // 提交表单
    const submitButton = page.locator('button[type="submit"], button:has-text("Deploy"), [data-testid="submit-deploy"]');
    await submitButton.click();
    
    // 验证成功消息或重定向
    await expect(page.locator('.success-message, .alert-success, [data-testid="deploy-success"]')).toBeVisible({
      timeout: 10000
    });
  });

  test('should view project details', async ({ page }) => {
    // 导航到项目列表
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // 点击第一个项目查看详情
    const firstProject = page.locator('.project-item, tr, [data-testid^="project-"]').first();
    const viewButton = firstProject.locator('button:has-text("View"), a:has-text("Details"), [data-testid^="view-"]');
    
    if (await viewButton.isVisible()) {
      await viewButton.click();
    } else {
      await firstProject.click();
    }
    
    // 验证项目详情页面
    await expect(page).toHaveURL(/projects\/.+/);
    await expect(page.locator('.project-details, [data-testid="project-details"]')).toBeVisible();
    
    // 验证详情包含关键信息
    await expect(page.locator('.project-name, [data-testid="project-name"]')).toBeVisible();
    await expect(page.locator('.project-status, [data-testid="project-status"]')).toBeVisible();
  });

  test('should start and stop project', async ({ page }) => {
    // 导航到项目详情页面
    await page.goto('/projects/test-project-1');
    await page.waitForLoadState('networkidle');
    
    // 查找启动按钮
    const startButton = page.locator('button:has-text("Start"), [data-testid="start-project"]');
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // 验证状态变化
      await expect(page.locator('.status-running, [data-testid="status"]').filter({ hasText: /running/i })).toBeVisible({
        timeout: 5000
      });
      
      // 查找停止按钮
      const stopButton = page.locator('button:has-text("Stop"), [data-testid="stop-project"]');
      await stopButton.click();
      
      // 验证状态变化
      await expect(page.locator('.status-stopped, [data-testid="status"]').filter({ hasText: /stopped/i })).toBeVisible({
        timeout: 5000
      });
    }
  });

  test('should display deployment logs', async ({ page }) => {
    // 导航到部署日志页面
    await page.goto('/deployments/logs');
    await page.waitForLoadState('networkidle');
    
    // 验证日志容器存在
    const logsContainer = page.locator('.logs-container, [data-testid="deployment-logs"], pre, code');
    await expect(logsContainer).toBeVisible();
    
    // 验证可以刷新日志
    const refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh-logs"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should handle deployment errors gracefully', async ({ page }) => {
    // 导航到部署页面
    await page.goto('/deploy');
    await page.waitForLoadState('networkidle');
    
    // 提交空表单
    const submitButton = page.locator('button[type="submit"], button:has-text("Deploy"), [data-testid="submit-deploy"]');
    await submitButton.click();
    
    // 验证错误消息显示
    const errorMessage = page.locator('.error-message, .alert-danger, [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({
      timeout: 3000
    });
  });

  test('should search and filter projects', async ({ page }) => {
    // 导航到项目列表
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // 查找搜索框
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], [data-testid="search-projects"]');
    if (await searchInput.isVisible()) {
      // 输入搜索词
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // 验证搜索结果
      const searchResults = page.locator('.project-item, tr, [data-testid^="project-"]');
      await expect(searchResults).toBeVisible();
      
      // 清除搜索
      await searchInput.clear();
      await page.waitForTimeout(1000);
    }
  });
});
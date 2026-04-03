/**
 * GitHub 仓库解析服务
 */

const axios = require('axios');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

const { WORK_DIR } = require('../config');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Axios 配置
const githubAxios = axios.create({
  headers: GITHUB_TOKEN ? {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  } : {
    'Accept': 'application/vnd.github.v3+json'
  },
  timeout: 30000
});

/**
 * 解析 GitHub URL
 */
function parseGitHubUrl(url) {
  // 支持的格式：
  // https://github.com/username/repo
  // https://github.com/username/repo.git
  // github.com/username/repo
  
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    /github\.com\/([^\/]+)\/([^\/]+?)\/.*$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`
      };
    }
  }
  
  return null;
}

/**
 * 获取仓库基本信息
 */
async function getRepoInfo(owner, repo) {
  try {
    const response = await githubAxios.get(
      `https://api.github.com/repos/${owner}/${repo}`
    );
    
    return {
      name: response.data.name,
      fullName: response.data.full_name,
      description: response.data.description,
      url: response.data.html_url,
      cloneUrl: response.data.clone_url,
      sshUrl: response.data.ssh_url,
      defaultBranch: response.data.default_branch,
      language: response.data.language,
      stars: response.data.stargazers_count,
      forks: response.data.forks_count,
      topics: response.data.topics,
      createdAt: response.data.created_at,
      updatedAt: response.data.updated_at,
      isPrivate: response.data.private
    };
  } catch (error) {
    logger.error(`Failed to get repo info: ${error.message}`);
    throw new Error(`Failed to fetch repository info: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * 获取仓库文件列表
 */
async function getRepoContents(owner, repo, path = '') {
  try {
    const response = await githubAxios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    );
    
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    logger.error(`Failed to get repo contents: ${error.message}`);
    return [];
  }
}

/**
 * 获取文件内容
 */
async function getFileContent(owner, repo, path) {
  try {
    const response = await githubAxios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    );
    
    if (response.data.content) {
      return Buffer.from(response.data.content, 'base64').toString('utf8');
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to get file content: ${error.message}`);
    return null;
  }
}

/**
 * 检测项目类型
 */
async function detectProjectType(owner, repo, files) {
  const fileNames = files.map(f => f.name.toLowerCase());
  
  const types = [];
  
  // Node.js 项目
  if (fileNames.includes('package.json')) {
    types.push('nodejs');
    // 检测前端框架
    try {
      const pkgContent = await getFileContent(owner, repo, 'package.json');
      if (pkgContent) {
        if (pkgContent.includes('"vue"')) types.push('vue');
        if (pkgContent.includes('"react"')) types.push('react');
        if (pkgContent.includes('"next"')) types.push('nextjs');
        if (pkgContent.includes('"nuxt"')) types.push('nuxtjs');
        if (pkgContent.includes('"vite"')) types.push('vite');
        if (pkgContent.includes('"webpack"')) types.push('webpack');
      }
    } catch (_) {}
  }
  
  // Python 项目
  if (fileNames.includes('requirements.txt') || 
      fileNames.includes('setup.py') || 
      fileNames.includes('pyproject.toml') ||
      fileNames.includes('pipfile')) {
    types.push('python');
    // 检测Python框架
    try {
      const reqContent = await getFileContent(owner, repo, 'requirements.txt') || '';
      if (reqContent.includes('django') || fileNames.includes('manage.py')) types.push('django');
      if (reqContent.includes('flask') || reqContent.includes('fastapi')) types.push('python-web');
      if (reqContent.includes('torch') || reqContent.includes('tensorflow')) types.push('ai-model');
    } catch (_) {}
  }
  
  // Go 项目
  if (fileNames.includes('go.mod')) {
    types.push('go');
    try {
      const modContent = await getFileContent(owner, repo, 'go.mod') || '';
      if (modContent.includes('gin') || modContent.includes('echo') || modContent.includes('fiber')) types.push('go-web');
    } catch (_) {}
  }
  
  // Rust 项目
  if (fileNames.includes('cargo.toml')) {
    types.push('rust');
    try {
      const cargoContent = await getFileContent(owner, repo, 'Cargo.toml') || '';
      if (cargoContent.includes('actix-web') || cargoContent.includes('rocket') || cargoContent.includes('axum')) types.push('rust-web');
    } catch (_) {}
  }
  
  // Java 项目
  if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) {
    types.push('java');
    try {
      const pomContent = fileNames.includes('pom.xml') ? (await getFileContent(owner, repo, 'pom.xml') || '') : '';
      const gradleContent = fileNames.includes('build.gradle') ? (await getFileContent(owner, repo, 'build.gradle') || '') : '';
      if (pomContent.includes('spring-boot') || gradleContent.includes('spring-boot')) types.push('springboot');
    } catch (_) {}
  }
  
  // PHP 项目
  if (fileNames.includes('composer.json') || fileNames.includes('index.php') || fileNames.includes('laravel')) {
    types.push('php');
    try {
      const composerContent = fileNames.includes('composer.json') ? (await getFileContent(owner, repo, 'composer.json') || '') : '';
      if (composerContent.includes('laravel') || fileNames.includes('artisan')) types.push('laravel');
    } catch (_) {}
  }
  
  // .NET 项目
  if (fileNames.some(f => f.endsWith('.csproj') || f.endsWith('.sln')) || fileNames.includes('dotnet.json')) {
    types.push('dotnet');
    try {
      const csprojFile = fileNames.find(f => f.endsWith('.csproj'));
      const csprojContent = csprojFile ? (await getFileContent(owner, repo, csprojFile) || '') : '';
      if (csprojContent.includes('Microsoft.AspNetCore')) types.push('aspnetcore');
    } catch (_) {}
  }
  
  // Docker 项目
  if (fileNames.includes('dockerfile') || fileNames.includes('docker-compose.yml') || fileNames.includes('docker-compose.yaml')) {
    types.push('docker');
  }
  
  // 静态网站
  if (fileNames.includes('index.html') && !types.includes('vue') && !types.includes('react')) {
    types.push('static');
  }
  
  // 爬虫项目
  if (fileNames.includes('scrapy.cfg') || fileNames.includes('spider') || fileNames.includes('crawler')) {
    types.push('crawler');
  }
  
  return types.length > 0 ? types : ['unknown'];
}

/**
 * 解析 package.json
 */
async function parsePackageJson(owner, repo) {
  try {
    const content = await getFileContent(owner, repo, 'package.json');
    if (!content) return null;
    
    const pkg = JSON.parse(content);
    
    return {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      main: pkg.main,
      scripts: pkg.scripts,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
      engines: pkg.engines,
      nodeVersion: pkg.engines?.node
    };
  } catch (error) {
    logger.error(`Failed to parse package.json: ${error.message}`);
    return null;
  }
}

/**
 * 解析 requirements.txt
 */
async function parseRequirementsTxt(owner, repo) {
  try {
    const content = await getFileContent(owner, repo, 'requirements.txt');
    if (!content) return null;
    
    const dependencies = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    return { dependencies };
  } catch (error) {
    return null;
  }
}

/**
 * 解析 README
 */
async function parseReadme(owner, repo) {
  const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
  
  for (const filename of readmeFiles) {
    const content = await getFileContent(owner, repo, filename);
    if (content) {
      return {
        filename,
        content: content.substring(0, 10000) // 限制长度
      };
    }
  }
  
  return null;
}

/**
 * 解析 Dockerfile
 */
async function parseDockerfile(owner, repo) {
  try {
    const content = await getFileContent(owner, repo, 'Dockerfile');
    if (!content) return null;
    
    // 提取基础镜像
    const fromMatch = content.match(/FROM\s+([^\s]+)/);
    
    return {
      baseImage: fromMatch ? fromMatch[1] : null,
      content: content.substring(0, 5000)
    };
  } catch (error) {
    return null;
  }
}

/**
 * 解析 .env.example
 */
async function parseEnvExample(owner, repo) {
  try {
    const content = await getFileContent(owner, repo, '.env.example');
    if (!content) return null;
    
    const envVars = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        return {
          key: key.trim(),
          value: valueParts.join('=').trim(),
          description: ''
        };
      });
    
    return { variables: envVars };
  } catch (error) {
    return null;
  }
}

/**
 * 完整分析仓库
 */
async function analyzeRepository(url) {
  const parsed = parseGitHubUrl(url);
  
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }
  
  logger.info(`Analyzing repository: ${parsed.fullName}`);
  
  // 获取基本信息
  const repoInfo = await getRepoInfo(parsed.owner, parsed.repo);
  
  // 获取根目录文件
  const rootFiles = await getRepoContents(parsed.owner, parsed.repo);
  
  // 检测项目类型
  const projectTypes = await detectProjectType(parsed.owner, parsed.repo, rootFiles);
  
  // 解析配置文件
  const packageJson = projectTypes.includes('nodejs') 
    ? await parsePackageJson(parsed.owner, parsed.repo) 
    : null;
  
  const requirements = projectTypes.includes('python')
    ? await parseRequirementsTxt(parsed.owner, parsed.repo)
    : null;
  
  const readme = await parseReadme(parsed.owner, parsed.repo);
  const dockerfile = await parseDockerfile(parsed.owner, parsed.repo);
  const envExample = await parseEnvExample(parsed.owner, parsed.repo);
  
  // 收集所有配置信息
  const analysis = {
    url,
    parsed,
    info: repoInfo,
    types: projectTypes,
    files: rootFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
    packageJson,
    requirements,
    readme,
    dockerfile,
    envExample,
    analyzedAt: new Date().toISOString()
  };
  
  logger.info(`Repository analysis complete: ${parsed.fullName}`);
  
  return analysis;
}

const { getBestCloneStrategy } = require('./clone-optimizer');

/**
 * 克隆仓库到本地 (带智能网络优化)
 */
async function cloneRepository(url, targetPath) {
  try {
    await fs.ensureDir(targetPath);
    
    // 自动选择最快的下载路径
    const strategy = await getBestCloneStrategy(url);
    logger.info(`Using clone strategy: ${strategy.mode}`);
    if (global.broadcastLog) global.broadcastLog('system', `🌐 网络诊断：${strategy.note}`);

    // 手动模式：无法自动克隆，提示用户上传
    if (strategy.mode === 'manual') {
      throw new Error(strategy.note);
    }

    const timeoutMs = parseInt(process.env.CLONE_TIMEOUT_MS, 10) || 300000; // 5分钟
    const git = simpleGit({ timeout: { block: timeoutMs } });

    await git.clone(strategy.url, targetPath, ['--depth', '1']);

    logger.info('Clone complete');
    return targetPath;
  } catch (error) {
    // 克隆失败时清理残留目录
    try { await fs.remove(targetPath); } catch (_) {}
    logger.error(`Clone failed: ${error.message}`);
    
    // 如果是网络相关错误，提示手动上传选项
    if (error.message.includes('无法访问') || error.message.includes('timed out') || error.message.includes('timeout')) {
      throw new Error(`${error.message}。也可以选择手动上传项目压缩包进行部署。`);
    }
    
    throw new Error(`克隆仓库失败: ${error.message}。请检查网络或仓库地址是否正确，或尝试手动上传。`);
  }
}

/**
 * 获取本地项目信息
 */
async function getLocalProjectInfo(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const readmePath = path.join(projectPath, 'README.md');
    
    const info = {
      hasPackageJson: await fs.pathExists(packageJsonPath),
      hasRequirements: await fs.pathExists(requirementsPath),
      hasReadme: await fs.pathExists(readmePath),
      files: [],
      types: []
    };
    
    // 列出文件
    const files = await fs.readdir(projectPath);
    info.files = files;
    const fileNames = files.map(f => f.toLowerCase());
    
    // 本地项目类型检测
    const types = [];
    // Node.js
    if (fileNames.includes('package.json')) {
      types.push('nodejs');
      const pkg = await fs.readJson(packageJsonPath);
      info.packageJson = pkg;
      const depStr = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies } || {});
      if (depStr.includes('vue')) types.push('vue');
      if (depStr.includes('react')) types.push('react');
      if (depStr.includes('next')) types.push('nextjs');
      if (depStr.includes('nuxt')) types.push('nuxtjs');
    }
    // Python
    if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py') || fileNames.includes('pyproject.toml') || fileNames.includes('pipfile')) {
      types.push('python');
      if (fileNames.includes('requirements.txt')) {
        const req = await fs.readFile(requirementsPath, 'utf8');
        info.requirements = req.split('\n').filter(l => l.trim());
        if (req.includes('django') || fileNames.includes('manage.py')) types.push('django');
        if (req.includes('flask') || req.includes('fastapi')) types.push('python-web');
        if (req.includes('torch') || req.includes('tensorflow')) types.push('ai-model');
      }
    }
    // Go
    if (fileNames.includes('go.mod')) types.push('go');
    // Rust
    if (fileNames.includes('cargo.toml')) types.push('rust');
    // Java
    if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) types.push('java');
    // PHP
    if (fileNames.includes('composer.json') || fileNames.includes('index.php')) types.push('php');
    // .NET
    if (fileNames.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) types.push('dotnet');
    // Docker
    if (fileNames.includes('dockerfile') || fileNames.includes('docker-compose.yml') || fileNames.includes('docker-compose.yaml')) types.push('docker');
    // 静态网站
    if (fileNames.includes('index.html') && !types.includes('vue') && !types.includes('react')) types.push('static');
    // 爬虫项目
    if (fileNames.includes('scrapy.cfg') || fileNames.includes('spider') || fileNames.includes('crawler')) types.push('crawler');
    
    info.types = types.length > 0 ? types : ['unknown'];
    
    if (info.hasReadme) {
      info.readme = await fs.readFile(readmePath, 'utf8');
    }
    
    return info;
  } catch (error) {
    logger.error(`Get local info failed: ${error.message}`);
    return null;
  }
}

/**
 * 精细化下载策略 (参考 Dgit / Sparse-Checkout)
 * 仅下载指定的子目录，节省流量和时间
 */
async function partialCloneRepository(url, targetPath, subDir) {
  const simpleGit = require('simple-git');
  const git = simpleGit();
  try {
    await fs.ensureDir(targetPath);
    await git.init();
    await git.addRemote('origin', url);
    await git.raw(['config', 'core.sparseCheckout', 'true']);
    await fs.writeFile(path.join(targetPath, '.git/info/sparse-checkout'), subDir);
    await git.pull('origin', 'main', ['--depth', '1']);
    return targetPath;
  } catch (e) {
    throw new Error(`精细化下载失败: ${e.message}`);
  }
}

module.exports = { ...module.exports, partialCloneRepository };

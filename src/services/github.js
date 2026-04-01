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
  }
  
  // Python 项目
  if (fileNames.includes('requirements.txt') || 
      fileNames.includes('setup.py') || 
      fileNames.includes('pyproject.toml') ||
      fileNames.includes('pipfile')) {
    types.push('python');
  }
  
  // Go 项目
  if (fileNames.includes('go.mod')) {
    types.push('go');
  }
  
  // Rust 项目
  if (fileNames.includes('cargo.toml')) {
    types.push('rust');
  }
  
  // Java 项目
  if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) {
    types.push('java');
  }
  
  // Docker 项目
  if (fileNames.includes('dockerfile') || fileNames.includes('docker-compose.yml')) {
    types.push('docker');
  }
  
  // 静态网站
  if (fileNames.includes('index.html')) {
    types.push('static');
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
    logger.info(`Using clone strategy: ${strategy.mode} - ${strategy.url}`);
    if (global.broadcastLog) global.broadcastLog('system', `🌐 网络诊断：${strategy.note}`);

    const timeoutMs = parseInt(process.env.CLONE_TIMEOUT_MS, 10) || 300000; // 5分钟
    const git = simpleGit({ timeout: { block: timeoutMs } });

    await git.clone(strategy.url, targetPath, ['--depth', '1']);

    logger.info('Clone complete');
    return targetPath;
  } catch (error) {
    // 克隆失败时清理残留目录
    try { await fs.remove(targetPath); } catch (_) {}
    logger.error(`Clone failed: ${error.message}`);
    throw new Error(`克隆仓库失败: ${error.message}。请检查网络或仓库地址是否正确。`);
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
      files: []
    };
    
    if (info.hasPackageJson) {
      const pkg = await fs.readJson(packageJsonPath);
      info.packageJson = pkg;
    }
    
    if (info.hasRequirements) {
      const req = await fs.readFile(requirementsPath, 'utf8');
      info.requirements = req.split('\n').filter(l => l.trim());
    }
    
    // 列出文件
    const files = await fs.readdir(projectPath);
    info.files = files;
    
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

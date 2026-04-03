const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const { analyzeRepo } = require('../services/ai');
const BaseFileDetector = require('./detectors/BaseFileDetector');
const SecurityDetector = require('./detectors/SecurityDetector');
const DependencyDetector = require('./detectors/DependencyDetector');

class RepoAnalyzer {
  constructor() {
    this.detectors = [
      new BaseFileDetector(),
      new SecurityDetector(),
      new DependencyDetector()
    ];
  }

  /**
   * 解析本地仓库
   * @param {string} repoPath 本地仓库路径
   * @param {string} repoUrl 可选，仓库远程地址
   * @returns {Promise<Object>} 解析结果
   */
  async analyze(repoPath, repoUrl = '') {
    const result = {
      repoUrl,
      repoName: path.basename(repoPath),
      analyzeTime: new Date().toISOString(),
      basicInfo: {},
      features: [],
      detectedIssues: [],
      predictedProblems: [],
      aiAnalysis: {}
    };

    // 1. 获取基础信息
    result.basicInfo = await this.getBasicInfo(repoPath, repoUrl);

    // 2. 运行所有检测器获取现有问题
    for (const detector of this.detectors) {
      try {
        const issues = await detector.detect(repoPath, result.basicInfo);
        result.detectedIssues.push(...issues);
      } catch (e) {
        console.error(`检测器${detector.name}运行失败:`, e.message);
      }
    }

    // 3. 调用AI分析获取功能列表、预测问题和解决方案
    try {
      const aiResult = await analyzeRepo(repoPath);
      result.features = aiResult.features || [];
      result.predictedProblems = aiResult.predictedProblems || [];
      result.aiAnalysis = aiResult;
    } catch (e) {
      console.error('AI分析失败:', e.message);
    }

    // 4. 保存分析结果到数据库
    await this.saveAnalysisResult(result);

    return result;
  }

  /**
   * 获取仓库基础信息
   */
  async getBasicInfo(repoPath, repoUrl) {
    const info = {
      path: repoPath,
      url: repoUrl,
      language: 'unknown',
      projectType: 'unknown',
      lastUpdate: null,
      commitCount: 0,
      contributors: []
    };

    // 识别项目类型
    const files = await fs.readdir(repoPath);
    if (files.includes('package.json')) info.language = 'JavaScript/Node.js';
    else if (files.includes('requirements.txt') || files.includes('setup.py')) info.language = 'Python';
    else if (files.includes('pom.xml')) info.language = 'Java';
    else if (files.includes('go.mod')) info.language = 'Go';
    else if (files.includes('composer.json')) info.language = 'PHP';

    // 获取Git信息
    try {
      const git = simpleGit(repoPath);
      const isRepo = await git.checkIsRepo();
      if (isRepo) {
        const log = await git.log(['-n', '1']);
        info.lastUpdate = log.latest?.date || null;
        const commitCount = await git.raw(['rev-list', '--count', 'HEAD']);
        info.commitCount = parseInt(commitCount.trim()) || 0;
        const contributors = await git.raw(['shortlog', '-sne', 'HEAD']);
        info.contributors = contributors.split('\\n').filter(Boolean).map(line => line.trim().split('\\t')[1]);
      }
    } catch (e) {}

    return info;
  }

  /**
   * 保存分析结果到数据库
   */
  async saveAnalysisResult(result) {
    try {
      const { ProjectDB } = require('../services/database');
      // 检查是否已有对应的项目记录
      const existingProject = await ProjectDB.findByUrl(result.repoUrl) || await ProjectDB.findByPath(result.basicInfo.path);
      if (existingProject) {
        // 更新现有项目的分析结果
        await ProjectDB.update(existingProject.id, {
          analysis_result: JSON.stringify(result),
          updated_at: new Date().toISOString()
        });
      } else {
        // 创建新的项目记录
        await ProjectDB.create({
          name: result.repoName,
          url: result.repoUrl,
          local_path: result.basicInfo.path,
          project_type: result.basicInfo.projectType,
          analysis_result: JSON.stringify(result),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('保存分析结果失败:', e.message);
    }
  }

  /**
   * 获取历史分析记录
   * @param {string} repoUrl 仓库地址
   * @param {string} repoPath 本地路径
   * @returns {Promise<Object|null>} 历史分析结果
   */
  async getHistory(repoUrl = '', repoPath = '') {
    try {
      const { ProjectDB } = require('../services/database');
      const project = await ProjectDB.findByUrl(repoUrl) || await ProjectDB.findByPath(repoPath);
      if (project && project.analysis_result) {
        return JSON.parse(project.analysis_result);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

module.exports = RepoAnalyzer;

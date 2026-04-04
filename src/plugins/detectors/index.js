/**
 * 内置检测器插件导出
 */

const NodejsDetector = require('./NodejsDetector');
const PythonDetector = require('./PythonDetector');
const RustDetector = require('./RustDetector');
const JavaDetector = require('./JavaDetector');
const GoDetector = require('./GoDetector');
const DockerDetector = require('./DockerDetector');

// 内置检测器映射表
const builtinDetectors = {
  'nodejs': NodejsDetector,
  'python': PythonDetector,
  'rust': RustDetector,
  'java': JavaDetector,
  'go': GoDetector,
  'docker': DockerDetector
};

// 检测器工厂函数
function createDetector(type, options = {}) {
  if (!builtinDetectors[type]) {
    throw new Error(`未知的检测器类型: ${type}`);
  }
  
  const DetectorClass = builtinDetectors[type];
  const detector = new DetectorClass();
  
  // 应用选项
  if (options.priority !== undefined) {
    detector.setPriority(options.priority);
  }
  
  return detector;
}

// 获取所有内置检测器类型
function getBuiltinDetectorTypes() {
  return Object.keys(builtinDetectors);
}

// 获取检测器信息
function getDetectorInfo(type) {
  if (!builtinDetectors[type]) {
    return null;
  }
  
  const detector = new builtinDetectors[type]();
  return {
    type,
    name: detector.name,
    version: detector.version,
    description: detector.description,
    supportedTypes: detector.getSupportedTypes(),
    priority: detector.getPriority(),
    timeout: detector.getTimeout()
  };
}

// 获取所有检测器信息
function getAllDetectorInfo() {
  const infos = [];
  for (const type of getBuiltinDetectorTypes()) {
    const info = getDetectorInfo(type);
    if (info) {
      infos.push(info);
    }
  }
  return infos;
}

// 根据文件特征推荐检测器
function recommendDetectors(files) {
  const recommendations = [];
  
  // 分析文件特征
  const fileNames = files.map(f => f.name || f.path.split('/').pop());
  
  // 检查Node.js特征
  if (fileNames.includes('package.json')) {
    recommendations.push({
      type: 'nodejs',
      confidence: 0.9,
      reason: '检测到package.json文件'
    });
  }
  
  // 检查Python特征
  if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) {
    recommendations.push({
      type: 'python',
      confidence: 0.8,
      reason: '检测到Python依赖文件'
    });
  }
  
  // 检查Rust特征
  if (fileNames.includes('Cargo.toml')) {
    recommendations.push({
      type: 'rust',
      confidence: 0.9,
      reason: '检测到Cargo.toml文件'
    });
  }
  
  // 检查Java特征
  if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) {
    recommendations.push({
      type: 'java',
      confidence: 0.85,
      reason: '检测到Java构建文件'
    });
  }
  
  // 检查Go特征
  if (fileNames.includes('go.mod')) {
    recommendations.push({
      type: 'go',
      confidence: 0.9,
      reason: '检测到go.mod文件'
    });
  }
  
  // 检查Docker特征
  if (fileNames.some(name => 
    name.toLowerCase() === 'dockerfile' || 
    name.toLowerCase().includes('docker-compose')
  )) {
    recommendations.push({
      type: 'docker',
      confidence: 0.95,
      reason: '检测到Docker配置文件'
    });
  }
  
  // 按置信度排序
  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  // 检测器类
  NodejsDetector,
  PythonDetector,
  RustDetector,
  JavaDetector,
  GoDetector,
  DockerDetector,
  
  // 内置检测器映射
  builtinDetectors,
  
  // 工具函数
  createDetector,
  getBuiltinDetectorTypes,
  getDetectorInfo,
  getAllDetectorInfo,
  recommendDetectors
};
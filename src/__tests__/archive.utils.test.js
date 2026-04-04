const fs = require('fs-extra');
const path = require('path');
const { compress, decompress } = require('../utils/archive');

describe('Archive Utilities', () => {
  const testDir = path.join(__dirname, '../../test-archive-temp');
  const sourceDir = path.join(testDir, 'source');
  const destDir = path.join(testDir, 'dest');
  const archivePath = path.join(testDir, 'archive');

  beforeAll(async () => {
    await fs.ensureDir(sourceDir);
    await fs.ensureDir(destDir);
    
    // 创建测试文件
    await fs.writeFile(path.join(sourceDir, 'test1.txt'), 'Hello World 1');
    await fs.writeFile(path.join(sourceDir, 'test2.txt'), 'Hello World 2');
    await fs.writeFile(path.join(sourceDir, 'test3.txt'), 'Hello World 3');
    
    // 创建子目录和文件
    const subDir = path.join(sourceDir, 'subdir');
    await fs.ensureDir(subDir);
    await fs.writeFile(path.join(subDir, 'nested.txt'), 'Nested content');
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  test('compress should create archive file', async () => {
    const result = await compress(sourceDir, `${archivePath}.tar.gz`);
    
    expect(result.success).toBe(true);
    expect(result.format).toBeDefined();
    expect(result.size).toBeGreaterThan(0);
    
    const exists = await fs.pathExists(`${archivePath}.tar.gz`);
    expect(exists).toBe(true);
  });

  test('compress should support zip format', async () => {
    const result = await compress(sourceDir, `${archivePath}.zip`);
    
    expect(result.success).toBe(true);
    expect(result.format).toBe('zip');
    expect(result.size).toBeGreaterThan(0);
    
    const exists = await fs.pathExists(`${archivePath}.zip`);
    expect(exists).toBe(true);
  });

  test('decompress should extract files correctly', async () => {
    // 先压缩
    await compress(sourceDir, `${archivePath}.tar.gz`);
    
    // 解压到新目录
    const extractDir = path.join(testDir, 'extracted');
    const result = await decompress(`${archivePath}.tar.gz`, extractDir);
    
    expect(result.success).toBe(true);
    expect(result.extractedFiles).toBeGreaterThan(0);
    
    // 验证文件被正确解压
    const test1Path = path.join(extractDir, 'test1.txt');
    const exists = await fs.pathExists(test1Path);
    expect(exists).toBe(true);
    
    const content = await fs.readFile(test1Path, 'utf8');
    expect(content).toBe('Hello World 1');
  });

  test('compress should handle empty directory', async () => {
    const emptyDir = path.join(testDir, 'empty');
    await fs.ensureDir(emptyDir);
    
    const result = await compress(emptyDir, `${archivePath}-empty.tar.gz`);
    
    expect(result.success).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  test('decompress should handle non-existent file', async () => {
    const result = await decompress('non-existent-file.tar.gz', destDir);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('compress should handle non-existent source directory', async () => {
    const result = await compress('non-existent-dir', `${archivePath}-error.tar.gz`);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
/**
 * 安全存储管理器
 * 使用AES-256-GCM加密存储敏感信息
 */

const cryptoUtils = require('./crypto-utils');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SecureStorage {
  constructor() {
    this.storageDir = this.getStorageDirectory();
    this.vaultFile = path.join(this.storageDir, 'vault.enc');
    this.metaFile = path.join(this.storageDir, 'metadata.json');
    this.masterKeyFile = path.join(this.storageDir, 'master.key');
    this.attempts = {};
    this.maxAttempts = 5;
    this.lockDuration = 15 * 60 * 1000; // 15分钟锁定
    
    // 确保存储目录存在
    this.ensureStorageDirectory();
  }

  /**
   * 获取存储目录
   * @returns {string} - 存储目录路径
   */
  getStorageDirectory() {
    const platform = os.platform();
    let baseDir;
    
    if (platform === 'win32') {
      // Windows: AppData/Roaming/.gada/secure
      baseDir = path.join(os.homedir(), 'AppData', 'Roaming', '.gada', 'secure');
    } else if (platform === 'darwin') {
      // macOS: ~/.gada/secure
      baseDir = path.join(os.homedir(), '.gada', 'secure');
    } else {
      // Linux/Unix: ~/.gada/secure
      baseDir = path.join(os.homedir(), '.gada', 'secure');
    }
    
    return baseDir;
  }

  /**
   * 确保存储目录存在
   */
  ensureStorageDirectory() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirpSync(this.storageDir);
      // 设置目录权限（仅所有者可访问）
      fs.chmodSync(this.storageDir, 0o700);
    }
  }

  /**
   * 检查是否被锁定
   * @param {string} key - 密钥标识
   * @returns {boolean} - 是否被锁定
   */
  isLocked(key) {
    if (!this.attempts[key]) {
      return false;
    }
    
    const { count, lastAttempt } = this.attempts[key];
    
    if (count >= this.maxAttempts) {
      const timeSinceLastAttempt = Date.now() - lastAttempt;
      if (timeSinceLastAttempt < this.lockDuration) {
        return true;
      } else {
        // 锁定时间已过，重置计数器
        delete this.attempts[key];
        return false;
      }
    }
    
    return false;
  }

  /**
   * 记录尝试次数
   * @param {string} key - 密钥标识
   * @param {boolean} success - 是否成功
   */
  recordAttempt(key, success) {
    if (!this.attempts[key]) {
      this.attempts[key] = {
        count: 0,
        lastAttempt: Date.now(),
        lockStart: null
      };
    }
    
    if (success) {
      // 成功时重置计数器
      delete this.attempts[key];
    } else {
      // 失败时增加计数器
      this.attempts[key].count++;
      this.attempts[key].lastAttempt = Date.now();
      
      if (this.attempts[key].count >= this.maxAttempts) {
        this.attempts[key].lockStart = Date.now();
        console.warn(`安全存储被锁定: ${key}, 将在15分钟后解锁`);
      }
    }
  }

  /**
   * 初始化存储（首次使用）
   * @param {string} masterPassword - 主密码
   * @returns {boolean} - 是否初始化成功
   */
  async initialize(masterPassword) {
    if (this.isInitialized()) {
      throw new Error('安全存储已初始化');
    }
    
    // 生成主密钥
    const masterKeyInfo = cryptoUtils.generateMasterKey(this.masterKeyFile, masterPassword);
    
    // 创建空的元数据文件
    const metadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      items: {},
      keyDerivation: {
        algorithm: 'PBKDF2',
        iterations: 100000,
        keyLength: 32,
        digest: 'sha256'
      }
    };
    
    // 加密并保存元数据
    const encryptedMetadata = cryptoUtils.encryptObject(metadata, masterKeyInfo.masterKey);
    await fs.writeJson(this.metaFile, {
      encrypted: encryptedMetadata,
      salt: masterKeyInfo.salt
    }, { spaces: 2 });
    
    // 创建空的保险库
    const emptyVault = {
      data: {},
      checksum: cryptoUtils.hash('{}')
    };
    
    const encryptedVault = cryptoUtils.encryptObject(emptyVault, masterKeyInfo.masterKey);
    await fs.writeJson(this.vaultFile, encryptedVault, { spaces: 2 });
    
    console.log('安全存储初始化成功');
    return true;
  }

  /**
   * 检查是否已初始化
   * @returns {boolean} - 是否已初始化
   */
  isInitialized() {
    return fs.existsSync(this.masterKeyFile) && 
           fs.existsSync(this.metaFile) && 
           fs.existsSync(this.vaultFile);
  }

  /**
   * 解锁安全存储
   * @param {string} masterPassword - 主密码
   * @returns {string} - 主密钥
   */
  async unlock(masterPassword) {
    const key = 'unlock';
    
    if (this.isLocked(key)) {
      throw new Error('安全存储已被锁定，请15分钟后再试');
    }
    
    try {
      const masterKey = cryptoUtils.loadMasterKey(this.masterKeyFile, masterPassword);
      this.recordAttempt(key, true);
      return masterKey;
    } catch (error) {
      this.recordAttempt(key, false);
      throw new Error('主密码错误或密钥文件损坏');
    }
  }

  /**
   * 保存敏感信息
   * @param {string} key - 存储键名
   * @param {string} value - 要存储的值
   * @param {string} masterPassword - 主密码
   * @param {Object} metadata - 元数据（可选）
   * @returns {boolean} - 是否保存成功
   */
  async save(key, value, masterPassword, metadata = {}) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化，请先调用initialize()');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 加载保险库
    const encryptedVault = await fs.readJson(this.vaultFile);
    const vault = cryptoUtils.decryptObject(encryptedVault, masterKey);
    
    // 加载元数据
    const metaData = await fs.readJson(this.metaFile);
    const metadataObj = cryptoUtils.decryptObject(metaData.encrypted, masterKey);
    
    // 保存数据到保险库
    vault.data[key] = {
      value,
      encryptedAt: new Date().toISOString(),
      metadata: {
        ...metadata,
        description: metadata.description || '',
        tags: metadata.tags || [],
        expiresAt: metadata.expiresAt || null
      }
    };
    
    // 更新校验和
    vault.checksum = cryptoUtils.hash(JSON.stringify(vault.data));
    
    // 更新元数据
    metadataObj.items[key] = {
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
      size: Buffer.byteLength(value, 'utf8')
    };
    metadataObj.lastModified = new Date().toISOString();
    
    // 重新加密并保存
    const newEncryptedVault = cryptoUtils.encryptObject(vault, masterKey);
    const newEncryptedMetadata = cryptoUtils.encryptObject(metadataObj, masterKey);
    
    await fs.writeJson(this.vaultFile, newEncryptedVault, { spaces: 2 });
    await fs.writeJson(this.metaFile, {
      encrypted: newEncryptedMetadata,
      salt: metaData.salt
    }, { spaces: 2 });
    
    console.log(`敏感信息已安全存储: ${key}`);
    return true;
  }

  /**
   * 获取敏感信息
   * @param {string} key - 存储键名
   * @param {string} masterPassword - 主密码
   * @returns {Object} - 存储的值和元数据
   */
  async get(key, masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 加载保险库
    const encryptedVault = await fs.readJson(this.vaultFile);
    const vault = cryptoUtils.decryptObject(encryptedVault, masterKey);
    
    // 验证校验和
    const currentChecksum = cryptoUtils.hash(JSON.stringify(vault.data));
    if (currentChecksum !== vault.checksum) {
      throw new Error('保险库数据完整性校验失败，可能已被篡改');
    }
    
    if (!vault.data[key]) {
      throw new Error(`未找到存储项: ${key}`);
    }
    
    // 加载元数据
    const metaData = await fs.readJson(this.metaFile);
    const metadataObj = cryptoUtils.decryptObject(metaData.encrypted, masterKey);
    
    // 更新访问统计
    if (metadataObj.items[key]) {
      metadataObj.items[key].lastAccessed = new Date().toISOString();
      metadataObj.items[key].accessCount = (metadataObj.items[key].accessCount || 0) + 1;
      metadataObj.lastModified = new Date().toISOString();
      
      // 保存更新的元数据
      const newEncryptedMetadata = cryptoUtils.encryptObject(metadataObj, masterKey);
      await fs.writeJson(this.metaFile, {
        encrypted: newEncryptedMetadata,
        salt: metaData.salt
      }, { spaces: 2 });
    }
    
    return {
      value: vault.data[key].value,
      metadata: vault.data[key].metadata,
      storageInfo: metadataObj.items[key] || {}
    };
  }

  /**
   * 删除敏感信息
   * @param {string} key - 存储键名
   * @param {string} masterPassword - 主密码
   * @returns {boolean} - 是否删除成功
   */
  async delete(key, masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 加载保险库
    const encryptedVault = await fs.readJson(this.vaultFile);
    const vault = cryptoUtils.decryptObject(encryptedVault, masterKey);
    
    if (!vault.data[key]) {
      console.warn(`存储项不存在: ${key}`);
      return false;
    }
    
    // 从保险库中删除
    delete vault.data[key];
    vault.checksum = cryptoUtils.hash(JSON.stringify(vault.data));
    
    // 加载元数据
    const metaData = await fs.readJson(this.metaFile);
    const metadataObj = cryptoUtils.decryptObject(metaData.encrypted, masterKey);
    
    // 从元数据中删除
    delete metadataObj.items[key];
    metadataObj.lastModified = new Date().toISOString();
    
    // 重新加密并保存
    const newEncryptedVault = cryptoUtils.encryptObject(vault, masterKey);
    const newEncryptedMetadata = cryptoUtils.encryptObject(metadataObj, masterKey);
    
    await fs.writeJson(this.vaultFile, newEncryptedVault, { spaces: 2 });
    await fs.writeJson(this.metaFile, {
      encrypted: newEncryptedMetadata,
      salt: metaData.salt
    }, { spaces: 2 });
    
    console.log(`敏感信息已安全删除: ${key}`);
    return true;
  }

  /**
   * 列出所有存储项（仅元数据，不包含敏感值）
   * @param {string} masterPassword - 主密码
   * @returns {Array} - 存储项列表
   */
  async list(masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 加载元数据
    const metaData = await fs.readJson(this.metaFile);
    const metadataObj = cryptoUtils.decryptObject(metaData.encrypted, masterKey);
    
    // 加载保险库（仅获取元数据部分）
    const encryptedVault = await fs.readJson(this.vaultFile);
    const vault = cryptoUtils.decryptObject(encryptedVault, masterKey);
    
    const items = [];
    for (const [key, metadata] of Object.entries(metadataObj.items)) {
      if (vault.data[key]) {
        items.push({
          key,
          createdAt: metadata.createdAt,
          lastAccessed: metadata.lastAccessed,
          accessCount: metadata.accessCount,
          size: metadata.size,
          description: vault.data[key].metadata.description || '',
          tags: vault.data[key].metadata.tags || [],
          expiresAt: vault.data[key].metadata.expiresAt || null
        });
      }
    }
    
    return items;
  }

  /**
   * 清空所有存储
   * @param {string} masterPassword - 主密码
   * @returns {boolean} - 是否清空成功
   */
  async clear(masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 创建空的保险库
    const emptyVault = {
      data: {},
      checksum: cryptoUtils.hash('{}')
    };
    
    // 创建空的元数据
    const emptyMetadata = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      items: {},
      keyDerivation: {
        algorithm: 'PBKDF2',
        iterations: 100000,
        keyLength: 32,
        digest: 'sha256'
      }
    };
    
    // 重新加密并保存
    const newEncryptedVault = cryptoUtils.encryptObject(emptyVault, masterKey);
    const newEncryptedMetadata = cryptoUtils.encryptObject(emptyMetadata, masterKey);
    
    const metaData = await fs.readJson(this.metaFile);
    
    await fs.writeJson(this.vaultFile, newEncryptedVault, { spaces: 2 });
    await fs.writeJson(this.metaFile, {
      encrypted: newEncryptedMetadata,
      salt: metaData.salt
    }, { spaces: 2 });
    
    console.log('所有敏感信息已安全清空');
    return true;
  }

  /**
   * 迁移环境变量到安全存储
   * @param {Object} envConfig - 环境变量配置
   * @param {string} masterPassword - 主密码
   * @returns {Object} - 迁移报告
   */
  async migrateFromEnv(envConfig, masterPassword) {
    if (!this.isInitialized()) {
      await this.initialize(masterPassword);
    }
    
    const masterKey = await this.unlock(masterPassword);
    const migrationReport = {
      total: 0,
      success: 0,
      failed: 0,
      details: []
    };
    
    // 需要迁移的敏感键名模式
    const sensitivePatterns = [
      /_TOKEN$/i,
      /_KEY$/i,
      /_SECRET$/i,
      /_PASSWORD$/i,
      /_CREDENTIALS$/i,
      /^API_KEY$/i,
      /^SECRET_/i
    ];
    
    for (const [key, value] of Object.entries(envConfig)) {
      if (!value || typeof value !== 'string') {
        continue;
      }
      
      // 检查是否是敏感信息
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitive) {
        migrationReport.total++;
        
        try {
          await this.save(key, value, masterPassword, {
            description: `从环境变量迁移: ${key}`,
            tags: ['env-migration', 'sensitive'],
            source: 'env'
          });
          
          migrationReport.success++;
          migrationReport.details.push({
            key,
            status: 'success',
            message: '已安全存储'
          });
        } catch (error) {
          migrationReport.failed++;
          migrationReport.details.push({
            key,
            status: 'failed',
            message: error.message
          });
        }
      }
    }
    
    return migrationReport;
  }

  /**
   * 获取存储统计信息
   * @param {string} masterPassword - 主密码
   * @returns {Object} - 统计信息
   */
  async getStats(masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 加载元数据
    const metaData = await fs.readJson(this.metaFile);
    const metadataObj = cryptoUtils.decryptObject(metaData.encrypted, masterKey);
    
    const items = Object.values(metadataObj.items);
    
    return {
      totalItems: items.length,
      totalSize: items.reduce((sum, item) => sum + (item.size || 0), 0),
      created: metadataObj.createdAt,
      lastModified: metadataObj.lastModified,
      storageLocation: this.storageDir
    };
  }

  /**
   * 备份安全存储
   * @param {string} backupPath - 备份路径
   * @param {string} masterPassword - 主密码
   * @returns {string} - 备份文件路径
   */
  async backup(backupPath, masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('安全存储未初始化');
    }
    
    const masterKey = await this.unlock(masterPassword);
    
    // 创建备份包
    const backupData = {
      metadata: await fs.readJson(this.metaFile),
      vault: await fs.readJson(this.vaultFile),
      masterKey: await fs.readJson(this.masterKeyFile),
      backupTime: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const backupFile = backupPath || path.join(this.storageDir, `backup-${Date.now()}.json`);
    await fs.writeJson(backupFile, backupData, { spaces: 2 });
    
    console.log(`安全存储已备份到: ${backupFile}`);
    return backupFile;
  }

  /**
   * 从备份恢复
   * @param {string} backupFile - 备份文件路径
   * @param {string} masterPassword - 主密码
   * @returns {boolean} - 是否恢复成功
   */
  async restore(backupFile, masterPassword) {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`备份文件不存在: ${backupFile}`);
    }
    
    const backupData = await fs.readJson(backupFile);
    
    // 验证备份数据
    if (!backupData.metadata || !backupData.vault || !backupData.masterKey) {
      throw new Error('备份文件格式不正确');
    }
    
    // 恢复文件
    await fs.writeJson(this.metaFile, backupData.metadata, { spaces: 2 });
    await fs.writeJson(this.vaultFile, backupData.vault, { spaces: 2 });
    await fs.writeJson(this.masterKeyFile, backupData.masterKey, { spaces: 2 });
    
    console.log('安全存储已从备份恢复');
    return true;
  }

  /**
   * 安全擦除（多次覆盖）
   * @param {string} masterPassword - 主密码
   */
  async secureErase(masterPassword) {
    const masterKey = await this.unlock(masterPassword);
    
    // 多次覆盖文件
    const files = [this.vaultFile, this.metaFile, this.masterKeyFile];
    
    for (const file of files) {
      if (fs.existsSync(file)) {
        // 多次写入随机数据
        for (let i = 0; i < 3; i++) {
          const randomData = cryptoUtils.generateSecureToken(1024);
          await fs.writeFile(file, randomData);
        }
        // 删除文件
        await fs.remove(file);
      }
    }
    
    // 删除目录
    if (fs.existsSync(this.storageDir)) {
      await fs.remove(this.storageDir);
    }
    
    console.log('安全存储已完全擦除');
  }
}

// 导出单例实例
module.exports = new SecureStorage();
/**
 * 错误消息国际化模块
 * 支持英文(en)、中文(zh-CN)、日文(ja)三种语言
 */

const errorMessages = {
  'en': {
    // 验证错误
    'VALIDATION_ERROR': 'Validation failed',
    'INVALID_INPUT': 'Invalid input provided',
    'MISSING_REQUIRED_FIELD': 'Missing required field: {field}',
    'INVALID_EMAIL': 'Invalid email address',
    'INVALID_URL': 'Invalid URL format',
    'INVALID_PORT': 'Port must be between 1 and 65535',
    'INVALID_PATH': 'Invalid path format',
    'INVALID_PROJECT_TYPE': 'Invalid project type',
    'INVALID_STATUS': 'Invalid status value',
    
    // 认证错误
    'AUTHENTICATION_ERROR': 'Authentication failed',
    'INVALID_CREDENTIALS': 'Invalid credentials',
    'TOKEN_EXPIRED': 'Token has expired',
    'TOKEN_INVALID': 'Invalid token',
    'ACCESS_DENIED': 'Access denied',
    'INSUFFICIENT_PERMISSIONS': 'Insufficient permissions',
    'SESSION_EXPIRED': 'Session has expired',
    
    // 授权错误
    'AUTHORIZATION_ERROR': 'Authorization failed',
    'FORBIDDEN': 'Forbidden',
    'NOT_ALLOWED': 'Operation not allowed',
    'RATE_LIMITED': 'Rate limit exceeded',
    
    // 未找到错误
    'NOT_FOUND_ERROR': 'Resource not found',
    'PROJECT_NOT_FOUND': 'Project not found',
    'USER_NOT_FOUND': 'User not found',
    'FILE_NOT_FOUND': 'File not found',
    'RESOURCE_NOT_FOUND': 'Resource not found',
    'ENDPOINT_NOT_FOUND': 'Endpoint not found',
    
    // 冲突错误
    'CONFLICT_ERROR': 'Resource conflict',
    'PROJECT_EXISTS': 'Project already exists',
    'USER_EXISTS': 'User already exists',
    'DUPLICATE_ENTRY': 'Duplicate entry',
    'CONCURRENT_MODIFICATION': 'Concurrent modification detected',
    
    // 速率限制错误
    'RATE_LIMIT_ERROR': 'Rate limit exceeded',
    'TOO_MANY_REQUESTS': 'Too many requests',
    'REQUEST_LIMIT_EXCEEDED': 'Request limit exceeded',
    
    // 外部服务错误
    'EXTERNAL_SERVICE_ERROR': 'External service error',
    'GITHUB_API_ERROR': 'GitHub API error',
    'DOCKER_API_ERROR': 'Docker API error',
    'DATABASE_CONNECTION_ERROR': 'Database connection error',
    'NETWORK_ERROR': 'Network error',
    
    // 数据库错误
    'DATABASE_ERROR': 'Database error',
    'QUERY_FAILED': 'Database query failed',
    'CONNECTION_FAILED': 'Database connection failed',
    'TRANSACTION_FAILED': 'Database transaction failed',
    
    // 内部错误
    'INTERNAL_ERROR': 'Internal server error',
    'UNEXPECTED_ERROR': 'Unexpected error occurred',
    'SERVER_ERROR': 'Server error',
    'IMPLEMENTATION_ERROR': 'Implementation error',
    
    // 配置错误
    'CONFIGURATION_ERROR': 'Configuration error',
    'MISSING_CONFIG': 'Missing configuration: {config}',
    'INVALID_CONFIG': 'Invalid configuration: {config}',
    'ENV_VAR_MISSING': 'Environment variable missing: {var}',
    
    // 网络错误
    'NETWORK_ERROR': 'Network error',
    'CONNECTION_TIMEOUT': 'Connection timeout',
    'REQUEST_TIMEOUT': 'Request timeout',
    'DNS_ERROR': 'DNS resolution error',
    
    // 文件系统错误
    'FILE_SYSTEM_ERROR': 'File system error',
    'FILE_READ_ERROR': 'Failed to read file',
    'FILE_WRITE_ERROR': 'Failed to write file',
    'FILE_DELETE_ERROR': 'Failed to delete file',
    'DIRECTORY_CREATE_ERROR': 'Failed to create directory',
    'PERMISSION_DENIED': 'Permission denied',
    
    // 部署相关错误
    'DEPLOYMENT_ERROR': 'Deployment failed',
    'BUILD_FAILED': 'Build failed',
    'DEPENDENCY_INSTALL_FAILED': 'Dependency installation failed',
    'START_FAILED': 'Failed to start project',
    'STOP_FAILED': 'Failed to stop project',
    'RESTART_FAILED': 'Failed to restart project',
    'BACKUP_FAILED': 'Backup failed',
    'RESTORE_FAILED': 'Restore failed',
    
    // 系统相关错误
    'SYSTEM_ERROR': 'System error',
    'MEMORY_ERROR': 'Memory allocation error',
    'DISK_SPACE_ERROR': 'Insufficient disk space',
    'CPU_OVERLOAD': 'CPU overload',
    'PROCESS_FAILED': 'Process execution failed',
    
    // 项目操作错误
    'PROJECT_CREATE_ERROR': 'Failed to create project',
    'PROJECT_UPDATE_ERROR': 'Failed to update project',
    'PROJECT_DELETE_ERROR': 'Failed to delete project',
    'PROJECT_START_ERROR': 'Failed to start project',
    'PROJECT_STOP_ERROR': 'Failed to stop project',
    'PROJECT_RESTART_ERROR': 'Failed to restart project',
    'PROJECT_BACKUP_ERROR': 'Failed to backup project',
    'PROJECT_RESTORE_ERROR': 'Failed to restore project',
    
    // 模板相关错误
    'TEMPLATE_ERROR': 'Template error',
    'TEMPLATE_NOT_FOUND': 'Template not found',
    'TEMPLATE_INVALID': 'Invalid template',
    'TEMPLATE_EXECUTION_ERROR': 'Template execution failed',
    
    // 监控相关错误
    'MONITORING_ERROR': 'Monitoring error',
    'METRICS_ERROR': 'Metrics collection error',
    'LOG_ERROR': 'Log processing error',
    'ALERT_ERROR': 'Alert processing error',
    
    // 成功消息（用于对比）
    'SUCCESS': 'Operation completed successfully',
    'PROJECT_CREATED': 'Project created successfully',
    'PROJECT_UPDATED': 'Project updated successfully',
    'PROJECT_DELETED': 'Project deleted successfully',
    'PROJECT_STARTED': 'Project started successfully',
    'PROJECT_STOPPED': 'Project stopped successfully',
    'PROJECT_RESTARTED': 'Project restarted successfully',
    'PROJECT_BACKED_UP': 'Project backed up successfully',
    'PROJECT_RESTORED': 'Project restored successfully',
    'DEPLOYMENT_COMPLETED': 'Deployment completed successfully',
    'BACKUP_COMPLETED': 'Backup completed successfully',
    'RESTORE_COMPLETED': 'Restore completed successfully'
  },
  
  'zh-CN': {
    // 验证错误
    'VALIDATION_ERROR': '验证失败',
    'INVALID_INPUT': '输入无效',
    'MISSING_REQUIRED_FIELD': '缺少必填字段: {field}',
    'INVALID_EMAIL': '邮箱地址无效',
    'INVALID_URL': 'URL格式无效',
    'INVALID_PORT': '端口必须在1到65535之间',
    'INVALID_PATH': '路径格式无效',
    'INVALID_PROJECT_TYPE': '项目类型无效',
    'INVALID_STATUS': '状态值无效',
    
    // 认证错误
    'AUTHENTICATION_ERROR': '认证失败',
    'INVALID_CREDENTIALS': '凭证无效',
    'TOKEN_EXPIRED': '令牌已过期',
    'TOKEN_INVALID': '令牌无效',
    'ACCESS_DENIED': '访问被拒绝',
    'INSUFFICIENT_PERMISSIONS': '权限不足',
    'SESSION_EXPIRED': '会话已过期',
    
    // 授权错误
    'AUTHORIZATION_ERROR': '授权失败',
    'FORBIDDEN': '禁止访问',
    'NOT_ALLOWED': '操作不被允许',
    'RATE_LIMITED': '请求频率过高',
    
    // 未找到错误
    'NOT_FOUND_ERROR': '资源未找到',
    'PROJECT_NOT_FOUND': '项目未找到',
    'USER_NOT_FOUND': '用户未找到',
    'FILE_NOT_FOUND': '文件未找到',
    'RESOURCE_NOT_FOUND': '资源未找到',
    'ENDPOINT_NOT_FOUND': '端点未找到',
    
    // 冲突错误
    'CONFLICT_ERROR': '资源冲突',
    'PROJECT_EXISTS': '项目已存在',
    'USER_EXISTS': '用户已存在',
    'DUPLICATE_ENTRY': '重复条目',
    'CONCURRENT_MODIFICATION': '检测到并发修改',
    
    // 速率限制错误
    'RATE_LIMIT_ERROR': '请求频率过高',
    'TOO_MANY_REQUESTS': '请求过多',
    'REQUEST_LIMIT_EXCEEDED': '请求限制已超出',
    
    // 外部服务错误
    'EXTERNAL_SERVICE_ERROR': '外部服务错误',
    'GITHUB_API_ERROR': 'GitHub API错误',
    'DOCKER_API_ERROR': 'Docker API错误',
    'DATABASE_CONNECTION_ERROR': '数据库连接错误',
    'NETWORK_ERROR': '网络错误',
    
    // 数据库错误
    'DATABASE_ERROR': '数据库错误',
    'QUERY_FAILED': '数据库查询失败',
    'CONNECTION_FAILED': '数据库连接失败',
    'TRANSACTION_FAILED': '数据库事务失败',
    
    // 内部错误
    'INTERNAL_ERROR': '内部服务器错误',
    'UNEXPECTED_ERROR': '发生意外错误',
    'SERVER_ERROR': '服务器错误',
    'IMPLEMENTATION_ERROR': '实现错误',
    
    // 配置错误
    'CONFIGURATION_ERROR': '配置错误',
    'MISSING_CONFIG': '缺少配置: {config}',
    'INVALID_CONFIG': '无效配置: {config}',
    'ENV_VAR_MISSING': '环境变量缺失: {var}',
    
    // 网络错误
    'NETWORK_ERROR': '网络错误',
    'CONNECTION_TIMEOUT': '连接超时',
    'REQUEST_TIMEOUT': '请求超时',
    'DNS_ERROR': 'DNS解析错误',
    
    // 文件系统错误
    'FILE_SYSTEM_ERROR': '文件系统错误',
    'FILE_READ_ERROR': '读取文件失败',
    'FILE_WRITE_ERROR': '写入文件失败',
    'FILE_DELETE_ERROR': '删除文件失败',
    'DIRECTORY_CREATE_ERROR': '创建目录失败',
    'PERMISSION_DENIED': '权限被拒绝',
    
    // 部署相关错误
    'DEPLOYMENT_ERROR': '部署失败',
    'BUILD_FAILED': '构建失败',
    'DEPENDENCY_INSTALL_FAILED': '依赖安装失败',
    'START_FAILED': '启动项目失败',
    'STOP_FAILED': '停止项目失败',
    'RESTART_FAILED': '重启项目失败',
    'BACKUP_FAILED': '备份失败',
    'RESTORE_FAILED': '恢复失败',
    
    // 系统相关错误
    'SYSTEM_ERROR': '系统错误',
    'MEMORY_ERROR': '内存分配错误',
    'DISK_SPACE_ERROR': '磁盘空间不足',
    'CPU_OVERLOAD': 'CPU过载',
    'PROCESS_FAILED': '进程执行失败',
    
    // 项目操作错误
    'PROJECT_CREATE_ERROR': '创建项目失败',
    'PROJECT_UPDATE_ERROR': '更新项目失败',
    'PROJECT_DELETE_ERROR': '删除项目失败',
    'PROJECT_START_ERROR': '启动项目失败',
    'PROJECT_STOP_ERROR': '停止项目失败',
    'PROJECT_RESTART_ERROR': '重启项目失败',
    'PROJECT_BACKUP_ERROR': '备份项目失败',
    'PROJECT_RESTORE_ERROR': '恢复项目失败',
    
    // 模板相关错误
    'TEMPLATE_ERROR': '模板错误',
    'TEMPLATE_NOT_FOUND': '模板未找到',
    'TEMPLATE_INVALID': '模板无效',
    'TEMPLATE_EXECUTION_ERROR': '模板执行失败',
    
    // 监控相关错误
    'MONITORING_ERROR': '监控错误',
    'METRICS_ERROR': '指标收集错误',
    'LOG_ERROR': '日志处理错误',
    'ALERT_ERROR': '告警处理错误',
    
    // 成功消息（用于对比）
    'SUCCESS': '操作成功完成',
    'PROJECT_CREATED': '项目创建成功',
    'PROJECT_UPDATED': '项目更新成功',
    'PROJECT_DELETED': '项目删除成功',
    'PROJECT_STARTED': '项目启动成功',
    'PROJECT_STOPPED': '项目停止成功',
    'PROJECT_RESTARTED': '项目重启成功',
    'PROJECT_BACKED_UP': '项目备份成功',
    'PROJECT_RESTORED': '项目恢复成功',
    'DEPLOYMENT_COMPLETED': '部署完成成功',
    'BACKUP_COMPLETED': '备份完成成功',
    'RESTORE_COMPLETED': '恢复完成成功'
  },
  
  'ja': {
    // 验证错误
    'VALIDATION_ERROR': '検証に失敗しました',
    'INVALID_INPUT': '入力が無効です',
    'MISSING_REQUIRED_FIELD': '必須フィールドが不足しています: {field}',
    'INVALID_EMAIL': 'メールアドレスが無効です',
    'INVALID_URL': 'URL形式が無効です',
    'INVALID_PORT': 'ポートは1から65535の間である必要があります',
    'INVALID_PATH': 'パス形式が無効です',
    'INVALID_PROJECT_TYPE': 'プロジェクトタイプが無効です',
    'INVALID_STATUS': 'ステータス値が無効です',
    
    // 认证错误
    'AUTHENTICATION_ERROR': '認証に失敗しました',
    'INVALID_CREDENTIALS': '資格情報が無効です',
    'TOKEN_EXPIRED': 'トークンの有効期限が切れています',
    'TOKEN_INVALID': 'トークンが無効です',
    'ACCESS_DENIED': 'アクセスが拒否されました',
    'INSUFFICIENT_PERMISSIONS': '権限が不足しています',
    'SESSION_EXPIRED': 'セッションの有効期限が切れています',
    
    // 授权错误
    'AUTHORIZATION_ERROR': '認可に失敗しました',
    'FORBIDDEN': 'アクセス禁止',
    'NOT_ALLOWED': '操作は許可されていません',
    'RATE_LIMITED': 'リクエスト制限を超えました',
    
    // 未找到错误
    'NOT_FOUND_ERROR': 'リソースが見つかりません',
    'PROJECT_NOT_FOUND': 'プロジェクトが見つかりません',
    'USER_NOT_FOUND': 'ユーザーが見つかりません',
    'FILE_NOT_FOUND': 'ファイルが見つかりません',
    'RESOURCE_NOT_FOUND': 'リソースが見つかりません',
    'ENDPOINT_NOT_FOUND': 'エンドポイントが見つかりません',
    
    // 冲突错误
    'CONFLICT_ERROR': 'リソースの競合',
    'PROJECT_EXISTS': 'プロジェクトは既に存在します',
    'USER_EXISTS': 'ユーザーは既に存在します',
    'DUPLICATE_ENTRY': '重複エントリ',
    'CONCURRENT_MODIFICATION': '同時変更が検出されました',
    
    // 速率限制错误
    'RATE_LIMIT_ERROR': 'リクエスト制限を超えました',
    'TOO_MANY_REQUESTS': 'リクエストが多すぎます',
    'REQUEST_LIMIT_EXCEEDED': 'リクエスト制限を超えました',
    
    // 外部服务错误
    'EXTERNAL_SERVICE_ERROR': '外部サービスエラー',
    'GITHUB_API_ERROR': 'GitHub APIエラー',
    'DOCKER_API_ERROR': 'Docker APIエラー',
    'DATABASE_CONNECTION_ERROR': 'データベース接続エラー',
    'NETWORK_ERROR': 'ネットワークエラー',
    
    // 数据库错误
    'DATABASE_ERROR': 'データベースエラー',
    'QUERY_FAILED': 'データベースクエリに失敗しました',
    'CONNECTION_FAILED': 'データベース接続に失敗しました',
    'TRANSACTION_FAILED': 'データベーストランザクションに失敗しました',
    
    // 内部错误
    'INTERNAL_ERROR': '内部サーバーエラー',
    'UNEXPECTED_ERROR': '予期せぬエラーが発生しました',
    'SERVER_ERROR': 'サーバーエラー',
    'IMPLEMENTATION_ERROR': '実装エラー',
    
    // 配置错误
    'CONFIGURATION_ERROR': '設定エラー',
    'MISSING_CONFIG': '設定が不足しています: {config}',
    'INVALID_CONFIG': '設定が無効です: {config}',
    'ENV_VAR_MISSING': '環境変数が不足しています: {var}',
    
    // 网络错误
    'NETWORK_ERROR': 'ネットワークエラー',
    'CONNECTION_TIMEOUT': '接続タイムアウト',
    'REQUEST_TIMEOUT': 'リクエストタイムアウト',
    'DNS_ERROR': 'DNS解決エラー',
    
    // 文件系统错误
    'FILE_SYSTEM_ERROR': 'ファイルシステムエラー',
    'FILE_READ_ERROR': 'ファイルの読み込みに失敗しました',
    'FILE_WRITE_ERROR': 'ファイルの書き込みに失敗しました',
    'FILE_DELETE_ERROR': 'ファイルの削除に失敗しました',
    'DIRECTORY_CREATE_ERROR': 'ディレクトリの作成に失敗しました',
    'PERMISSION_DENIED': '権限が拒否されました',
    
    // 部署相关错误
    'DEPLOYMENT_ERROR': 'デプロイに失敗しました',
    'BUILD_FAILED': 'ビルドに失敗しました',
    'DEPENDENCY_INSTALL_FAILED': '依存関係のインストールに失敗しました',
    'START_FAILED': 'プロジェクトの起動に失敗しました',
    'STOP_FAILED': 'プロジェクトの停止に失敗しました',
    'RESTART_FAILED': 'プロジェクトの再起動に失败しました',
    'BACKUP_FAILED': 'バックアップに失败しました',
    'RESTORE_FAILED': '復元に失败しました',
    
    // 系统相关错误
    'SYSTEM_ERROR': 'システムエラー',
    'MEMORY_ERROR': 'メモリ割り当てエラー',
    'DISK_SPACE_ERROR': 'ディスク容量が不足しています',
    'CPU_OVERLOAD': 'CPU過負荷',
    'PROCESS_FAILED': 'プロセス実行に失敗しました',
    
    // 项目操作错误
    'PROJECT_CREATE_ERROR': 'プロジェクトの作成に失敗しました',
    'PROJECT_UPDATE_ERROR': 'プロジェクトの更新に失敗しました',
    'PROJECT_DELETE_ERROR': 'プロジェクトの削除に失敗しました',
    'PROJECT_START_ERROR': 'プロジェクトの起動に失敗しました',
    'PROJECT_STOP_ERROR': 'プロジェクトの停止に失敗しました',
    'PROJECT_RESTART_ERROR': 'プロジェクトの再起動に失败しました',
    'PROJECT_BACKUP_ERROR': 'プロジェクトのバックアップに失败しました',
    'PROJECT_RESTORE_ERROR': 'プロジェクトの復元に失败しました',
    
    // 模板相关错误
    'TEMPLATE_ERROR': 'テンプレートエラー',
    'TEMPLATE_NOT_FOUND': 'テンプレートが見つかりません',
    'TEMPLATE_INVALID': 'テンプレートが無効です',
    'TEMPLATE_EXECUTION_ERROR': 'テンプレートの実行に失敗しました',
    
    // 监控相关错误
    'MONITORING_ERROR': '監視エラー',
    'METRICS_ERROR': 'メトリクス収集エラー',
    'LOG_ERROR': 'ログ処理エラー',
    'ALERT_ERROR': 'アラート処理エラー',
    
    // 成功消息（用于对比）
    'SUCCESS': '操作が正常に完了しました',
    'PROJECT_CREATED': 'プロジェクトが正常に作成されました',
    'PROJECT_UPDATED': 'プロジェクトが正常に更新されました',
    'PROJECT_DELETED': 'プロジェクトが正常に削除されました',
    'PROJECT_STARTED': 'プロジェクトが正常に起動されました',
    'PROJECT_STOPPED': 'プロジェクトが正常に停止されました',
    'PROJECT_RESTARTED': 'プロジェクトが正常に再起動されました',
    'PROJECT_BACKED_UP': 'プロジェクトが正常にバックアップされました',
    'PROJECT_RESTORED': 'プロジェクトが正常に復元されました',
    'DEPLOYMENT_COMPLETED': 'デプロイが正常に完了しました',
    'BACKUP_COMPLETED': 'バックアップが正常に完了しました',
    'RESTORE_COMPLETED': '復元が正常に完了しました'
  }
};

// 错误代码映射
const errorCodes = {
  // 验证错误: 1000-1099
  VALIDATION_ERROR: 1000,
  INVALID_INPUT: 1001,
  MISSING_REQUIRED_FIELD: 1002,
  INVALID_EMAIL: 1003,
  INVALID_URL: 1004,
  INVALID_PORT: 1005,
  INVALID_PATH: 1006,
  INVALID_PROJECT_TYPE: 1007,
  INVALID_STATUS: 1008,
  
  // 认证错误: 1100-1199
  AUTHENTICATION_ERROR: 1100,
  INVALID_CREDENTIALS: 1101,
  TOKEN_EXPIRED: 1102,
  TOKEN_INVALID: 1103,
  ACCESS_DENIED: 1104,
  INSUFFICIENT_PERMISSIONS: 1105,
  SESSION_EXPIRED: 1106,
  
  // 授权错误: 1200-1299
  AUTHORIZATION_ERROR: 1200,
  FORBIDDEN: 1201,
  NOT_ALLOWED: 1202,
  RATE_LIMITED: 1203,
  
  // 未找到错误: 1300-1399
  NOT_FOUND_ERROR: 1300,
  PROJECT_NOT_FOUND: 1301,
  USER_NOT_FOUND: 1302,
  FILE_NOT_FOUND: 1303,
  RESOURCE_NOT_FOUND: 1304,
  ENDPOINT_NOT_FOUND: 1305,
  
  // 冲突错误: 1400-1499
  CONFLICT_ERROR: 1400,
  PROJECT_EXISTS: 1401,
  USER_EXISTS: 1402,
  DUPLICATE_ENTRY: 1403,
  CONCURRENT_MODIFICATION: 1404,
  
  // 速率限制错误: 1500-1599
  RATE_LIMIT_ERROR: 1500,
  TOO_MANY_REQUESTS: 1501,
  REQUEST_LIMIT_EXCEEDED: 1502,
  
  // 外部服务错误: 1600-1699
  EXTERNAL_SERVICE_ERROR: 1600,
  GITHUB_API_ERROR: 1601,
  DOCKER_API_ERROR: 1602,
  DATABASE_CONNECTION_ERROR: 1603,
  NETWORK_ERROR: 1604,
  
  // 数据库错误: 1700-1799
  DATABASE_ERROR: 1700,
  QUERY_FAILED: 1701,
  CONNECTION_FAILED: 1702,
  TRANSACTION_FAILED: 1703,
  
  // 内部错误: 1800-1899
  INTERNAL_ERROR: 1800,
  UNEXPECTED_ERROR: 1801,
  SERVER_ERROR: 1802,
  IMPLEMENTATION_ERROR: 1803,
  
  // 配置错误: 1900-1999
  CONFIGURATION_ERROR: 1900,
  MISSING_CONFIG: 1901,
  INVALID_CONFIG: 1902,
  ENV_VAR_MISSING: 1903,
  
  // 网络错误: 2000-2099
  NETWORK_ERROR: 2000,
  CONNECTION_TIMEOUT: 2001,
  REQUEST_TIMEOUT: 2002,
  DNS_ERROR: 2003,
  
  // 文件系统错误: 2100-2199
  FILE_SYSTEM_ERROR: 2100,
  FILE_READ_ERROR: 2101,
  FILE_WRITE_ERROR: 2102,
  FILE_DELETE_ERROR: 2103,
  DIRECTORY_CREATE_ERROR: 2104,
  PERMISSION_DENIED: 2105,
  
  // 部署相关错误: 2200-2299
  DEPLOYMENT_ERROR: 2200,
  BUILD_FAILED: 2201,
  DEPENDENCY_INSTALL_FAILED: 2202,
  START_FAILED: 2203,
  STOP_FAILED: 2204,
  RESTART_FAILED: 2205,
  BACKUP_FAILED: 2206,
  RESTORE_FAILED: 2207,
  
  // 系统相关错误: 2300-2399
  SYSTEM_ERROR: 2300,
  MEMORY_ERROR: 2301,
  DISK_SPACE_ERROR: 2302,
  CPU_OVERLOAD: 2303,
  PROCESS_FAILED: 2304,
  
  // 项目操作错误: 2400-2499
  PROJECT_CREATE_ERROR: 2400,
  PROJECT_UPDATE_ERROR: 2401,
  PROJECT_DELETE_ERROR: 2402,
  PROJECT_START_ERROR: 2403,
  PROJECT_STOP_ERROR: 2404,
  PROJECT_RESTART_ERROR: 2405,
  PROJECT_BACKUP_ERROR: 2406,
  PROJECT_RESTORE_ERROR: 2407,
  
  // 模板相关错误: 2500-2599
  TEMPLATE_ERROR: 2500,
  TEMPLATE_NOT_FOUND: 2501,
  TEMPLATE_INVALID: 2502,
  TEMPLATE_EXECUTION_ERROR: 2503,
  
  // 监控相关错误: 2600-2699
  MONITORING_ERROR: 2600,
  METRICS_ERROR: 2601,
  LOG_ERROR: 2602,
  ALERT_ERROR: 2603
};

// 成功代码映射
const successCodes = {
  SUCCESS: 0,
  PROJECT_CREATED: 100,
  PROJECT_UPDATED: 101,
  PROJECT_DELETED: 102,
  PROJECT_STARTED: 103,
  PROJECT_STOPPED: 104,
  PROJECT_RESTARTED: 105,
  PROJECT_BACKED_UP: 106,
  PROJECT_RESTORED: 107,
  DEPLOYMENT_COMPLETED: 108,
  BACKUP_COMPLETED: 109,
  RESTORE_COMPLETED: 110
};

class I18nErrorHandler {
  constructor(defaultLang = 'en') {
    this.defaultLang = defaultLang;
  }
  
  // 获取错误消息
  getErrorMessage(key, lang = this.defaultLang, params = {}) {
    const messages = errorMessages[lang] || errorMessages[this.defaultLang];
    let message = messages[key] || key;
    
    // 替换参数
    Object.keys(params).forEach(param => {
      const placeholder = `{${param}}`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
    
    return message;
  }
  
  // 获取错误代码
  getErrorCode(key) {
    return errorCodes[key] || 1800; // 默认为内部错误
  }
  
  // 获取成功代码
  getSuccessCode(key) {
    return successCodes[key] || 0;
  }
  
  // 创建标准化的错误响应
  createErrorResponse(key, lang = this.defaultLang, params = {}, details = null) {
    const code = this.getErrorCode(key);
    const message = this.getErrorMessage(key, lang, params);
    
    return {
      success: false,
      error: {
        code,
        message,
        key,
        details,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  // 创建标准化的成功响应
  createSuccessResponse(key = 'SUCCESS', lang = this.defaultLang, params = {}, data = null) {
    const code = this.getSuccessCode(key);
    const message = this.getErrorMessage(key, lang, params);
    
    const response = {
      success: true,
      code,
      message,
      key,
      timestamp: new Date().toISOString()
    };
    
    if (data !== null) {
      response.data = data;
    }
    
    return response;
  }
  
  // 从请求中检测语言
  detectLanguage(req) {
    // 1. 检查查询参数
    if (req.query && req.query.lang) {
      const lang = req.query.lang.toLowerCase();
      if (['en', 'zh-cn', 'ja'].includes(lang)) {
        return lang === 'zh-cn' ? 'zh-CN' : lang;
      }
    }
    
    // 2. 检查请求头
    if (req.headers && req.headers['accept-language']) {
      const acceptLanguage = req.headers['accept-language'].toLowerCase();
      if (acceptLanguage.includes('zh')) {
        return 'zh-CN';
      } else if (acceptLanguage.includes('ja')) {
        return 'ja';
      } else if (acceptLanguage.includes('en')) {
        return 'en';
      }
    }
    
    // 3. 检查Cookie
    if (req.cookies && req.cookies.lang) {
      const lang = req.cookies.lang.toLowerCase();
      if (['en', 'zh-cn', 'ja'].includes(lang)) {
        return lang === 'zh-cn' ? 'zh-CN' : lang;
      }
    }
    
    // 4. 默认语言
    return this.defaultLang;
  }
  
  // 设置响应语言头
  setLanguageHeaders(res, lang) {
    res.setHeader('Content-Language', lang);
    res.setHeader('X-Content-Language', lang);
  }
  
  // 中间件：检测语言并设置到请求对象
  middleware(req, res, next) {
    req.lang = this.detectLanguage(req);
    req.i18n = {
      t: (key, params = {}) => this.getErrorMessage(key, req.lang, params),
      createError: (key, params = {}, details = null) => 
        this.createErrorResponse(key, req.lang, params, details),
      createSuccess: (key = 'SUCCESS', params = {}, data = null) =>
        this.createSuccessResponse(key, req.lang, params, data)
    };
    
    // 设置语言响应头
    this.setLanguageHeaders(res, req.lang);
    
    next();
  }
  
  // 包装错误处理中间件
  errorMiddleware(err, req, res, next) {
    const lang = req.lang || this.defaultLang;
    
    // 如果是自定义错误
    if (err.key && errorMessages[lang] && errorMessages[lang][err.key]) {
      const response = this.createErrorResponse(
        err.key,
        lang,
        err.params || {},
        err.details
      );
      
      return res.status(err.statusCode || 400).json(response);
    }
    
    // 如果是AppError（来自error-handler.js）
    if (err.isOperational && err.message) {
      const response = this.createErrorResponse(
        'INTERNAL_ERROR',
        lang,
        {},
        process.env.NODE_ENV === 'development' ? err.message : undefined
      );
      
      return res.status(err.statusCode || 500).json(response);
    }
    
    // 默认错误处理
    const response = this.createErrorResponse(
      'INTERNAL_ERROR',
      lang,
      {},
      process.env.NODE_ENV === 'development' ? err.message : undefined
    );
    
    return res.status(500).json(response);
  }
}

// 创建单例实例
const i18nErrorHandler = new I18nErrorHandler('zh-CN');

module.exports = {
  errorMessages,
  errorCodes,
  successCodes,
  I18nErrorHandler,
  i18nErrorHandler
};
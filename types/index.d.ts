/**
 * GitHub Deploy Assistant 类型定义
 */

// 基础类型
declare global {
  // 环境变量类型
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    API_KEY?: string;
    DATABASE_URL?: string;
    REDIS_URL?: string;
    LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug';
    [key: string]: string | undefined;
  }
}

// 项目相关类型
export interface Project {
  id: string;
  name: string;
  repo_url: string;
  project_type: string;
  local_path: string;
  status: 'pending' | 'installing' | 'running' | 'stopped' | 'error';
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface Deployment {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  logs: string[];
  started_at: Date;
  completed_at?: Date;
  error?: string;
}

export interface Activity {
  id: string;
  type: 'deploy' | 'install' | 'update' | 'delete' | 'error';
  project_id?: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// 错误类型
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: any;
  timestamp: string;
}

export type ErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'CONFLICT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'NETWORK_ERROR';

// 中间件类型
export type Middleware = (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) => void | Promise<void>;

export type ErrorMiddleware = (
  err: Error,
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) => void;

// 性能监控类型
export interface PerformanceMetrics {
  apiRequests: Map<string, RequestStats>;
  databaseQueries: Map<string, QueryStats>;
  externalCalls: Map<string, ExternalCallStats>;
  memoryUsage: MemorySample[];
  cpuUsage: CpuSample[];
  startTime: number;
}

export interface RequestStats {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  errors: number;
  lastUpdated: number;
}

export interface QueryStats {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  errors: number;
  lastUpdated: number;
}

export interface ExternalCallStats {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  errors: number;
  lastUpdated: number;
}

export interface MemorySample {
  timestamp: number;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface CpuSample {
  timestamp: number;
  percent: number;
  cpus: number;
}

// Socket.IO 类型
export interface SocketEventMap {
  'join_project': (projectId: string) => void;
  'leave_project': (projectId: string) => void;
  'deployment_start': (data: DeploymentStartData) => void;
  'deployment_progress': (data: DeploymentProgressData) => void;
  'deployment_complete': (data: DeploymentCompleteData) => void;
  'log': (data: LogData) => void;
  'error': (data: ErrorData) => void;
}

export interface DeploymentStartData {
  projectId: string;
  deploymentId: string;
  timestamp: string;
}

export interface DeploymentProgressData {
  projectId: string;
  deploymentId: string;
  progress: number;
  message: string;
  timestamp: string;
}

export interface DeploymentCompleteData {
  projectId: string;
  deploymentId: string;
  status: 'success' | 'failed';
  message: string;
  timestamp: string;
}

export interface LogData {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface ErrorData {
  timestamp: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

// 配置类型
export interface AppConfig {
  server: {
    port: number;
    host: string;
    environment: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  database: {
    url: string;
    pool: {
      max: number;
      min: number;
      acquire: number;
      idle: number;
    };
  };
  logging: {
    level: string;
    format: string;
    file?: string;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  monitoring: {
    enabled: boolean;
    samplingInterval: number;
    maxSamples: number;
  };
}

// 工具函数类型
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

// 泛型类型
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// 工具类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

// 事件类型
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface EventEmitter<T extends Record<string, any>> {
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void;
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
}

// 导出所有类型
export * from './project';
export * from './api';
export * from './error';
export * from './config';
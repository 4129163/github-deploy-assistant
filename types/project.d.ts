/**
 * 项目相关类型定义
 */

export interface ProjectBase {
  id: string;
  name: string;
  description?: string;
  repo_url: string;
  branch?: string;
  project_type: string;
  local_path: string;
  status: ProjectStatus;
  created_at: Date;
  updated_at: Date;
}

export type ProjectStatus = 
  | 'pending'       // 等待中
  | 'installing'    // 安装中
  | 'configuring'   // 配置中
  | 'running'       // 运行中
  | 'stopped'       // 已停止
  | 'error'         // 错误
  | 'deleting'      // 删除中
  | 'migrating';    // 迁移中

export interface ProjectDetails extends ProjectBase {
  metadata: ProjectMetadata;
  dependencies?: ProjectDependency[];
  environment?: Record<string, string>;
  ports?: ProjectPort[];
  volumes?: ProjectVolume[];
  health_check?: HealthCheckConfig;
}

export interface ProjectMetadata {
  language?: string;
  framework?: string;
  version?: string;
  package_manager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'composer' | 'maven' | 'gradle';
  build_tool?: string;
  database?: string;
  cache?: string;
  queue?: string;
  [key: string]: any;
}

export interface ProjectDependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  installed: boolean;
  latest_version?: string;
}

export interface ProjectPort {
  host: number;
  container: number;
  protocol: 'tcp' | 'udp';
  exposed: boolean;
}

export interface ProjectVolume {
  host_path: string;
  container_path: string;
  read_only: boolean;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  start_period: number;
}

// 部署相关类型
export interface Deployment {
  id: string;
  project_id: string;
  version: string;
  status: DeploymentStatus;
  logs: DeploymentLog[];
  started_at: Date;
  completed_at?: Date;
  duration?: number;
  error?: DeploymentError;
  artifacts?: DeploymentArtifact[];
}

export type DeploymentStatus = 
  | 'pending'       // 等待部署
  | 'preparing'     // 准备中
  | 'building'      // 构建中
  | 'testing'       // 测试中
  | 'deploying'     // 部署中
  | 'verifying'     // 验证中
  | 'success'       // 成功
  | 'failed'        // 失败
  | 'cancelled'     // 已取消
  | 'rolled_back';  // 已回滚

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface DeploymentError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  recoverable: boolean;
}

export interface DeploymentArtifact {
  type: 'log' | 'config' | 'binary' | 'package' | 'report';
  name: string;
  path: string;
  size: number;
  checksum?: string;
}

// 项目操作类型
export interface CreateProjectRequest {
  name: string;
  repo_url: string;
  project_type: string;
  branch?: string;
  environment?: Record<string, string>;
  metadata?: ProjectMetadata;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  environment?: Record<string, string>;
  metadata?: ProjectMetadata;
}

export interface DeployProjectRequest {
  version?: string;
  force?: boolean;
  skip_tests?: boolean;
  environment?: Record<string, string>;
  variables?: Record<string, string>;
}

// 项目统计类型
export interface ProjectStats {
  project_id: string;
  deployments: {
    total: number;
    successful: number;
    failed: number;
    average_duration: number;
    last_deployment?: Date;
  };
  resources: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_io: {
      in: number;
      out: number;
    };
  };
  alerts: ProjectAlert[];
  uptime: number;
}

export interface ProjectAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'error' | 'deployment';
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolved_at?: Date;
}

// 项目模板类型
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  language: string;
  framework: string;
  configuration: ProjectTemplateConfig;
  files: TemplateFile[];
  variables: TemplateVariable[];
  dependencies: TemplateDependency[];
}

export interface ProjectTemplateConfig {
  build_command?: string;
  start_command?: string;
  test_command?: string;
  install_command?: string;
  output_directory?: string;
  ports?: number[];
  environment?: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
  type: 'template' | 'static';
  variables?: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default?: any;
  required: boolean;
  options?: string[];
}

export interface TemplateDependency {
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'composer' | 'maven' | 'system';
  install_command?: string;
}

// 导出类型检查工具
export type ProjectKeys = keyof ProjectBase;
export type DeploymentKeys = keyof Deployment;
export type RequiredProjectFields = RequiredKeys<ProjectBase>;
export type OptionalProjectFields = OptionalKeys<ProjectBase>;
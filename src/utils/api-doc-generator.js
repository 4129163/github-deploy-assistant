/**
 * API文档生成器
 * 自动生成OpenAPI/Swagger格式的API文档
 */

const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');

class ApiDocGenerator {
  constructor() {
    this.spec = {
      openapi: '3.0.0',
      info: {
        title: 'GitHub Deploy Assistant API',
        description: '自动部署GitHub项目的RESTful API服务',
        version: '1.0.0',
        contact: {
          name: 'GitHub Deploy Assistant Team',
          url: 'https://github.com/4129163/github-deploy-assistant'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3456',
          description: '本地开发服务器'
        },
        {
          url: 'https://api.yourdomain.com',
          description: '生产服务器'
        }
      ],
      tags: [],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      },
      security: [
        {
          BearerAuth: []
        }
      ]
    };

    this.initializeSchemas();
  }

  /**
   * 初始化数据模型
   */
  initializeSchemas() {
    this.spec.components.schemas = {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Validation failed'
              },
              code: {
                type: 'integer',
                example: 400
              },
              type: {
                type: 'string',
                example: 'VALIDATION_ERROR'
              },
              details: {
                type: 'object',
                additionalProperties: true
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2026-04-04T11:30:00.000Z'
              },
              path: {
                type: 'string',
                example: '/api/repo/analyze'
              }
            }
          }
        }
      },

      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            additionalProperties: true
          },
          message: {
            type: 'string',
            example: 'Operation completed successfully'
          }
        }
      },

      Repository: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'github-owner-repo'
          },
          url: {
            type: 'string',
            format: 'uri',
            example: 'https://github.com/owner/repo'
          },
          name: {
            type: 'string',
            example: 'repo-name'
          },
          owner: {
            type: 'string',
            example: 'owner-name'
          },
          description: {
            type: 'string',
            example: 'Repository description'
          },
          language: {
            type: 'string',
            example: 'JavaScript'
          },
          stars: {
            type: 'integer',
            example: 1234
          },
          forks: {
            type: 'integer',
            example: 567
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      Project: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'project-123'
          },
          name: {
            type: 'string',
            example: 'My Project'
          },
          repositoryUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://github.com/owner/repo'
          },
          status: {
            type: 'string',
            enum: ['pending', 'analyzing', 'installing', 'running', 'stopped', 'error'],
            example: 'running'
          },
          port: {
            type: 'integer',
            example: 3000
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          },
          metadata: {
            type: 'object',
            additionalProperties: true
          }
        }
      },

      Deployment: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'deploy-123'
          },
          projectId: {
            type: 'string',
            example: 'project-123'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'success', 'failed'],
            example: 'success'
          },
          logs: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          startedAt: {
            type: 'string',
            format: 'date-time'
          },
          completedAt: {
            type: 'string',
            format: 'date-time'
          },
          duration: {
            type: 'integer',
            example: 12345
          }
        }
      },

      AIAnalysis: {
        type: 'object',
        properties: {
          projectType: {
            type: 'string',
            example: 'Node.js'
          },
          dependencies: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          installCommands: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          startCommands: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          port: {
            type: 'integer',
            example: 3000
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          warnings: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            example: 0.95
          }
        }
      }
    };
  }

  /**
   * 添加API路径
   */
  addPath(method, path, operation) {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }

    this.spec.paths[path][method.toLowerCase()] = operation;
  }

  /**
   * 生成仓库API文档
   */
  generateRepoApiDocs() {
    // 分析仓库
    this.addPath('POST', '/api/repo/analyze', {
      tags: ['Repository'],
      summary: '分析GitHub仓库',
      description: '分析指定的GitHub仓库，识别项目类型、依赖和配置',
      operationId: 'analyzeRepository',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'GitHub仓库URL',
                  example: 'https://github.com/owner/repo'
                },
                branch: {
                  type: 'string',
                  description: '分支名称（默认为main）',
                  example: 'main'
                },
                token: {
                  type: 'string',
                  description: 'GitHub访问令牌（私有仓库需要）'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '分析成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/AIAnalysis' }
                }
              }
            }
          }
        },
        400: {
          description: '请求参数错误',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        404: {
          description: '仓库不存在',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    });

    // 克隆仓库
    this.addPath('POST', '/api/repo/clone', {
      tags: ['Repository'],
      summary: '克隆GitHub仓库',
      description: '克隆指定的GitHub仓库到本地',
      operationId: 'cloneRepository',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: {
                  type: 'string',
                  format: 'uri',
                  description: 'GitHub仓库URL',
                  example: 'https://github.com/owner/repo'
                },
                branch: {
                  type: 'string',
                  description: '分支名称',
                  example: 'main'
                },
                token: {
                  type: 'string',
                  description: 'GitHub访问令牌（私有仓库需要）'
                },
                path: {
                  type: 'string',
                  description: '本地保存路径'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '克隆成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      path: { type: 'string', example: '/workspace/owner-repo' },
                      files: { type: 'integer', example: 42 }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 生成项目API文档
   */
  generateProjectApiDocs() {
    // 创建项目
    this.addPath('POST', '/api/project/create', {
      tags: ['Project'],
      summary: '创建新项目',
      description: '基于GitHub仓库创建新项目',
      operationId: 'createProject',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'repositoryUrl'],
              properties: {
                name: {
                  type: 'string',
                  description: '项目名称',
                  example: 'My Awesome Project'
                },
                repositoryUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'GitHub仓库URL',
                  example: 'https://github.com/owner/repo'
                },
                branch: {
                  type: 'string',
                  description: '分支名称',
                  example: 'main'
                },
                environment: {
                  type: 'object',
                  description: '环境变量',
                  additionalProperties: {
                    type: 'string'
                  }
                },
                config: {
                  type: 'object',
                  description: '项目配置',
                  additionalProperties: true
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: '项目创建成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/Project' }
                }
              }
            }
          }
        }
      }
    });

    // 列出项目
    this.addPath('GET', '/api/project/list', {
      tags: ['Project'],
      summary: '列出所有项目',
      description: '获取所有项目的列表',
      operationId: 'listProjects',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          description: '返回数量限制',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }
        },
        {
          name: 'offset',
          in: 'query',
          description: '偏移量',
          schema: { type: 'integer', default: 0, minimum: 0 }
        },
        {
          name: 'status',
          in: 'query',
          description: '按状态过滤',
          schema: { type: 'string', enum: ['pending', 'running', 'stopped', 'error'] }
        }
      ],
      responses: {
        200: {
          description: '项目列表',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      projects: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Project' }
                      },
                      total: { type: 'integer', example: 42 }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 生成部署API文档
   */
  generateDeployApiDocs() {
    // 部署项目
    this.addPath('POST', '/api/deploy/start', {
      tags: ['Deployment'],
      summary: '开始部署',
      description: '开始部署指定项目',
      operationId: 'startDeployment',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['projectId'],
              properties: {
                projectId: {
                  type: 'string',
                  description: '项目ID',
                  example: 'project-123'
                },
                force: {
                  type: 'boolean',
                  description: '强制重新部署',
                  default: false
                },
                skipInstall: {
                  type: 'boolean',
                  description: '跳过依赖安装',
                  default: false
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: '部署开始',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/Deployment' }
                }
              }
            }
          }
        }
      }
    });

    // 获取部署状态
    this.addPath('GET', '/api/deploy/status/{projectId}', {
      tags: ['Deployment'],
      summary: '获取部署状态',
      description: '获取指定项目的部署状态',
      operationId: 'getDeploymentStatus',
      parameters: [
        {
          name: 'projectId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: '项目ID'
        }
      ],
      responses: {
        200: {
          description: '部署状态',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: '#/components/schemas/Deployment' }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 生成AI相关API文档
   */
  generateAiApiDocs() {
    // AI问答
    this.addPath('POST', '/api/ai/ask', {
      tags: ['AI'],
      summary: 'AI问答',
      description: '向AI提问关于部署的问题',
      operationId: 'askAI',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['question'],
              properties: {
                question: {
                  type: 'string',
                  description: '问题内容',
                  example: '如何解决Node.js内存泄漏问题？'
                },
                context: {
                  type: 'object',
                  description: '上下文信息',
                  additionalProperties: true
                },
                provider: {
                  type: 'string',
                  description: 'AI提供商',
                  example: 'openai'
                },
                model: {
                  type: 'string',
                  description: '模型名称',
                  example: 'gpt-4'
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'AI回答',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      answer: { type: 'string' },
                      reasoning: { type: 'string' },
                      sources: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 生成所有API文档
   */
  generateAllApiDocs() {
    this.spec.tags = [
      { name: 'Repository', description: '仓库相关操作' },
      { name: 'Project', description: '项目管理' },
      { name: 'Deployment', description: '部署操作' },
      { name: 'AI', description: 'AI功能' },
      { name: 'System', description: '系统管理' },
      { name: 'Webhook', description: 'Webhook处理' }
    ];

    this.generateRepoApiDocs();
    this.generateProjectApiDocs();
    this.generateDeployApiDocs();
    this.generateAiApiDocs();

    // 添加健康检查
    this.addPath('GET', '/api/health', {
      tags: ['System'],
      summary: '健康检查',
      description: '检查系统健康状况',
      operationId: 'healthCheck',
      responses: {
        200: {
          description: '系统健康',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      timestamp: { type: 'string', format: 'date-time' },
                      uptime: { type: 'number', example: 1234567 },
                      version: { type: 'string', example: '1.0.0' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // 添加性能监控
    this.addPath('GET', '/api/performance', {
      tags: ['System'],
      summary: '性能监控',
      description: '获取系统性能指标',
      operationId: 'getPerformanceMetrics',
      responses: {
        200: {
          description: '性能指标',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      system: { type: 'object' },
                      api: { type: 'object' },
                      database: { type: 'object' },
                      alerts: { type: 'array' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 生成文档文件
   */
  async generateDocumentation(outputPath = './docs/api-spec.json') {
    try {
      this.generateAllApiDocs();
      
      const fullPath = path.isAbsolute(outputPath) 
        ? outputPath 
        : path.join(__dirname, '../..', outputPath);
      
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeJson(fullPath, this.spec, { spaces: 2 });
      
      logger.info(`API文档已生成: ${fullPath}`);
      
      // 同时生成Markdown格式的文档
      await this.generateMarkdownDocs(fullPath.replace('.json', '.md'));
      
      return {
        success: true,
        path: fullPath,
        spec: this.spec
      };
    } catch (error) {
      logger.error('生成API文档失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成Markdown格式的文档
   */
  async generateMarkdownDocs(outputPath) {
    const mdContent = [
      '# GitHub Deploy Assistant API 文档',
      '',
      '## 概述',
      'GitHub Deploy Assistant 提供了一套完整的RESTful API，用于自动化GitHub项目的部署和管理。',
      '',
      '## 基础信息',
      `- **版本**: ${this.spec.info.version}`,
      `- **API地址**: \`${this.spec.servers[0].url}\``,
      `- **文档格式**: OpenAPI 3.0.0`,
      '',
      '## 认证',
      '大部分API需要认证，支持以下方式：',
      '',
      '### Bearer Token',
      '```',
      'Authorization: Bearer <your-jwt-token>',
      '```',
      '',
      '### API Key',
      '```',
      'X-API-Key: <your-api-key>',
      '```',
      '',
      '## API端点',
      ''
    ];

    // 按标签分组
    for (const tag of this.spec.tags) {
      mdContent.push(`### ${tag.name}`);
      mdContent.push(tag.description);
      mdContent.push('');

      // 找到该标签下的所有路径
      for (const [path, methods] of Object.entries(this.spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (operation.tags && operation.tags.includes(tag.name)) {
            mdContent.push(`#### ${method.toUpperCase()} ${path}`);
            mdContent.push(operation.summary);
            mdContent.push('');
            mdContent.push(`**描述**: ${operation.description}`);
            mdContent.push('');
            
            if (operation.requestBody) {
              mdContent.push('**请求体**:');
              mdContent.push('```json');
              const example = operation.requestBody.content['application/json'].schema;
              mdContent.push(JSON.stringify(example, null, 2));
              mdContent.push('```');
              mdContent.push('');
            }

            if (operation.parameters && operation.parameters.length > 0) {
              mdContent.push('**参数**:');
              for (const param of operation.parameters) {
                mdContent.push(`- \`${param.name}\` (${param.in}): ${param.description}`);
              }
              mdContent.push('');
            }

            mdContent.push('**响应**:');
            mdContent.push('```json');
            const response = operation.responses['200']?.content['application/json'].schema;
            mdContent.push(JSON.stringify(response, null, 2));
            mdContent.push('```');
            mdContent.push('');
          }
        }
      }
    }

    // 数据模型
    mdContent.push('## 数据模型');
    mdContent.push('');
    for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
      mdContent.push(`### ${name}`);
      mdContent.push('```json');
      mdContent.push(JSON.stringify(schema, null, 2));
      mdContent.push('```');
      mdContent.push('');
    }

    await fs.writeFile(outputPath, mdContent.join('\n'));
    logger.info(`Markdown文档已生成: ${outputPath}`);
  }

  /**
   * 生成HTML文档
   */
  async generateHtmlDocs(outputPath = './docs/index.html') {
    // 这里可以使用swagger-ui-express或redoc来生成HTML
    // 由于依赖限制，这里只生成spec文件，用户可以使用Redoc CLI或Swagger UI自行生成
    logger.info('要生成HTML文档，请使用以下命令：');
    logger.info('1. 安装redoc-cli: npm install -g redoc-cli');
    logger.info(`2. 生成文档: redoc-cli bundle ./docs/api-spec.json -o ${outputPath}`);
    
    return {
      success: true,
      message: '请使用redoc-cli生成HTML文档'
    };
  }
}

// 创建单例实例
const apiDocGenerator = new ApiDocGenerator();

module.exports = {
  ApiDocGenerator,
  apiDocGenerator,
  generateDocs: () => apiDocGenerator.generateDocumentation()
};
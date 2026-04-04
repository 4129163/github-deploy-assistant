# GitHub Deploy Assistant Docker镜像
# 版本: 1.0.0

# 使用Node.js LTS版本作为基础镜像
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建运行阶段镜像
FROM node:18-alpine

# 安装必要的系统工具
RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    curl \
    tar \
    gzip \
    ca-certificates

# 创建非root用户
RUN addgroup -g 1001 -S gada && \
    adduser -S gada -u 1001 -G gada

# 设置工作目录
WORKDIR /app

# 从构建阶段复制依赖和源代码
COPY --from=builder --chown=gada:gada /app .

# 创建必要的目录并设置权限
RUN mkdir -p /workspace /app/logs /app/database && \
    chown -R gada:gada /workspace /app/logs /app/database && \
    chmod -R 755 /workspace /app/logs /app/database

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3456
ENV HOST=0.0.0.0
ENV WORK_DIR=/workspace
ENV ALLOW_AUTO_EXEC=true
ENV LOG_LEVEL=info

# 暴露端口
EXPOSE 3456

# 切换到非root用户
USER gada

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3456/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]
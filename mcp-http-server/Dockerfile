# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY mcp-http-server/package.json mcp-http-server/pnpm-lock.yaml ./

# 安装依赖（包括 devDependencies 用于构建）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY mcp-http-server/tsconfig.json ./
COPY mcp-http-server/src ./src

# 构建
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# 安装 curl 和 pnpm
RUN apk add --no-cache curl && \
    corepack enable && \
    corepack prepare pnpm@latest --activate

# 复制 package 文件
COPY mcp-http-server/package.json mcp-http-server/pnpm-lock.yaml ./

# 仅安装生产依赖
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# 从构建阶段复制编译后的文件
COPY --from=builder /app/dist ./dist

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "dist/index.js"]

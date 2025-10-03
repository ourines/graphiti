# Stage 1: Build
FROM python:3.11-slim AS builder

WORKDIR /app

# 安装 uv (快速 Python 包管理器)
RUN pip install --no-cache-dir uv

# 复制项目文件
COPY pyproject.toml uv.lock README.md ./
COPY graphiti_core ./graphiti_core
COPY server ./server

# 安装依赖（包括 Gemini 支持）
RUN uv sync --extra google-genai

# Stage 2: Production
FROM python:3.11-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# 复制项目和依赖（包含 .venv 虚拟环境）
COPY --from=builder /app /app

# 设置 Python 路径
ENV PYTHONPATH=/app
ENV PATH="/app/.venv/bin:$PATH"

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/healthcheck || exit 1

# 启动命令
CMD ["uvicorn", "server.graph_service.main:app", "--host", "0.0.0.0", "--port", "8000"]

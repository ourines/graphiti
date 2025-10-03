#!/bin/bash
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "GraphiTi API - 自动部署脚本"
echo "=========================================="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    echo "请先安装 Docker Compose"
    exit 1
fi

# 使用 docker compose 或 docker-compose
DOCKER_COMPOSE="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"
echo ""

# 检查 .env.prod 文件
if [ -f ".env.prod" ]; then
    echo -e "${YELLOW}⚠️  发现现有的 .env.prod 文件${NC}"
    read -p "是否使用现有配置？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        rm .env.prod
        echo "已删除现有配置"
    else
        echo "使用现有配置"
        source .env.prod
    fi
fi

# 创建或更新 .env.prod
if [ ! -f ".env.prod" ]; then
    echo "创建新的配置文件..."
    echo ""

    # 选择 LLM Provider
    echo "选择 LLM Provider:"
    echo "1) Gemini (默认，推荐)"
    echo "2) OpenAI"
    echo "3) Anthropic"
    echo "4) Groq"
    read -p "请选择 [1-4, 默认 1]: " llm_choice
    llm_choice=${llm_choice:-1}

    case $llm_choice in
        1)
            LLM_PROVIDER="gemini"
            read -p "请输入 Google API Key: " GOOGLE_API_KEY
            if [ -z "$GOOGLE_API_KEY" ]; then
                echo -e "${RED}❌ Google API Key 不能为空${NC}"
                exit 1
            fi
            read -p "请输入 Gemini 模型 [默认 gemini-2.5-flash]: " MODEL_NAME
            MODEL_NAME=${MODEL_NAME:-gemini-2.5-flash}
            ;;
        2)
            LLM_PROVIDER="openai"
            read -p "请输入 OpenAI API Key: " OPENAI_API_KEY
            if [ -z "$OPENAI_API_KEY" ]; then
                echo -e "${RED}❌ OpenAI API Key 不能为空${NC}"
                exit 1
            fi
            ;;
        3)
            LLM_PROVIDER="anthropic"
            read -p "请输入 Anthropic API Key: " ANTHROPIC_API_KEY
            if [ -z "$ANTHROPIC_API_KEY" ]; then
                echo -e "${RED}❌ Anthropic API Key 不能为空${NC}"
                exit 1
            fi
            echo ""
            echo -e "${YELLOW}注意：Anthropic provider 需要 OpenAI API Key 用于 embedding${NC}"
            read -p "请输入 OpenAI API Key (用于 embedding): " OPENAI_API_KEY
            if [ -z "$OPENAI_API_KEY" ]; then
                echo -e "${RED}❌ OpenAI API Key 不能为空${NC}"
                exit 1
            fi
            ;;
        4)
            LLM_PROVIDER="groq"
            read -p "请输入 Groq API Key: " GROQ_API_KEY
            if [ -z "$GROQ_API_KEY" ]; then
                echo -e "${RED}❌ Groq API Key 不能为空${NC}"
                exit 1
            fi
            echo ""
            echo -e "${YELLOW}注意：Groq provider 需要 OpenAI API Key 用于 embedding${NC}"
            read -p "请输入 OpenAI API Key (用于 embedding): " OPENAI_API_KEY
            if [ -z "$OPENAI_API_KEY" ]; then
                echo -e "${RED}❌ OpenAI API Key 不能为空${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}❌ 无效的选择${NC}"
            exit 1
            ;;
    esac

    # 生成随机 Neo4j 密码
    NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

    # 保存配置
    cat > .env.prod << EOF
# LLM Provider
LLM_PROVIDER=$LLM_PROVIDER

# Gemini 配置
GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
MODEL_NAME=${MODEL_NAME:-gemini-2.5-flash}
EMBEDDER_MODEL_NAME=${EMBEDDER_MODEL_NAME:-gemini-embedding-001}
MAX_TOKENS=64000

# OpenAI 配置（Anthropic/Groq 需要用于 embedding）
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_BASE_URL=${OPENAI_BASE_URL:-}
EMBEDDING_MODEL_NAME=${EMBEDDING_MODEL_NAME:-}

# Anthropic 配置
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}

# Groq 配置
GROQ_API_KEY=${GROQ_API_KEY:-}

# Neo4j
NEO4J_PASSWORD=$NEO4J_PASSWORD
EOF

    echo -e "${GREEN}✅ 配置文件已创建${NC}"
    echo ""
    echo -e "${YELLOW}重要：请保存以下信息${NC}"
    echo "----------------------------------------"
    echo "LLM Provider: $LLM_PROVIDER"
    echo "Neo4j 密码: $NEO4J_PASSWORD"
    echo "----------------------------------------"
    echo ""
    read -p "按回车键继续..."
else
    source .env.prod
fi

# 检查端口占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ 端口 $1 已被占用${NC}"
        echo "请停止占用该端口的进程，或修改配置使用其他端口"
        exit 1
    fi
}

echo "检查端口占用..."
check_port 7474
check_port 7687
check_port 8000
echo -e "${GREEN}✅ 所有端口可用${NC}"
echo ""

# 停止现有服务（如果有）
echo "停止现有服务（如果有）..."
$DOCKER_COMPOSE -f docker-compose.prod.yml down 2>/dev/null || true
echo ""

# 构建镜像
echo "构建 GraphiTi API 镜像..."
$DOCKER_COMPOSE -f docker-compose.prod.yml build --no-cache graphiti-api
echo -e "${GREEN}✅ 镜像构建完成${NC}"
echo ""

# 启动服务
echo "启动服务..."
$DOCKER_COMPOSE -f docker-compose.prod.yml --env-file .env.prod up -d --build
echo ""

# 等待服务启动
echo "等待服务启动..."
echo -n "进度: "

MAX_WAIT=120  # 最多等待 2 分钟
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # 检查所有服务健康状态
    HEALTHY=$($DOCKER_COMPOSE -f docker-compose.prod.yml ps | grep -c "healthy" || true)

    if [ "$HEALTHY" -eq 2 ]; then
        echo ""
        echo -e "${GREEN}✅ 所有服务已就绪${NC}"
        break
    fi

    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${YELLOW}⚠️  服务启动超时，请检查日志${NC}"
    echo ""
    echo "查看日志："
    echo "  $DOCKER_COMPOSE -f docker-compose.prod.yml logs"
fi

echo ""

# 验证服务
echo "=========================================="
echo "验证服务状态"
echo "=========================================="
echo ""

# Neo4j
if curl -s -f http://localhost:7474 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Neo4j 运行正常${NC}"
    echo "   URL: http://localhost:7474"
    echo "   用户名: neo4j"
    echo "   密码: $NEO4J_PASSWORD"
else
    echo -e "${RED}❌ Neo4j 未响应${NC}"
fi
echo ""

# GraphiTi API
if curl -s -f http://localhost:8000/healthcheck > /dev/null 2>&1; then
    echo -e "${GREEN}✅ GraphiTi API 运行正常${NC}"
    echo "   URL: http://localhost:8000"
    echo "   文档: http://localhost:8000/docs"
    echo "   LLM Provider: $LLM_PROVIDER"
else
    echo -e "${RED}❌ GraphiTi API 未响应${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "常用命令："
echo ""
echo "  查看服务状态:"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml ps"
echo ""
echo "  查看日志:"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f graphiti-api"
echo ""
echo "  重启服务:"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml restart"
echo ""
echo "  停止服务:"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml down"
echo ""
echo "  清理数据:"
echo "    $DOCKER_COMPOSE -f docker-compose.prod.yml down -v"
echo ""
echo "  更新服务:"
echo "    git pull && ./deploy.sh"
echo ""

# 客户端使用提示
echo "=========================================="
echo "客户端使用"
echo "=========================================="
echo ""
echo "Claude Desktop 配置 (~/.config/Claude/claude_desktop_config.json):"
echo ""
echo '{'
echo '  "mcpServers": {'
echo '    "graphiti": {'
echo '      "command": "npx",'
echo '      "args": ["-y", "@graphiti/mcp-http"],'
echo '      "env": {'
echo '        "GRAPHITI_API_URL": "http://your-server:8000"'
echo '      }'
echo '    }'
echo '  }'
echo '}'
echo ""

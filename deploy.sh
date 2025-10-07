#!/bin/bash
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "GraphiTi - 快速部署脚本"
echo "=========================================="
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
DOCKER_COMPOSE="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        echo -e "${RED}❌ Docker Compose 未安装${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"
echo ""

# 检查或创建 .env 文件
if [ ! -f ".env" ]; then
    echo "创建环境配置..."
    echo ""

    # 选择 LLM Provider
    echo "选择 LLM Provider:"
    echo "1) Gemini (推荐)"
    echo "2) OpenAI"
    echo "3) Anthropic"
    echo "4) Groq"
    read -p "请选择 [1-4, 默认 1]: " llm_choice
    llm_choice=${llm_choice:-1}

    case $llm_choice in
        1)
            LLM_PROVIDER="gemini"
            read -p "请输入 Google API Key: " GOOGLE_API_KEY
            [ -z "$GOOGLE_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            MODEL_NAME="gemini-2.5-flash"
            EMBEDDER_MODEL_NAME="gemini-embedding-001"
            ;;
        2)
            LLM_PROVIDER="openai"
            read -p "请输入 OpenAI API Key: " OPENAI_API_KEY
            [ -z "$OPENAI_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            ;;
        3)
            LLM_PROVIDER="anthropic"
            read -p "请输入 Anthropic API Key: " ANTHROPIC_API_KEY
            [ -z "$ANTHROPIC_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            echo -e "${YELLOW}注意：需要 OpenAI API Key 用于 embedding${NC}"
            read -p "请输入 OpenAI API Key: " OPENAI_API_KEY
            [ -z "$OPENAI_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            ;;
        4)
            LLM_PROVIDER="groq"
            read -p "请输入 Groq API Key: " GROQ_API_KEY
            [ -z "$GROQ_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            echo -e "${YELLOW}注意：需要 OpenAI API Key 用于 embedding${NC}"
            read -p "请输入 OpenAI API Key: " OPENAI_API_KEY
            [ -z "$OPENAI_API_KEY" ] && echo -e "${RED}❌ API Key 不能为空${NC}" && exit 1
            ;;
        *)
            echo -e "${RED}❌ 无效的选择${NC}"
            exit 1
            ;;
    esac

    # 生成随机 Neo4j 密码
    NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

    # 保存配置
    cat > .env << EOF
# LLM Provider
LLM_PROVIDER=${LLM_PROVIDER}

# API Keys
GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
GROQ_API_KEY=${GROQ_API_KEY:-}

# Model Config
MODEL_NAME=${MODEL_NAME:-gemini-2.5-flash}
EMBEDDER_MODEL_NAME=${EMBEDDER_MODEL_NAME:-gemini-embedding-001}
MAX_TOKENS=64000

# Neo4j
NEO4J_PASSWORD=${NEO4J_PASSWORD}
EOF

    echo -e "${GREEN}✅ 配置文件已创建${NC}"
    echo ""
    echo -e "${YELLOW}请保存 Neo4j 密码: ${NEO4J_PASSWORD}${NC}"
    echo ""
else
    source .env
    echo -e "${GREEN}✅ 使用现有配置${NC}"
    echo ""
fi

# 停止现有服务
echo "停止现有服务..."
$DOCKER_COMPOSE down 2>/dev/null || true

# 启动服务
echo "启动服务..."
$DOCKER_COMPOSE up -d --build

# 等待服务就绪
echo ""
echo "等待服务启动..."
MAX_WAIT=60
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s -f http://localhost:8000/healthcheck > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${YELLOW}⚠️  服务启动超时${NC}"
    echo "查看日志: $DOCKER_COMPOSE logs -f"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ 部署完成${NC}"
echo "=========================================="
echo ""
echo "服务地址:"
echo "  MCP HTTP Server: http://localhost:3100"
echo "  GraphiTi API: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo "  Neo4j 浏览器: http://localhost:7474"
echo ""
echo "Neo4j 登录:"
echo "  用户名: neo4j"
echo "  密码: ${NEO4J_PASSWORD}"
echo ""
echo "MCP 端点:"
echo "  POST /mcp - MCP protocol endpoint"
echo "  GET /health - Health check"
echo "  GET /debug/tools - List tools"
echo ""
echo "常用命令:"
echo "  查看日志: $DOCKER_COMPOSE logs -f"
echo "  重启服务: $DOCKER_COMPOSE restart"
echo "  停止服务: $DOCKER_COMPOSE down"
echo "  清理数据: $DOCKER_COMPOSE down -v"
echo ""

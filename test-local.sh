#!/bin/bash
set -e

echo "=========================================="
echo "GraphiTi 本地测试脚本"
echo "=========================================="
echo ""

# 检测是否有 .env.prod
if [ ! -f ".env.prod" ]; then
    echo "⚠️  未找到 .env.prod，创建测试配置..."

    # 提示用户输入 Google API Key
    read -p "请输入 Google API Key (用于测试): " GOOGLE_API_KEY

    if [ -z "$GOOGLE_API_KEY" ]; then
        echo "❌ Google API Key 不能为空"
        exit 1
    fi

    # 生成随机 Neo4j 密码
    NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

    # 创建 .env.prod
    cat > .env.prod << EOF
LLM_PROVIDER=gemini
GOOGLE_API_KEY=$GOOGLE_API_KEY
MODEL_NAME=gemini-2.5-flash
EMBEDDER_MODEL_NAME=gemini-embedding-001
MAX_TOKENS=64000
OPENAI_API_KEY=
NEO4J_PASSWORD=$NEO4J_PASSWORD
EOF

    echo "✅ 已创建 .env.prod"
    echo "Neo4j 密码: $NEO4J_PASSWORD"
    echo ""
fi

# 加载环境变量
source .env.prod

echo "🚀 启动服务..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo ""
echo "⏳ 等待服务启动（最多 60 秒）..."
sleep 5

MAX_WAIT=60
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s -f http://localhost:8000/healthcheck > /dev/null 2>&1; then
        echo ""
        echo "✅ GraphiTi API 已就绪"
        break
    fi

    echo -n "."
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo "❌ 服务启动超时"
    echo "查看日志："
    echo "  docker-compose -f docker-compose.prod.yml logs graphiti-api"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 服务启动成功！"
echo "=========================================="
echo ""
echo "GraphiTi API: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo "Neo4j 浏览器: http://localhost:7474"
echo "  用户名: neo4j"
echo "  密码: $NEO4J_PASSWORD"
echo ""
echo "=========================================="
echo "测试步骤："
echo "=========================================="
echo ""
echo "1. 测试 API 健康状态："
echo "   curl http://localhost:8000/healthcheck"
echo ""
echo "2. 测试 mcp-http-server 连接："
echo "   cd mcp-http-server"
echo "   GRAPHITI_API_URL=http://localhost:8000 pnpm dev"
echo ""
echo "3. 集成到 Claude Desktop："
echo "   编辑 ~/.config/Claude/claude_desktop_config.json"
echo "   添加配置（见文档）"
echo ""

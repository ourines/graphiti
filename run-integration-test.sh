#!/bin/bash

echo "========================================="
echo "GraphiTi 全流程集成测试"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $1${NC}"
        ((TESTS_FAILED++))
    fi
}

# 1. 检查环境变量
echo -e "${BLUE}1. 检查环境变量${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env文件存在${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ .env文件不存在，将使用.env.example${NC}"
    if [ -f ".env.example" ]; then
        echo "提示: 请复制.env.example到.env并填入实际值"
    fi
fi
echo ""

# 2. 检查Docker
echo -e "${BLUE}2. 检查Docker环境${NC}"
docker --version > /dev/null 2>&1
check_result "Docker已安装"

docker-compose --version > /dev/null 2>&1
check_result "Docker Compose已安装"
echo ""

# 3. 构建MCP服务器
echo -e "${BLUE}3. 构建MCP HTTP服务器${NC}"
cd mcp-http-server
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ package.json不存在${NC}"
    exit 1
fi

echo "安装依赖..."
pnpm install --frozen-lockfile > /dev/null 2>&1
check_result "依赖安装"

echo "构建TypeScript..."
pnpm exec tsc > /dev/null 2>&1
check_result "TypeScript编译"

cd ..
echo ""

# 4. 启动Docker服务
echo -e "${BLUE}4. 启动Docker Compose服务${NC}"
echo "这可能需要几分钟..."
docker-compose up -d
check_result "Docker服务启动"
echo ""

# 5. 等待服务就绪
echo -e "${BLUE}5. 等待服务就绪${NC}"
echo "等待30秒让服务完全启动..."
for i in {30..1}; do
    echo -ne "\r剩余 $i 秒...  "
    sleep 1
done
echo -e "\r${GREEN}✓ 等待完成${NC}        "
((TESTS_PASSED++))
echo ""

# 6. 检查服务健康状态
echo -e "${BLUE}6. 检查服务健康状态${NC}"

echo "检查Neo4j..."
curl -s http://localhost:7474 > /dev/null 2>&1
check_result "Neo4j (7474端口)"

echo "检查GraphiTi API..."
curl -s http://localhost:8000/healthcheck > /dev/null 2>&1
check_result "GraphiTi API (8000端口)"

echo "检查MCP HTTP服务器..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ MCP HTTP服务器 (3000端口)${NC}"
    ((TESTS_PASSED++))
    echo "  传输协议: $(echo $HEALTH_RESPONSE | jq -r '.server.transport')"
    echo "  活跃连接: $(echo $HEALTH_RESPONSE | jq -r '.server.activeConnections')"
else
    echo -e "${RED}✗ MCP HTTP服务器 (3000端口)${NC}"
    ((TESTS_FAILED++))
fi
echo ""

# 7. 测试MCP端点
echo -e "${BLUE}7. 测试MCP协议端点${NC}"

echo "测试工具列表（不带token）..."
RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')

if echo "$RESPONSE" | grep -q '"tools"'; then
    echo -e "${GREEN}✓ tools/list成功${NC}"
    TOOL_COUNT=$(echo "$RESPONSE" | jq -r '.result.tools | length')
    echo "  工具数量: $TOOL_COUNT"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ tools/list失败${NC}"
    echo "  响应: $RESPONSE"
    ((TESTS_FAILED++))
fi
echo ""

# 8. 测试Debug端点
echo -e "${BLUE}8. 测试Debug端点${NC}"
curl -s http://localhost:3000/debug/tools | jq -e '.tools' > /dev/null 2>&1
check_result "Debug工具列表端点"
echo ""

# 9. 检查Docker日志
echo -e "${BLUE}9. 检查Docker服务日志${NC}"
echo "MCP服务器最近10行日志:"
echo -e "${YELLOW}"
docker-compose logs --tail=10 mcp-http-server 2>&1 | grep -v "command not found" | tail -5
echo -e "${NC}"
echo ""

# 10. 显示服务状态
echo -e "${BLUE}10. Docker服务状态${NC}"
docker-compose ps
echo ""

# Summary
echo "========================================="
echo -e "${BLUE}测试总结${NC}"
echo "========================================="
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    echo ""
    echo "服务已启动并运行正常:"
    echo "  • Neo4j: http://localhost:7474"
    echo "  • GraphiTi API: http://localhost:8000"
    echo "  • MCP HTTP: http://localhost:3000"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    echo ""
    echo "故障排查步骤:"
    echo "  1. 检查Docker日志: docker-compose logs"
    echo "  2. 检查.env配置文件"
    echo "  3. 确认端口未被占用: lsof -i :3000,8000,7474"
    echo ""
    echo "清理并重试: docker-compose down && docker-compose up -d"
    exit 1
fi

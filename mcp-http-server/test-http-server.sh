#!/bin/bash

echo "======================================"
echo "MCP HTTP Server 测试"
echo "======================================"
echo ""

# 检查服务是否运行
echo "✅ 检查服务状态..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "   ✓ 服务正在运行"
else
    echo "   ✗ 服务未运行"
    echo ""
    echo "启动服务:"
    echo "  export MCP_TRANSPORT=http"
    echo "  export GRAPHITI_API_URL=http://localhost:8000"
    echo "  export GRAPHITI_API_TOKEN=your-token"
    echo "  node dist/index.js"
    exit 1
fi
echo ""

# 测试健康检查
echo "✅ 测试健康检查..."
HEALTH=$(curl -s http://localhost:3000/health)
echo "$HEALTH" | jq '.'
echo ""

# 测试工具列表
echo "✅ 测试工具列表..."
TOOL_COUNT=$(curl -s http://localhost:3000/debug/tools | jq -r '.tools | length')
echo "   $TOOL_COUNT 个工具可用"
echo ""

# 测试MCP协议
echo "✅ 测试MCP协议..."
echo "   发送 tools/list 请求"
MCP_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')

if echo "$MCP_RESPONSE" | jq -e '.result.tools' > /dev/null 2>&1; then
    echo "   ✓ MCP协议正常工作"
else
    echo "   ✗ MCP协议响应异常"
    echo "$MCP_RESPONSE" | jq '.'
fi
echo ""

echo ""
echo "======================================"
echo "测试完成!"
echo "======================================"
echo ""
echo "可用端点:"
echo "  POST http://localhost:3000/mcp         - MCP协议端点 (Streamable HTTP)"
echo "  GET  http://localhost:3000/health      - 健康检查"
echo "  GET  http://localhost:3000/debug/tools - 工具列表"
echo ""
echo "传输协议: Streamable HTTP (MCP SDK 1.19.1+)"
echo ""

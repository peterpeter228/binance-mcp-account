#!/bin/bash

# 测试修复后的 Streamable HTTP 模式

echo "🚀 启动 Binance MCP Server - Streamable HTTP 模式（修复版）"
echo "========================================================"

# 设置环境变量
export SERVER_MODE=streamable-http
export PORT=3000
export HOST=0.0.0.0
export BINANCE_API_KEY=${BINANCE_API_KEY:-"test_api_key"}
export BINANCE_SECRET_KEY=${BINANCE_SECRET_KEY:-"test_api_secret"}
export BINANCE_TESTNET=true
export LOG_LEVEL=debug

echo "配置信息:"
echo "  模式: $SERVER_MODE"
echo "  端口: $PORT"
echo "  主机: $HOST"
echo "  API Key: ${BINANCE_API_KEY:0:8}..."
echo "  测试网: $BINANCE_TESTNET"
echo "  日志级别: $LOG_LEVEL"
echo ""

# 启动服务器
echo "启动服务器..."
node build/server.js &
SERVER_PID=$!

# 等待服务器启动
echo "等待服务器启动..."
sleep 3

# 运行测试
echo "运行测试..."
node test-simple-streamable-http.js

# 停止服务器
echo "停止服务器..."
kill $SERVER_PID

echo "测试完成！"

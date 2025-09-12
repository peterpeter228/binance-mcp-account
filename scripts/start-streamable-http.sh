#!/bin/bash

# 测试 Streamable HTTP 模式启动脚本

echo "🚀 启动 Binance MCP Server - Streamable HTTP 模式"
echo "================================================"

# 设置环境变量
export SERVER_MODE=streamable-http
export PORT=3000
export HOST=0.0.0.0
export BINANCE_API_KEY=${BINANCE_API_KEY:-"test_api_key"}
export BINANCE_SECRET_KEY=${BINANCE_SECRET_KEY:-"test_api_secret"}
export BINANCE_TESTNET=true

echo "配置信息:"
echo "  模式: $SERVER_MODE"
echo "  端口: $PORT"
echo "  主机: $HOST"
echo "  API Key: ${BINANCE_API_KEY:0:8}..."
echo "  测试网: $BINANCE_TESTNET"
echo ""

# 启动服务器
echo "启动服务器..."
node build/server.js

echo ""
echo "服务器已停止"

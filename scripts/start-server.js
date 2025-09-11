#!/usr/bin/env node

import { app } from '../build/server.js';
import { logger } from '../build/utils/logger.js';

// 全局注册工具（只注册一次）
import { registerGlobalTools, registerToolListHandler } from '../build/server.js';

// 注册工具和工具列表处理器
registerGlobalTools();
registerToolListHandler();

const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  logger.info(`🚀 Binance MCP 服务器启动成功`);
  logger.info(`📍 服务地址: http://${host}:${port}`);
  logger.info(`🔗 Streamable HTTP 端点: http://${host}:${port}/mcp`);
  logger.info(`🔗 SSE 端点: http://${host}:${port}/sse`);
  logger.info(`🔗 健康检查: http://${host}:${port}/health`);
  logger.info('');
  logger.info('💡 使用说明:');
  logger.info('1. 在请求头中添加 Authorization: {apiKey}:{secret}');
  logger.info('2. 支持 Bearer token 格式: Authorization: Bearer {apiKey}:{secret}');
  logger.info('3. 现代客户端推荐使用 /mcp 端点（Streamable HTTP）');
  logger.info('4. 旧客户端可使用 /sse 端点（SSE）');
  logger.info('');
  logger.info('🔧 MCP Inspector 调试配置:');
  logger.info('传输类型: SSE');
  logger.info(`URL: http://${host}:${port}/sse`);
  logger.info('认证: Authorization: {apiKey}:{secret}');
});

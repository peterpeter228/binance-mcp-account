#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as dotenv from 'dotenv';

import { createMcpServer, createToolRuntime } from './server/mcp_server.js';
import { logger } from './utils/logger.js';

// 加载环境变量
dotenv.config();

// 服务器模式
const serverMode = process.env.SERVER_MODE || 'stdio';

async function main() {
  logger.info(`启动Binance MCP服务器 - 模式: ${serverMode}`);

  if (serverMode === 'stdio') {
    await startStdioServer();
    return;
  }

  const { startHttpServer } = await import('./server.js');
  await startHttpServer();
}

async function startStdioServer() {
  const requiredEnvVars = ['BINANCE_API_KEY', 'BINANCE_SECRET_KEY'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`缺少必要的环境变量: ${envVar}`);
      logger.error('请在Claude Desktop配置文件中设置API密钥');
      process.exit(1);
    }
  }

  const credentials = {
    apiKey: process.env.BINANCE_API_KEY!,
    apiSecret: process.env.BINANCE_SECRET_KEY!,
    testnet: process.env.BINANCE_TESTNET === 'true',
  };

  try {
    const runtime = createToolRuntime(credentials);
    const server = createMcpServer(runtime);
    const transport = new StdioServerTransport();

    await server.connect(transport);
    logger.info('Binance MCP服务器已启动 (stdio模式)');
  } catch (error) {
    logger.error('初始化Binance客户端失败:', error);
    process.exit(1);
  }
}

// 启动服务器
main().catch((error) => {
  logger.error('服务器启动失败:', error);
  process.exit(1);
});

#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

import { BinanceClient } from './api/client.js';
import { logger } from './utils/logger.js';
import { createAccountTools, handleAccountTool } from './tools/account.js';
import { createSpotTools, handleSpotTool } from './tools/spot.js';
import { createFuturesTools, handleFuturesTool } from './tools/futures.js';
import { createMarketTools, handleMarketTool } from './tools/market.js';
import { createAdvancedTools, handleAdvancedTool } from './tools/advanced.js';

// 加载环境变量
dotenv.config();

// 服务器模式
const serverMode = process.env.SERVER_MODE || 'stdio';

// 获取所有工具
function getAllTools(binanceClient: BinanceClient) {
  return [
    ...createAccountTools(binanceClient),
    ...createSpotTools(binanceClient),
    ...createFuturesTools(binanceClient),
    ...createMarketTools(binanceClient),
    ...createAdvancedTools(binanceClient),
  ];
}

// 处理工具调用
async function handleTool(name: string, args: any, binanceClient: BinanceClient) {
  try {
    // 账户管理工具
    if (
      name.startsWith('binance_account') ||
      name === 'binance_spot_balances' ||
      name === 'binance_portfolio_account' ||
      name === 'binance_futures_positions'
    ) {
      return await handleAccountTool(name, args, binanceClient);
    }

    // 现货交易工具
    if (
      name.startsWith('binance_spot_') &&
      !name.includes('price') &&
      !name.includes('orderbook') &&
      !name.includes('klines') &&
      !name.includes('24hr_ticker')
    ) {
      return await handleSpotTool(name, args, binanceClient);
    }

    // 合约交易工具
    if (
      name.startsWith('binance_futures_') &&
      !name.includes('price') &&
      !name.includes('klines') &&
      !name.includes('24hr_ticker')
    ) {
      return await handleFuturesTool(name, args, binanceClient);
    }

    // 市场数据工具
    if (
      name.includes('price') ||
      name.includes('orderbook') ||
      name.includes('klines') ||
      name.includes('24hr_ticker') ||
      name.includes('exchange_info') ||
      name.includes('server_time')
    ) {
      return await handleMarketTool(name, args, binanceClient);
    }

    // 高级分析工具
    if (
      name.startsWith('binance_calculate_') ||
      name.startsWith('binance_analyze_') ||
      name.startsWith('binance_compare_') ||
      name.startsWith('binance_check_') ||
      name.startsWith('binance_get_')
    ) {
      return await handleAdvancedTool(name, args, binanceClient);
    }

    throw new McpError(ErrorCode.MethodNotFound, `未知的工具: ${name}`);
  } catch (error) {
    logger.error(`工具调用失败 ${name}:`, error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `工具执行失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main() {
  logger.info(`启动Binance MCP服务器 - 模式: ${serverMode}`);

  if (serverMode === 'stdio') {
    // stdio模式
    await startStdioServer();
  } else if (serverMode === 'sse' || serverMode === 'streamable-http') {
    // HTTP模式 - 导入并启动HTTP服务器
    const { startHttpServer } = await import('./server.js');
    await startHttpServer();
  } else {
    logger.error(`不支持的服务器模式: ${serverMode}`);
    logger.error('支持的模式: stdio, sse, streamable-http');
    process.exit(1);
  }
}

async function startStdioServer() {
  // 验证必要的环境变量
  const requiredEnvVars = ['BINANCE_API_KEY', 'BINANCE_SECRET_KEY'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`缺少必要的环境变量: ${envVar}`);
      logger.error('请在Claude Desktop配置文件中设置API密钥');
      process.exit(1);
    }
  }

  // 初始化Binance客户端
  const binanceConfig = {
    apiKey: process.env.BINANCE_API_KEY!,
    apiSecret: process.env.BINANCE_SECRET_KEY!,
    testnet: process.env.BINANCE_TESTNET === 'true',
  };

  let binanceClient: BinanceClient;
  try {
    binanceClient = new BinanceClient(binanceConfig);
    logger.info('Binance客户端初始化成功');
  } catch (error) {
    logger.error('初始化Binance客户端失败:', error);
    process.exit(1);
  }

  // 创建MCP服务器
  const server = new Server(
    {
      name: 'binance-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    try {
      const tools = getAllTools(binanceClient);
      logger.info(`返回 ${tools.length} 个可用工具`);
      return { tools };
    } catch (error) {
      logger.error('获取工具列表失败:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `获取工具列表失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      logger.info(`执行工具: ${request.params.name}`, request.params.arguments);
      const result = await handleTool(request.params.name, request.params.arguments, binanceClient);

      // 统一处理结果格式转换
      if (result && typeof result === 'object') {
        // 如果已经是MCP格式，直接返回
        if (result.content && Array.isArray(result.content)) {
          return result;
        }

        // 如果是自定义格式 {success: true, data: ...}，转换为MCP格式
        if (result.success && result.data !== undefined) {
          return {
            content: [
              {
                type: 'text',
                text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
              },
            ],
          };
        }

        // 如果是其他格式，尝试转换为文本
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // 如果结果为空或无效，返回错误信息
      return {
        content: [
          {
            type: 'text',
            text: '工具执行完成，但未返回有效结果',
          },
        ],
      };
    } catch (error) {
      logger.error(`工具调用失败 ${request.params.name}:`, error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `工具执行失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  // 启动stdio传输
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Binance MCP服务器已启动 (stdio模式)');
}

// 启动服务器
main().catch((error) => {
  logger.error('服务器启动失败:', error);
  process.exit(1);
});

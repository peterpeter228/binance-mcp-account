import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'node:events';

import { BinanceClient } from '../api/client.js';
import { createAdvancedTools, handleAdvancedTool } from '../tools/advanced.js';
import { createAccountTools, handleAccountTool } from '../tools/account.js';
import { createFuturesTools, handleFuturesTool } from '../tools/futures.js';
import { createMarketTools, handleMarketTool } from '../tools/market.js';
import { createSpotTools, handleSpotTool } from '../tools/spot.js';
import { AuthTokenHandler, BinanceCredentials } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

export type McpEventType = 'health' | 'cache' | 'provider-switch';

export interface McpEvent {
  type: McpEventType;
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface McpEventBus extends EventEmitter {
  on(event: 'event', listener: (event: McpEvent) => void): this;
  off(event: 'event', listener: (event: McpEvent) => void): this;
  emit(event: 'event', eventPayload: McpEvent): boolean;
}

export type ToolRuntimeCredentials = BinanceCredentials & { testnet?: boolean };

export interface ToolRuntime {
  binanceClient: BinanceClient;
  listTools: () => Promise<ReturnType<typeof createAccountTools>>;
  callTool: (name: string, args: unknown) => Promise<any>;
}

export function createEventBus(): McpEventBus {
  return new EventEmitter() as McpEventBus;
}

export function broadcastEvent(bus: McpEventBus, event: McpEvent) {
  const payload: McpEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  bus.emit('event', payload);
  logger.debug(`Emitted MCP event: ${payload.type}`, payload);
}

export function createToolRuntime(credentials: ToolRuntimeCredentials): ToolRuntime {
  const binanceClient = new BinanceClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    testnet: credentials.testnet ?? process.env.BINANCE_TESTNET === 'true',
  });

  return {
    binanceClient,
    listTools: async () => getAllTools(binanceClient),
    callTool: async (name: string, args: unknown) => normalizeToolResult(await handleTool(name, args, binanceClient)),
  };
}

export function createToolRuntimeFromToken(token: string, options?: { testnet?: boolean }): ToolRuntime {
  const credentials = AuthTokenHandler.parseCredentials(token);

  if (!credentials) {
    throw new McpError(ErrorCode.InvalidRequest, 'Invalid authorization token format. Expected apiKey:apiSecret');
  }

  return createToolRuntime({ ...credentials, testnet: options?.testnet });
}

export function createMcpServer(runtime: ToolRuntime) {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await runtime.listTools();
    logger.info(`返回 ${tools.length} 个可用工具`);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.info(`执行工具: ${request.params.name}`, request.params.arguments);
    return runtime.callTool(request.params.name, request.params.arguments);
  });

  return server;
}

function getAllTools(binanceClient: BinanceClient) {
  return [
    ...createAccountTools(binanceClient),
    ...createSpotTools(binanceClient),
    ...createFuturesTools(binanceClient),
    ...createMarketTools(binanceClient),
    ...createAdvancedTools(binanceClient),
  ];
}

async function handleTool(name: string, args: any, binanceClient: BinanceClient) {
  try {
    if (
      name.startsWith('binance_account') ||
      name === 'binance_spot_balances' ||
      name === 'binance_portfolio_account' ||
      name === 'binance_futures_positions'
    ) {
      return await handleAccountTool(name, args, binanceClient);
    }

    if (
      name.startsWith('binance_spot_') &&
      !name.includes('price') &&
      !name.includes('orderbook') &&
      !name.includes('klines') &&
      !name.includes('24hr_ticker')
    ) {
      return await handleSpotTool(name, args, binanceClient);
    }

    if (name.startsWith('binance_futures_') && !name.includes('price') && !name.includes('klines') && !name.includes('24hr_ticker')) {
      return await handleFuturesTool(name, args, binanceClient);
    }

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

function normalizeToolResult(result: any) {
  if (result && typeof result === 'object') {
    if (result.content && Array.isArray(result.content)) {
      return result;
    }

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

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: '工具执行完成，但未返回有效结果',
      },
    ],
  };
}

#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import http from 'node:http';
import * as url from 'node:url';

import { BinanceClient } from '../api/client.js';
import { AuthTokenHandler, BinanceCredentials } from '../utils/auth.js';
import { createAccountTools, handleAccountTool } from '../tools/account.js';
import { createSpotTools, handleSpotTool } from '../tools/spot.js';
import { createFuturesTools, handleFuturesTool } from '../tools/futures.js';
import { createMarketTools, handleMarketTool } from '../tools/market.js';
import { createAdvancedTools, handleAdvancedTool } from '../tools/advanced.js';
import { env } from '../infra/env.js';
import { logger } from '../infra/logger.js';

const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

function collectTools(binanceClient: BinanceClient) {
  return [
    ...createAccountTools(binanceClient),
    ...createSpotTools(binanceClient),
    ...createFuturesTools(binanceClient),
    ...createMarketTools(binanceClient),
    ...createAdvancedTools(binanceClient),
  ];
}

async function routeTool(name: string, args: any, binanceClient: BinanceClient) {
  if (
    name.startsWith('binance_account') ||
    name === 'binance_spot_balances' ||
    name === 'binance_portfolio_account' ||
    name === 'binance_futures_positions'
  ) {
    return handleAccountTool(name, args, binanceClient);
  }

  if (
    name.startsWith('binance_spot_') &&
    !name.includes('price') &&
    !name.includes('orderbook') &&
    !name.includes('klines') &&
    !name.includes('24hr_ticker')
  ) {
    return handleSpotTool(name, args, binanceClient);
  }

  if (
    name.startsWith('binance_futures_') &&
    !name.includes('price') &&
    !name.includes('klines') &&
    !name.includes('24hr_ticker')
  ) {
    return handleFuturesTool(name, args, binanceClient);
  }

  if (
    name.includes('price') ||
    name.includes('orderbook') ||
    name.includes('klines') ||
    name.includes('24hr_ticker') ||
    name.includes('exchange_info') ||
    name.includes('server_time')
  ) {
    return handleMarketTool(name, args, binanceClient);
  }

  if (
    name.startsWith('binance_calculate_') ||
    name.startsWith('binance_analyze_') ||
    name.startsWith('binance_compare_') ||
    name.startsWith('binance_check_') ||
    name.startsWith('binance_get_')
  ) {
    return handleAdvancedTool(name, args, binanceClient);
  }

  throw new Error(`Unknown tool requested: ${name}`);
}

function normalizeResult(result: any) {
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
        text: 'Tool execution completed without a result payload',
      },
    ],
  };
}

function createMcpServer(credentials: BinanceCredentials) {
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

  const binanceClient = new BinanceClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    testnet: env.binance.testnet,
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = collectTools(binanceClient);
    logger.info(`Serving ${tools.length} tools`);
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    logger.info(`Executing tool: ${request.params.name}`);
    const result = await routeTool(request.params.name, request.params.arguments, binanceClient);
    return normalizeResult(result);
  });

  return server;
}

function parseCredentials(authHeader: string | undefined) {
  if (!authHeader) {
    throw new Error('Unauthorized: Missing authorization token');
  }

  const credentials = AuthTokenHandler.parseCredentials(authHeader);
  if (!credentials) {
    throw new Error('Unauthorized: Invalid authorization token format. Expected apiKey:apiSecret');
  }

  return credentials;
}

function applyCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Testnet, mcp-session-id');
}

async function readJsonBody(req: http.IncomingMessage) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch (error) {
    logger.error('Failed to parse JSON body', error);
    throw new Error('Invalid JSON payload');
  }
}

async function handleSseConnection(req: http.IncomingMessage, res: http.ServerResponse, credentials: BinanceCredentials) {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;

  res.on('close', () => {
    delete transports[transport.sessionId];
  });

  const server = createMcpServer(credentials);
  await server.connect(transport);
}

async function handleSseMessage(req: http.IncomingMessage, res: http.ServerResponse) {
  const parsedUrl = url.parse(req.url || '', true);
  const sessionId = parsedUrl.query.sessionId as string;
  const transport = transports[sessionId];

  if (!transport || !(transport instanceof SSEServerTransport)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'No transport found for sessionId' }));
    return;
  }

  const payload = await readJsonBody(req);
  await transport.handlePostMessage(req, res, payload);
}

async function handleStreamableHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  credentials: BinanceCredentials,
) {
  const payload = await readJsonBody(req);
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports[sessionId] instanceof StreamableHTTPServerTransport) {
    await (transports[sessionId] as StreamableHTTPServerTransport).handleRequest(req, res, payload);
    return;
  }

  if (!sessionId && isInitializeRequest(payload)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `streamable_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      onsessioninitialized: async (newSessionId) => {
        const server = createMcpServer(credentials);
        transports[newSessionId] = transport;
        await server.connect(transport);
      },
      onsessionclosed: (closedSessionId) => {
        delete transports[closedSessionId];
      },
    });

    await transport.handleRequest(req, res, payload);
    return;
  }

  res.writeHead(400);
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request: missing or stale session',
      },
      id: payload?.id ?? null,
    }),
  );
}

export async function startHttpServer() {
  const configuredMode = env.server.mode || 'streamable-http';
  const serverMode = configuredMode === 'stdio' ? 'streamable-http' : configuredMode;
  const port = env.server.port;
  const host = env.server.host;

  logger.info(`Launching Binance MCP server`, { mode: serverMode, host, port });

  const httpServer = http.createServer(async (req, res) => {
    applyCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const isSseMessage = req.method === 'POST' && req.url?.startsWith('/messages');
      if (isSseMessage) {
        if (serverMode === 'sse' || serverMode === 'multi-mode') {
          await handleSseMessage(req, res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
        return;
      }

      const credentials = parseCredentials(req.headers.authorization as string | undefined);
      const wantsSse = req.url === '/sse';

      if (serverMode === 'sse' && wantsSse) {
        if (req.method === 'GET' && req.url === '/sse') {
          await handleSseConnection(req, res, credentials);
          return;
        }

        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
      }

      if (serverMode === 'multi-mode') {
        if (req.method === 'GET' && req.url === '/sse') {
          await handleSseConnection(req, res, credentials);
          return;
        }

        if (req.url === '/mcp') {
          await handleStreamableHttp(req, res, credentials);
          return;
        }
      }

      if (serverMode === 'streamable-http' && req.url === '/mcp') {
        await handleStreamableHttp(req, res, credentials);
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    } catch (error) {
      logger.error('Request handling failed', error);
      if (!res.headersSent) {
        res.writeHead(401);
        res.end(
          typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unauthorized request received',
        );
      }
    }
  });

  httpServer.listen(port, host, () => {
    logger.info('HTTP transports ready', {
      mode: serverMode,
      host,
      port,
      paths: serverMode === 'streamable-http' ? ['/mcp'] : ['/sse', '/messages', '/mcp'],
    });
  });
}

process.on('SIGINT', async () => {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId].close?.();
    } catch (error) {
      logger.error(`Failed to close transport ${sessionId}`, error);
    }
  }

  process.exit(0);
});

const isDirectExecution = process.argv[1] === url.fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startHttpServer().catch((error) => {
    logger.error('MCP HTTP server failed to start', error);
    process.exit(1);
  });
}

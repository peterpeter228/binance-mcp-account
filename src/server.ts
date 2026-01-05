#!/usr/bin/env node

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import * as http from 'node:http';
import * as url from 'node:url';

import { broadcastEvent, createEventBus, createMcpServer, createToolRuntime } from './server/mcp_server.js';
import { registerMcpRoutes } from './server/routes.js';
import { AuthTokenHandler } from './utils/auth.js';
import { logger } from './utils/logger.js';

type Transport = SSEServerTransport | StreamableHTTPServerTransport;

const transports: Record<string, Transport> = {};
const eventBus = createEventBus();

function resolveCredentials(authHeader: string | undefined) {
  if (!authHeader) {
    throw new Error('Unauthorized: Missing authorization token');
  }

  const credentials = AuthTokenHandler.parseCredentials(authHeader);
  if (!credentials) {
    throw new Error('Unauthorized: Invalid authorization token format. Expected apiKey:apiSecret');
  }

  return credentials;
}

function setCors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Testnet, mcp-session-id');
}

async function parseJsonBody(req: http.IncomingMessage) {
  let body = '';

  for await (const chunk of req) {
    body += chunk.toString();
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

async function startRestServer(port: number, host: string) {
  const app = express();

  app.use((req, res, next) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  registerMcpRoutes(app, eventBus);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      logger.info(`HTTP MCP server listening at http://${host}:${port}`);
      resolve();
    });
  });
}

async function startSseTransportServer(port: number, host: string) {
  const httpServer = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/sse') {
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
      }

      try {
        const credentials = resolveCredentials(req.headers.authorization);

        const transport = new SSEServerTransport('/messages', res);
        transports[transport.sessionId] = transport;

        res.on('close', () => {
          delete transports[transport.sessionId];
        });

        const runtime = createToolRuntime(credentials);
        const server = createMcpServer(runtime);
        await server.connect(transport);
      } catch (error) {
        logger.error('SSE connection failed', error);
        res.writeHead(401);
        res.end((error as Error).message);
      }
      return;
    }

    if (req.url?.startsWith('/messages')) {
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const sessionId = parsedUrl.query.sessionId as string;
      const transport = transports[sessionId] as SSEServerTransport | undefined;

      if (!transport) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'No transport found for sessionId' }));
        return;
      }

      try {
        const body = await parseJsonBody(req);
        await transport.handlePostMessage(req, res, body);
      } catch (error) {
        logger.error('Failed to process SSE message', error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      logger.info(`SSE MCP server listening at http://${host}:${port}/sse`);
      resolve();
    });
  });
}

async function startStreamableHttpServer(port: number, host: string) {
  const httpServer = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url !== '/mcp') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    try {
      const body = await parseJsonBody(req);
      const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
      const authHeader = req.headers.authorization;

      if (sessionIdHeader && transports[sessionIdHeader]) {
        await (transports[sessionIdHeader] as StreamableHTTPServerTransport).handleRequest(req, res, body);
        return;
      }

      if (!isInitializeRequest(body)) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: body?.id ?? null,
          }),
        );
        return;
      }

      const credentials = resolveCredentials(authHeader);
      const runtime = createToolRuntime(credentials);
      const server = createMcpServer(runtime);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `streamable_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        onsessioninitialized: async (sessionId) => {
          transports[sessionId] = transport;
          await server.connect(transport);
        },
        onsessionclosed: (sessionId) => {
          delete transports[sessionId];
        },
      });

      await transport.handleRequest(req, res, body);
    } catch (error) {
      logger.error('Streamable HTTP request failed', error);
      res.writeHead(500);
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        }),
      );
    }
  });

  return new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      logger.info(`Streamable HTTP MCP server listening at http://${host}:${port}/mcp`);
      resolve();
    });
  });
}

export async function startHttpServer() {
  const serverMode = process.env.SERVER_MODE || 'http';
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  logger.info(`启动Binance MCP服务器 - 模式: ${serverMode}, 端口: ${port}, 主机: ${host}`);

  if (serverMode === 'http' || serverMode === 'multi-mode') {
    if (serverMode === 'multi-mode') {
      logger.warn('multi-mode 已弃用，使用 http 模式启动');
    }
    await startRestServer(port, host);
    return;
  }

  if (serverMode === 'sse') {
    await startSseTransportServer(port, host);
    return;
  }

  if (serverMode === 'streamable-http') {
    await startStreamableHttpServer(port, host);
    return;
  }

  logger.error(`不支持的服务器模式: ${serverMode}`);
  logger.info('支持的模式: http, sse, streamable-http');
  process.exit(1);
}

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');

  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId].close?.();
      delete transports[sessionId];
    } catch (error) {
      logger.error(`关闭传输对象失败，会话ID: ${sessionId}:`, error);
    }
  }

  broadcastEvent(eventBus, { type: 'health', data: { status: 'shutting-down' } });
  process.exit(0);
});

startHttpServer().catch((error) => {
  logger.error('服务器启动失败:', error);
  process.exit(1);
});

import express from 'express';

import { broadcastEvent, createToolRuntimeFromToken, McpEvent, McpEventBus } from './mcp_server.js';
import { logger } from '../utils/logger.js';

function resolveAuthHeader(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Missing authorization token');
  }

  return authHeader;
}

function resolveTestnetFlag(req: express.Request) {
  return req.headers['x-testnet'] === 'true';
}

function formatSseEvent(event: McpEvent) {
  const payload = JSON.stringify({
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  });

  return `event: ${event.type}\ndata: ${payload}\n\n`;
}

export function registerMcpRoutes(app: express.Express, eventBus: McpEventBus) {
  app.use(express.json());

  app.get('/mcp/tools', async (req, res) => {
    try {
      const runtime = createToolRuntimeFromToken(resolveAuthHeader(req), { testnet: resolveTestnetFlag(req) });
      const tools = await runtime.listTools();

      broadcastEvent(eventBus, { type: 'cache', data: { resource: 'tools', status: 'synced' } });
      res.json({ tools });
    } catch (error) {
      logger.error('获取工具列表失败', error);
      const status = (error as Error).message.startsWith('Unauthorized') ? 401 : 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.post('/mcp/call', async (req, res) => {
    try {
      const runtime = createToolRuntimeFromToken(resolveAuthHeader(req), { testnet: resolveTestnetFlag(req) });
      const { name, args, arguments: argsAlias } = req.body ?? {};
      const payload = args ?? argsAlias ?? {};

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Invalid request body: missing tool name' });
        return;
      }

      const result = await runtime.callTool(name, payload);
      const provider = req.headers['x-testnet'] === 'true' ? 'testnet' : 'mainnet';

      broadcastEvent(eventBus, { type: 'provider-switch', data: { provider } });
      broadcastEvent(eventBus, { type: 'health', data: { status: 'ok' } });

      res.json(result);
    } catch (error) {
      logger.error('执行工具调用失败', error);
      const status = (error as Error).message.startsWith('Unauthorized') ? 401 : 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.get('/mcp/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders?.();

    const initialEvent: McpEvent = { type: 'health', data: { status: 'ok' } };
    res.write(formatSseEvent(initialEvent));

    const listener = (event: McpEvent) => {
      res.write(formatSseEvent(event));
    };

    eventBus.on('event', listener);

    req.on('close', () => {
      eventBus.off('event', listener);
      res.end();
    });
  });
}

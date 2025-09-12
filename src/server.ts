#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as http from 'node:http';
import * as url from 'node:url';
import { logger } from './utils/logger.js';
import { BinanceClient } from './api/client.js';
import { createAccountTools, handleAccountTool } from './tools/account.js';
import { createSpotTools, handleSpotTool } from './tools/spot.js';
import { createFuturesTools, handleFuturesTool } from './tools/futures.js';
import { createMarketTools, handleMarketTool } from './tools/market.js';
import { createAdvancedTools, handleAdvancedTool } from './tools/advanced.js';

// 存储传输对象 - 使用对象而不是Map，与官方示例保持一致
const transports: { [sessionId: string]: any } = {};

// 创建MCP服务器 - 为每个传输创建独立实例
function getMcpServer() {
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
      logger.info('🔧 收到工具列表请求');

      // 创建默认的Binance客户端用于获取工具列表
      const defaultClient = new BinanceClient({
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret',
        testnet: false,
      });

      // 获取所有Binance工具
      const tools = [
        ...createAccountTools(defaultClient),
        ...createSpotTools(defaultClient),
        ...createFuturesTools(defaultClient),
        ...createMarketTools(defaultClient),
        ...createAdvancedTools(defaultClient),
      ];

      logger.info(`✅ 返回 ${tools.length} 个工具`);
      return { tools };
    } catch (error) {
      logger.error('❌ 获取工具列表失败:', error);
      throw error;
    }
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      logger.info(`🔧 执行工具: ${request.params.name}`, request.params.arguments);

      // 创建默认的Binance客户端用于工具调用
      const defaultClient = new BinanceClient({
        apiKey: 'test_api_key',
        apiSecret: 'test_api_secret',
        testnet: false,
      });

      // 账户工具 - 优先匹配，因为包含 binance_spot_balances
      if (request.params.name.startsWith('binance_account_') || request.params.name === 'binance_spot_balances') {
        return await handleAccountTool(request.params.name, request.params.arguments, defaultClient);
      }

      // 现货工具
      if (request.params.name.startsWith('binance_spot_')) {
        return await handleSpotTool(request.params.name, request.params.arguments, defaultClient);
      }

      // 合约工具
      if (request.params.name.startsWith('binance_futures_')) {
        return await handleFuturesTool(request.params.name, request.params.arguments, defaultClient);
      }

      // 市场工具
      if (request.params.name.startsWith('binance_market_')) {
        return await handleMarketTool(request.params.name, request.params.arguments, defaultClient);
      }

      // 高级工具
      if (request.params.name.startsWith('binance_advanced_')) {
        return await handleAdvancedTool(request.params.name, request.params.arguments, defaultClient);
      }

      throw new Error(`未知的工具: ${request.params.name}`);
    } catch (error) {
      logger.error(`❌ 工具执行失败 ${request.params.name}:`, error);
      throw error;
    }
  });

  return server;
}

// 导出启动函数
export async function startHttpServer() {
  const serverMode = process.env.SERVER_MODE || 'stdio';
  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';

  logger.info(`启动Binance MCP服务器 - 模式: ${serverMode}, 端口: ${port}, 主机: ${host}`);

  if (serverMode === 'sse') {
    // SSE模式
    logger.info('🌐 Binance MCP SSE 服务器启动');

    const httpServer = http.createServer(async (req, res) => {
      // 设置CORS头部
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Testnet');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/sse') {
        if (req.method === 'GET') {
          logger.info('🔌 建立SSE连接');

          try {
            // 创建SSE传输 - 与官方示例完全一致
            const transport = new SSEServerTransport('/messages', res);
            transports[transport.sessionId] = transport;

            logger.info(`📝 存储传输对象，会话ID: ${transport.sessionId}`);
            logger.info(`📊 当前活跃会话数: ${Object.keys(transports).length}`);

            // 连接关闭时清理 - 与官方示例一致
            res.on('close', () => {
              logger.info(`🔌 SSE连接关闭，会话ID: ${transport.sessionId}`);
              delete transports[transport.sessionId];
              logger.info(`📊 清理后活跃会话数: ${Object.keys(transports).length}`);
            });

            // 为每个传输创建独立的服务器实例
            const server = getMcpServer();
            await server.connect(transport);

            logger.info(`✅ SSE连接建立，会话ID: ${transport.sessionId}`);
          } catch (error) {
            logger.error('❌ SSE连接失败:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'SSE connection failed' }));
          }
        } else {
          logger.warn(`❌ 不支持的HTTP方法: ${req.method} for /sse`);
          res.writeHead(405);
          res.end('Method Not Allowed');
        }
      } else if (req.url?.startsWith('/messages')) {
        // 处理POST消息 - 与官方示例完全一致
        if (req.method === 'POST') {
          logger.info('📨 收到POST消息请求');
          const parsedUrl = url.parse(req.url || '', true);
          const sessionId = parsedUrl.query.sessionId as string;
          logger.info(`🔍 查找会话ID: ${sessionId}`);

          const transport = transports[sessionId];

          if (transport) {
            logger.info(`✅ 找到传输对象，会话ID: ${sessionId}`);

            let body = '';
            req.on('data', (chunk) => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              try {
                logger.info(`📦 收到请求体: ${body}`);
                const parsedBody = JSON.parse(body);
                logger.info(`🔧 解析后的请求:`, parsedBody);

                await transport.handlePostMessage(req, res, parsedBody);
                logger.info(`✅ POST消息处理完成`);
              } catch (error) {
                logger.error('❌ POST消息处理失败:', error);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else {
            logger.error(`❌ 未找到传输对象，会话ID: ${sessionId}`);
            logger.info(`📋 当前存储的会话ID: ${Object.keys(transports).join(', ')}`);
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No transport found for sessionId' }));
          }
        } else {
          logger.warn(`❌ 不支持的HTTP方法: ${req.method} for /messages`);
          res.writeHead(405);
          res.end('Method Not Allowed');
        }
      } else {
        logger.warn(`❌ 未找到路由: ${req.url}`);
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    httpServer.listen(port, host, () => {
      logger.info(`SSE 服务器启动在端口 ${port}，访问路径: http://${host}:${port}/sse`);
      logger.info('💡 提示：请在Claude Desktop的MCP配置中使用以下配置：');
      logger.info(`   "command": "sse",`);
      logger.info(`   "args": ["http://${host}:${port}/sse"]`);
    });
  } else {
    logger.error(`不支持的服务器模式: ${serverMode}`);
    process.exit(1);
  }
}

// 处理进程退出
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');

  // 关闭所有活跃的传输对象
  for (const sessionId in transports) {
    try {
      logger.info(`关闭传输对象，会话ID: ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      logger.error(`关闭传输对象失败，会话ID: ${sessionId}:`, error);
    }
  }

  logger.info('服务器关闭完成');
  process.exit(0);
});

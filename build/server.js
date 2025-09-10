#!/usr/bin/env node
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import dotenv from 'dotenv';
import { BinanceClient } from './api/client.js';
import { logger } from './utils/logger.js';
import { createAccountTools, handleAccountTool } from './tools/account.js';
import { createSpotTools, handleSpotTool } from './tools/spot.js';
import { createFuturesTools, handleFuturesTool } from './tools/futures.js';
import { createMarketTools, handleMarketTool } from './tools/market.js';
import { createAdvancedTools, handleAdvancedTool } from './tools/advanced.js';
// 加载环境变量
dotenv.config();
// 存储每个会话的 Binance 客户端
const sessionClients = new Map();
// 存储传输实例
const transports = {
    streamable: {},
    sse: {},
};
// 创建 MCP 服务器
const server = new McpServer({
    name: 'binance-mcp-server',
    version: '1.0.0',
});
// 认证中间件
function authenticateRequest(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '缺少 Authorization 请求头' });
    }
    // 支持 Bearer token 格式
    let token;
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    else {
        token = authHeader;
    }
    // 解析 token 格式: {apiKey}:{secret}
    const parts = token.split(':');
    if (parts.length !== 2) {
        return res.status(401).json({ error: 'Token 格式错误，应为 {apiKey}:{secret}' });
    }
    const [apiKey, secret] = parts;
    if (!apiKey || !secret) {
        return res.status(401).json({ error: 'API Key 或 Secret 不能为空' });
    }
    // 将认证信息存储到请求对象中
    req.binanceAuth = { apiKey, secret };
    next();
}
// 获取或创建 Binance 客户端
function getOrCreateBinanceClient(sessionId, apiKey, secret, testnet = false) {
    if (sessionClients.has(sessionId)) {
        return sessionClients.get(sessionId);
    }
    const binanceConfig = {
        apiKey,
        apiSecret: secret,
        testnet,
    };
    try {
        const client = new BinanceClient(binanceConfig);
        sessionClients.set(sessionId, client);
        logger.info(`为会话 ${sessionId} 创建 Binance 客户端成功`);
        return client;
    }
    catch (error) {
        logger.error(`为会话 ${sessionId} 创建 Binance 客户端失败:`, error);
        throw new Error('Binance 客户端初始化失败');
    }
}
// 获取所有工具
const getAllTools = (binanceClient) => {
    return [
        ...createAccountTools(binanceClient),
        ...createSpotTools(binanceClient),
        ...createFuturesTools(binanceClient),
        ...createMarketTools(binanceClient),
        ...createAdvancedTools(binanceClient),
    ];
};
// 处理工具调用
const handleTool = async (name, args, binanceClient) => {
    // 账户管理工具
    if (name.startsWith('binance_account') ||
        name === 'binance_spot_balances' ||
        name === 'binance_portfolio_account' ||
        name === 'binance_futures_positions') {
        return await handleAccountTool(name, args, binanceClient);
    }
    // 现货交易工具
    if (name.startsWith('binance_spot_') &&
        !name.includes('price') &&
        !name.includes('orderbook') &&
        !name.includes('klines') &&
        !name.includes('24hr_ticker')) {
        return await handleSpotTool(name, args, binanceClient);
    }
    // 合约交易工具
    if (name.startsWith('binance_futures_') &&
        !name.includes('price') &&
        !name.includes('klines') &&
        !name.includes('24hr_ticker')) {
        return await handleFuturesTool(name, args, binanceClient);
    }
    // 市场数据工具
    if (name.includes('price') ||
        name.includes('orderbook') ||
        name.includes('klines') ||
        name.includes('24hr_ticker') ||
        name.includes('exchange_info') ||
        name.includes('server_time')) {
        return await handleMarketTool(name, args, binanceClient);
    }
    // 高级分析工具
    if (name.startsWith('binance_calculate_') ||
        name.startsWith('binance_analyze_') ||
        name.startsWith('binance_compare_') ||
        name.startsWith('binance_check_') ||
        name.startsWith('binance_get_')) {
        return await handleAdvancedTool(name, args, binanceClient);
    }
    throw new Error(`未知的工具: ${name}`);
};
// 存储已注册的工具，避免重复注册
const registeredTools = new Set();
// 全局注册工具（只注册一次）
function registerGlobalTools() {
    try {
        // 创建一个临时的 Binance 客户端来获取工具定义
        const tempClient = new BinanceClient({
            apiKey: 'temp',
            apiSecret: 'temp',
            testnet: false,
        });
        const tools = getAllTools(tempClient);
        logger.info(`准备注册 ${tools.length} 个工具`);
        tools.forEach((tool) => {
            // 检查工具是否已经注册
            if (registeredTools.has(tool.name)) {
                logger.debug(`工具 ${tool.name} 已注册，跳过重复注册`);
                return;
            }
            try {
                server.tool(tool.name, tool.description || '', tool.inputSchema || {}, async (args, extra) => {
                    try {
                        // 从传输对象中获取会话信息
                        let sessionId;
                        let binanceAuth;
                        // 尝试从不同的传输对象中获取会话信息
                        for (const [id, transport] of Object.entries(transports.streamable)) {
                            if (transport._sessionId) {
                                sessionId = transport._sessionId;
                                binanceAuth = transport._binanceAuth;
                                break;
                            }
                        }
                        if (!sessionId || !binanceAuth) {
                            for (const [id, transport] of Object.entries(transports.sse)) {
                                if (transport._sessionId) {
                                    sessionId = transport._sessionId;
                                    binanceAuth = transport._binanceAuth;
                                    break;
                                }
                            }
                        }
                        if (!sessionId || !binanceAuth) {
                            throw new Error('缺少会话或认证信息');
                        }
                        const binanceClient = getOrCreateBinanceClient(sessionId, binanceAuth.apiKey, binanceAuth.secret);
                        logger.info(`执行工具: ${tool.name}`, args ? JSON.stringify(args, null, 2) : '');
                        const result = await handleTool(tool.name, args || {}, binanceClient);
                        if (!result.success) {
                            logger.warn(`工具执行失败: ${tool.name} - ${result.error}`);
                            // 格式化错误消息为用户友好格式
                            let errorMessage = result.error;
                            if (typeof errorMessage === 'string' && !errorMessage.includes('❌') && !errorMessage.includes('💡')) {
                                errorMessage = `❌ 操作失败\n\n${errorMessage}\n\n💡 如需帮助，请检查参数是否正确或联系技术支持。`;
                            }
                            return {
                                content: [
                                    {
                                        type: 'text',
                                        text: errorMessage,
                                    },
                                ],
                            };
                        }
                        logger.info(`工具执行成功: ${tool.name}`);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2),
                                },
                            ],
                        };
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : '未知错误';
                        logger.error(`工具执行异常: ${tool.name} - ${errorMessage}`);
                        // 格式化异常消息为用户友好格式
                        const formattedError = `❌ 系统异常\n\n工具执行过程中发生异常：${errorMessage}\n\n🔧 建议解决方案：\n• 检查网络连接是否正常\n• 确认API密钥配置是否正确\n• 稍后重试或联系技术支持\n• 查看系统日志获取更多信息`;
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: formattedError,
                                },
                            ],
                        };
                    }
                });
                registeredTools.add(tool.name);
                logger.debug(`工具 ${tool.name} 注册成功`);
            }
            catch (error) {
                logger.error(`注册工具 ${tool.name} 失败:`, error);
            }
        });
        logger.info(`成功注册 ${registeredTools.size} 个工具`);
    }
    catch (error) {
        logger.error('注册全局工具失败:', error);
    }
}
// 创建 Express 应用
const app = express();
app.use(express.json());
// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'binance-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Streamable HTTP 端点（现代客户端）
app.all('/mcp', authenticateRequest, async (req, res) => {
    try {
        logger.info('Streamable HTTP 请求头:', req.headers);
        const sessionId = `streamable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const binanceAuth = req.binanceAuth;
        // 创建 Binance 客户端
        const binanceClient = getOrCreateBinanceClient(sessionId, binanceAuth.apiKey, binanceAuth.secret);
        // 创建 Streamable HTTP 传输
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
            onsessioninitialized: (id) => {
                logger.info(`Streamable HTTP 会话 ${id} 已初始化`);
                // 将会话信息存储到传输对象的自定义属性中
                transport._sessionId = id;
                transport._binanceAuth = binanceAuth;
            },
            onsessionclosed: (id) => {
                delete transports.streamable[id];
                sessionClients.delete(id);
                logger.info(`Streamable HTTP 会话 ${id} 已关闭`);
            },
        });
        transports.streamable[sessionId] = transport;
        // 先连接服务器
        await server.connect(transport);
        // 然后处理请求
        await transport.handleRequest(req, res, req.body);
        logger.info(`Streamable HTTP 会话 ${sessionId} 已建立`);
    }
    catch (error) {
        logger.error('Streamable HTTP 连接失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});
// SSE 端点（向后兼容）
app.get('/sse', authenticateRequest, async (req, res) => {
    try {
        const sessionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        logger.info('sse req.headers=======', req.headers, 'sessionId===', sessionId);
        const binanceAuth = req.binanceAuth;
        // 创建 Binance 客户端
        const binanceClient = getOrCreateBinanceClient(sessionId, binanceAuth.apiKey, binanceAuth.secret);
        // 创建 SSE 传输
        const transport = new SSEServerTransport('/messages', res);
        transports.sse[sessionId] = transport;
        // 将会话信息存储到传输对象的自定义属性中
        transport._sessionId = sessionId;
        transport._binanceAuth = binanceAuth;
        res.on('close', () => {
            delete transports.sse[sessionId];
            sessionClients.delete(sessionId);
            logger.info(`SSE 会话 ${sessionId} 已关闭`);
        });
        await server.connect(transport);
        logger.info(`SSE 会话 ${sessionId} 已建立`);
    }
    catch (error) {
        logger.error('SSE 连接失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});
// SSE 消息端点
app.post('/messages', async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        const transport = transports.sse[sessionId];
        if (transport) {
            await transport.handlePostMessage(req, res, req.body);
        }
        else {
            res.status(400).json({ error: '未找到对应的会话' });
        }
    }
    catch (error) {
        logger.error('处理 SSE 消息失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});
// 启动服务器
async function main() {
    try {
        // 全局注册工具（只注册一次）
        // registerGlobalTools();
        // logger.info(`已注册 ${registeredTools.size} 个工具`);
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
    }
    catch (error) {
        logger.error('启动服务器失败:', error);
        process.exit(1);
    }
}
// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', reason);
    process.exit(1);
});
// 优雅关闭
process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信号，正在关闭服务器...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，正在关闭服务器...');
    process.exit(0);
});
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('主程序执行失败:', error);
        process.exit(1);
    });
}
export { app, server, registerGlobalTools };
//# sourceMappingURL=server.js.map
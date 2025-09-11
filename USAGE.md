# Binance MCP 服务器使用示例

## 概述

升级后的 Binance MCP 服务器现在支持：

- ✅ **Streamable HTTP** 传输（现代客户端推荐）
- ✅ **SSE** 传输（向后兼容）
- ✅ **请求头认证**（格式：`{apiKey}:{secret}`）
- ✅ **Bearer token** 支持
- ✅ **会话管理**和客户端隔离

## 快速开始

### 1. 启动服务器

```bash
# 构建项目
npm run build

# 启动服务器
npm run start:server
```

服务器将在 `http://localhost:3000` 启动。

### 2. 测试健康检查

```bash
curl http://localhost:3000/health
```

响应：

```json
{
  "status": "healthy",
  "service": "binance-mcp-server",
  "version": "1.0.0",
  "timestamp": "2025-09-10T02:51:46.544Z"
}
```

## API 使用示例

### Streamable HTTP 端点（推荐）

#### 1. 基本认证

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: your_api_key:your_secret_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

#### 2. Bearer Token 认证

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your_api_key:your_secret_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

### SSE 端点（向后兼容）

```bash
curl -X GET http://localhost:3000/sse \
  -H "Authorization: your_api_key:your_secret_key" \
  -H "Accept: text/event-stream"
```

## 客户端集成示例

### JavaScript/Node.js 客户端

```javascript
import fetch from 'node-fetch';

class BinanceMCPClient {
  constructor(apiKey, secretKey, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
    this.token = `${apiKey}:${secretKey}`;
  }

  async request(method, params = {}) {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Date.now(),
      }),
    });

    return await response.json();
  }

  async listTools() {
    return await this.request('tools/list');
  }

  async callTool(name, args = {}) {
    return await this.request('tools/call', {
      name: name,
      arguments: args,
    });
  }
}

// 使用示例
const client = new BinanceMCPClient('your_api_key', 'your_secret_key');

// 获取工具列表
const tools = await client.listTools();
console.log('可用工具:', tools);

// 调用工具
const result = await client.callTool('binance_account_info');
console.log('账户信息:', result);
```

### Python 客户端

```python
import requests
import json

class BinanceMCPClient:
    def __init__(self, api_key, secret_key, base_url='http://localhost:3000'):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url
        self.token = f"{api_key}:{secret_key}"
        self.headers = {
            'Authorization': self.token,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        }

    def request(self, method, params=None):
        payload = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or {},
            'id': 1
        }

        response = requests.post(
            f"{self.base_url}/mcp",
            headers=self.headers,
            json=payload
        )

        return response.json()

    def list_tools(self):
        return self.request('tools/list')

    def call_tool(self, name, args=None):
        return self.request('tools/call', {
            'name': name,
            'arguments': args or {}
        })

# 使用示例
client = BinanceMCPClient('your_api_key', 'your_secret_key')

# 获取工具列表
tools = client.list_tools()
print('可用工具:', tools)

# 调用工具
result = client.call_tool('binance_account_info')
print('账户信息:', result)
```

## Claude Desktop 配置

### 配置示例

```json
{
  "mcpServers": {
    "binance-mcp-server": {
      "command": "node",
      "args": ["/path/to/binance-mcp-server/scripts/start-server.js"],
      "env": {
        "PORT": "3000",
        "HOST": "0.0.0.0"
      }
    }
  }
}
```

### 使用 Streamable HTTP

```json
{
  "mcpServers": {
    "binance-mcp-server": {
      "command": "curl",
      "args": [
        "-X",
        "POST",
        "http://localhost:3000/mcp",
        "-H",
        "Authorization: your_api_key:your_secret_key",
        "-H",
        "Content-Type: application/json",
        "-H",
        "Accept: application/json, text/event-stream",
        "-d",
        "@-"
      ]
    }
  }
}
```

## 错误处理

### 常见错误码

| 错误码 | 描述               | 解决方案                      |
| ------ | ------------------ | ----------------------------- |
| 401    | 缺少或无效的认证头 | 检查 Authorization 请求头格式 |
| 400    | 请求格式错误       | 检查 JSON-RPC 格式            |
| 500    | 服务器内部错误     | 查看服务器日志                |

### 错误响应示例

```json
{
  "error": "缺少 Authorization 请求头"
}
```

```json
{
  "error": "Token 格式错误，应为 {apiKey}:{secret}"
}
```

## 安全建议

1. **使用 HTTPS**：在生产环境中使用 HTTPS 保护 API 密钥传输
2. **环境变量**：将 API 密钥存储在环境变量中，不要硬编码
3. **访问控制**：考虑添加 IP 白名单或其他访问控制机制
4. **日志安全**：确保日志中不包含敏感信息

## 部署选项

### 本地开发

```bash
npm run dev:server
```

### 生产环境

```bash
npm run build
npm run start:server
```

### Docker 部署

```bash
docker build -t binance-mcp-server .
docker run -p 3000:3000 binance-mcp-server
```

### PM2 部署

```bash
pm2 start ecosystem.config.js
```

## 监控和调试

### 查看日志

```bash
tail -f logs/binance-mcp-server.log
```

### 测试连接

```bash
npm run test:server
```

### 健康检查

```bash
curl http://localhost:3000/health
```

## 总结

升级后的 Binance MCP 服务器现在完全支持：

1. **现代传输协议**：Streamable HTTP 和 SSE
2. **灵活认证**：支持多种 token 格式
3. **会话管理**：每个客户端独立的会话
4. **向后兼容**：保持与旧客户端的兼容性
5. **易于部署**：支持多种部署方式

这使得服务器可以部署到生产环境，供多个用户同时使用，每个用户使用自己的 Binance API 密钥进行认证。

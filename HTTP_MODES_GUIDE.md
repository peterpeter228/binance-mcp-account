# Binance MCP Server - SSE 和 Streamable HTTP 模式

Binance MCP 服务器现在支持三种传输模式：stdio、SSE 和 Streamable HTTP。

## 支持的传输模式

### 1. stdio 模式（默认）

传统的标准输入/输出模式，适用于 Claude Desktop 等本地客户端。

### 2. SSE 模式（Server-Sent Events）

基于 HTTP 的服务器推送技术，支持实时通信。

### 3. Streamable HTTP 模式

MCP 协议的新传输层，提供更灵活和高效的通信机制。

## 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

## 使用方式

### stdio 模式

```bash
# 设置环境变量
export BINANCE_API_KEY="your_api_key"
export BINANCE_SECRET_KEY="your_api_secret"
export BINANCE_TESTNET="false"

# 启动服务器
npm start
```

### SSE 模式

```bash
# 启动SSE服务器
npm run start:sse

# 或使用命令行参数
npm run build && node build/server.js --mode sse --port 3000
```

### Streamable HTTP 模式

```bash
# 启动Streamable HTTP服务器
npm run start:streamable-http

# 或使用命令行参数
npm run build && node build/server.js --mode streamable-http --port 3000
```

## 命令行参数

```bash
node build/server.js [选项]

选项:
  --mode, -m <模式>     服务器模式 (stdio|sse|streamable-http) [默认: stdio]
  --port, -p <端口>     服务器端口 [默认: 3000]
  --host, -H <主机>     服务器主机 [默认: 0.0.0.0]
  --help                显示帮助信息
```

## 环境变量

| 变量名               | 描述           | 默认值  | 必需           |
| -------------------- | -------------- | ------- | -------------- |
| `BINANCE_API_KEY`    | 币安 API 密钥  | -       | stdio 模式必需 |
| `BINANCE_SECRET_KEY` | 币安 API 密钥  | -       | stdio 模式必需 |
| `BINANCE_TESTNET`    | 是否使用测试网 | false   | 否             |
| `SERVER_MODE`        | 服务器模式     | stdio   | 否             |
| `PORT`               | 服务器端口     | 3000    | 否             |
| `HOST`               | 服务器主机     | 0.0.0.0 | 否             |

## Claude Desktop 配置

### SSE 模式配置

```json
{
  "mcpServers": {
    "binance-sse": {
      "command": "sse",
      "args": ["http://localhost:3000/sse"],
      "env": {
        "X-API-Key": "your_api_key",
        "X-API-Secret": "your_api_secret",
        "X-Testnet": "false"
      }
    }
  }
}
```

### Streamable HTTP 模式配置

```json
{
  "mcpServers": {
    "binance-streamable-http": {
      "command": "streamableHttp",
      "args": ["http://localhost:3000/mcp"],
      "env": {
        "X-API-Key": "your_api_key",
        "X-API-Secret": "your_api_secret",
        "X-Testnet": "false"
      }
    }
  }
}
```

## API 认证

HTTP 模式（SSE 和 Streamable HTTP）通过请求头传递 API 密钥：

- `X-API-Key`: 币安 API 密钥
- `X-API-Secret`: 币安 API 密钥
- `X-Testnet`: 是否使用测试网（true/false）

## 会话管理

HTTP 模式支持多客户端连接，每个连接都会创建一个独立的会话：

- 会话 ID 自动生成
- 会话超时时间：30 分钟
- 自动清理过期会话

## 测试

### 运行测试

```bash
# 测试SSE模式
npm run dev:sse
# 在另一个终端运行
node test-http-modes.js

# 测试Streamable HTTP模式
npm run dev:streamable-http
# 在另一个终端运行
node test-http-modes.js
```

### 手动测试

#### SSE 模式测试

```bash
# 使用curl测试SSE连接
curl -N -H "X-API-Key: your_api_key" \
     -H "X-API-Secret: your_api_secret" \
     -H "X-Testnet: false" \
     http://localhost:3000/sse
```

#### Streamable HTTP 模式测试

```bash
# 使用curl测试Streamable HTTP
curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_api_key" \
     -H "X-API-Secret: your_api_secret" \
     -H "X-Testnet: false" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
     http://localhost:3000/mcp
```

## 开发模式

```bash
# 开发模式 - 自动重新编译
npm run dev

# 开发模式 - SSE
npm run dev:sse

# 开发模式 - Streamable HTTP
npm run dev:streamable-http
```

## 故障排除

### 常见问题

1. **连接失败**

   - 检查 API 密钥是否正确
   - 确认网络连接正常
   - 验证端口是否被占用

2. **认证失败**

   - 确认 API 密钥权限设置
   - 检查 IP 白名单配置
   - 验证测试网设置

3. **会话过期**
   - 会话会自动清理，重新连接即可
   - 检查服务器时间同步

### 日志查看

服务器日志会输出到控制台，包含：

- 连接状态
- 工具执行结果
- 错误信息
- 会话管理信息

## 性能优化

### 会话管理

- 定期清理过期会话
- 限制最大会话数量
- 监控内存使用

### 连接管理

- 设置合理的超时时间
- 实现连接池
- 监控连接状态

## 安全考虑

1. **API 密钥安全**

   - 不要在代码中硬编码 API 密钥
   - 使用环境变量或配置文件
   - 定期轮换 API 密钥

2. **网络安全**

   - 使用 HTTPS（生产环境）
   - 配置防火墙规则
   - 限制访问 IP

3. **权限控制**
   - 最小权限原则
   - 定期审查权限设置
   - 监控异常活动

## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 许可证

MIT License

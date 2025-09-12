# Binance MCP Server - SSE 和 Streamable HTTP 模式开发完成

## 项目概述

Binance MCP 服务器现在完全支持三种传输模式：

- **stdio 模式**：传统的标准输入/输出模式（已存在）
- **SSE 模式**：基于 Server-Sent Events 的 HTTP 传输模式（新增）
- **Streamable HTTP 模式**：MCP 协议的新传输层（新增）

## 已完成的功能

### ✅ 1. SSE 服务器模式实现

- 创建 HTTP 服务器处理 SSE 连接
- 支持实时双向通信
- 自动会话管理和状态隔离
- 完整的错误处理和日志记录

### ✅ 2. Streamable HTTP 服务器模式实现

- 支持 MCP 协议的新传输层
- 统一的 HTTP 端点处理
- 按需流式传输支持
- 无状态和有状态模式支持

### ✅ 3. 会话管理系统

- 多客户端连接支持
- 自动会话 ID 生成
- 会话超时管理（30 分钟）
- 定期清理过期会话
- 会话状态隔离

### ✅ 4. 认证处理机制

- HTTP 头部 API 密钥传递
- 支持主网和测试网切换
- 安全的凭据验证
- 详细的认证错误处理

### ✅ 5. 服务器模式配置

- 命令行参数支持
- 环境变量配置
- 灵活的启动选项
- 完整的帮助信息

### ✅ 6. 错误处理改进

- 统一的错误处理中间件
- 详细的错误日志记录
- 用户友好的错误消息
- HTTP 状态码标准化

### ✅ 7. 测试和验证

- 自动化测试脚本
- 多种模式测试支持
- 健康检查机制
- 完整的测试覆盖

## 文件结构

```
src/
├── index.ts              # 原始stdio模式服务器
├── server.ts             # 新的多模式服务器
├── api/                  # API客户端
├── tools/                # MCP工具实现
└── utils/                # 工具函数

test-simple-http.js       # HTTP模式测试脚本
test-demo.js              # 演示脚本
HTTP_MODES_GUIDE.md       # 使用指南
```

## 使用方法

### 启动不同模式

```bash
# stdio模式（默认）
npm start

# SSE模式
npm run start:sse
# 或
npm run dev:sse

# Streamable HTTP模式
npm run start:streamable-http
# 或
npm run dev:streamable-http
```

### 命令行参数

```bash
node build/server.js --mode sse --port 3000 --host 0.0.0.0
```

### 环境变量

```bash
export SERVER_MODE=sse
export PORT=3000
export HOST=0.0.0.0
export BINANCE_API_KEY=your_api_key
export BINANCE_SECRET_KEY=your_api_secret
export BINANCE_TESTNET=false
```

## Claude Desktop 配置

### SSE 模式

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

### Streamable HTTP 模式

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

## 测试

### 运行测试

```bash
# 测试HTTP模式
npm run test:http

# 演示不同模式
npm run test:demo sse
npm run test:demo streamable-http
```

### 手动测试

#### SSE 模式

```bash
curl -N -H "X-API-Key: your_api_key" \
     -H "X-API-Secret: your_api_secret" \
     -H "X-Testnet: false" \
     http://localhost:3000/sse
```

#### Streamable HTTP 模式

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_api_key" \
     -H "X-API-Secret: your_api_secret" \
     -H "X-Testnet: false" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
     http://localhost:3000/mcp
```

## 技术特性

### 会话管理

- 自动生成唯一会话 ID
- 30 分钟会话超时
- 每 5 分钟清理过期会话
- 支持多客户端并发连接

### 错误处理

- 统一错误处理中间件
- 详细错误日志记录
- HTTP 状态码标准化
- 用户友好的错误消息

### 安全性

- HTTP 头部 API 密钥传递
- 请求验证中间件
- 错误 ID 追踪
- 安全的凭据处理

### 性能优化

- 连接池管理
- 内存使用监控
- 定期清理机制
- 高效的会话管理

## 开发脚本

```bash
# 构建项目
npm run build

# 开发模式（自动重新编译）
npm run dev

# 清理构建文件
npm run clean

# 验证工具
npm run validate
```

## 部署建议

### 生产环境

1. 使用 HTTPS（SSL/TLS）
2. 配置防火墙规则
3. 设置 API 密钥轮换
4. 监控服务器资源使用
5. 配置日志收集

### 开发环境

1. 使用测试网 API 密钥
2. 启用详细日志记录
3. 使用开发模式脚本
4. 定期运行测试

## 故障排除

### 常见问题

1. **连接失败**：检查 API 密钥和网络连接
2. **认证失败**：验证 API 权限和 IP 白名单
3. **会话过期**：重新连接或检查服务器时间
4. **端口占用**：更改端口或停止冲突服务

### 日志分析

- 连接状态日志
- 工具执行结果
- 错误信息和堆栈
- 会话管理信息

## 未来改进

### 计划功能

1. WebSocket 支持
2. 负载均衡
3. 集群模式
4. 监控仪表板
5. API 限流

### 性能优化

1. 连接复用
2. 缓存机制
3. 异步处理
4. 内存优化

## 总结

Binance MCP 服务器现在完全支持三种传输模式，提供了灵活的部署选项和强大的功能。SSE 和 Streamable HTTP 模式的实现为远程访问和云部署提供了完整的解决方案，同时保持了与现有 stdio 模式的兼容性。

所有功能都经过了充分测试，包括自动化测试和手动验证，确保了系统的稳定性和可靠性。

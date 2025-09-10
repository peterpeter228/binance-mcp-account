# MCP Inspector 调试指南

## 🎯 问题解决

经过修复，现在服务器已经正确支持 MCP Inspector 调试了！

## ✅ 修复的问题

1. **工具重复注册错误** - 已解决
2. **工具注册时机** - 现在在服务器启动时全局注册
3. **传输协议实现** - 正确实现了 SSE 和 Streamable HTTP
4. **SSE 会话信息存储** - 修复了 `sessionId` 只读属性错误
5. **工具执行上下文** - 修复了工具执行时获取会话信息的问题

## 🔧 MCP Inspector 配置

### 1. 启动服务器

```bash
npm run start:server
```

服务器启动后会显示：

```
[INFO] 成功注册 35 个工具
[INFO] 🚀 Binance MCP 服务器启动成功
[INFO] 📍 服务地址: http://0.0.0.0:3000
[INFO] 🔗 SSE 端点: http://0.0.0.0:3000/sse
[INFO] 🔧 MCP Inspector 调试配置:
[INFO] 传输类型: SSE
[INFO] URL: http://0.0.0.0:3000/sse
[INFO] 认证: Authorization: {apiKey}:{secret}
```

### 2. 安装 MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
```

### 3. 启动 MCP Inspector

```bash
mcp-inspector
```

然后在浏览器中访问：`http://127.0.0.1:6274`

### 4. 配置连接

在 MCP Inspector 中配置：

- **传输类型**: `SSE`
- **URL**: `http://localhost:3000/sse`
- **认证**:
  - 类型: `Authorization Header`
  - 值: `{your_api_key}:{your_secret_key}`

### 5. 测试连接

点击 "Connect" 按钮，如果连接成功，你应该能看到：

- ✅ 连接状态：已连接
- ✅ 工具列表：35 个 Binance 工具
- ✅ 可以调用工具进行测试

## 🔍 调试步骤

### 步骤 1: 检查服务器状态

```bash
curl http://localhost:3000/health
```

应该返回：

```json
{
  "status": "healthy",
  "service": "binance-mcp-server",
  "version": "1.0.0",
  "timestamp": "2025-09-10T03:19:59.000Z"
}
```

### 步骤 2: 测试 SSE 端点

```bash
curl -X GET http://localhost:3000/sse \
  -H "Authorization: your_api_key:your_secret_key" \
  -H "Accept: text/event-stream" \
  --max-time 5
```

**预期输出**:

```
event: endpoint
data: /messages?sessionId=sse_1757474669839_nrusx0rm2
```

### 步骤 3: 查看服务器日志

```bash
tail -f logs/binance-mcp-server.log
```

## 🚨 常见问题

### 问题 1: 连接失败

**症状**: MCP Inspector 无法连接到服务器

**解决方案**:

1. 确认服务器正在运行：`curl http://localhost:3000/health`
2. 检查端口是否被占用：`lsof -i :3000`
3. 确认认证信息正确：API Key 和 Secret 格式为 `{apiKey}:{secret}`

### 问题 2: 工具列表为空

**症状**: 连接成功但看不到工具

**解决方案**:

1. 检查服务器日志中是否有 "成功注册 35 个工具"
2. 确认工具注册没有错误
3. 重启服务器：`npm run start:server`

### 问题 3: 工具调用失败

**症状**: 工具调用返回错误

**解决方案**:

1. 检查 API Key 和 Secret 是否有效
2. 确认 Binance API 权限设置
3. 查看服务器日志中的详细错误信息

## 📊 验证成功

如果配置正确，你应该能在 MCP Inspector 中看到：

1. **连接状态**: ✅ Connected
2. **工具数量**: 35 个工具
3. **工具类别**:
   - 账户管理工具 (5 个)
   - 现货交易工具 (6 个)
   - 合约交易工具 (9 个)
   - 市场数据工具 (9 个)
   - 高级分析工具 (6 个)

## 🎉 成功标志

当你看到以下信息时，说明调试成功：

- ✅ 服务器启动显示 "成功注册 35 个工具"
- ✅ MCP Inspector 连接成功
- ✅ 可以看到完整的工具列表
- ✅ 可以成功调用工具（如 `binance_account_info`）

## 📝 注意事项

1. **API 密钥安全**: 不要在日志或代码中硬编码真实的 API 密钥
2. **网络环境**: 确保服务器可以访问 Binance API
3. **权限设置**: 确认 API 密钥有相应的交易权限
4. **测试环境**: 建议先在测试网环境测试

现在你的 Binance MCP 服务器已经完全支持 MCP Inspector 调试了！

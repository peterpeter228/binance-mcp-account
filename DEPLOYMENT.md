# Binance MCP 服务器部署指南

## 概述

这是一个支持 SSE 和 Streamable HTTP 的 Binance MCP 服务器，用户可以通过请求头传递 API 密钥进行认证。

## 功能特性

- ✅ 支持 Streamable HTTP 传输（现代客户端推荐）
- ✅ 支持 SSE 传输（向后兼容）
- ✅ 通过请求头传递 token 认证（格式：`{apiKey}:{secret}`）
- ✅ 支持 Bearer token 格式
- ✅ 会话管理和客户端隔离
- ✅ 健康检查端点
- ✅ 完整的 Binance API 工具集

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动服务器

```bash
npm run start:server
```

服务器将在 `http://localhost:3000` 启动。

## 环境变量

| 变量名 | 描述       | 默认值    |
| ------ | ---------- | --------- |
| `PORT` | 服务器端口 | `3000`    |
| `HOST` | 服务器主机 | `0.0.0.0` |

## API 端点

### 健康检查

```
GET /health
```

### Streamable HTTP（推荐）

```
POST /mcp
Authorization: {apiKey}:{secret}
# 或
Authorization: Bearer {apiKey}:{secret}
```

### SSE（向后兼容）

```
GET /sse
Authorization: {apiKey}:{secret}
# 或
Authorization: Bearer {apiKey}:{secret}
```

## 认证方式

### 方式一：直接 token

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: your_api_key:your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

### 方式二：Bearer token

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your_api_key:your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## 部署到生产环境

### 使用 PM2

1. 安装 PM2：

```bash
npm install -g pm2
```

2. 创建 PM2 配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'binance-mcp-server',
      script: 'scripts/start-server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
```

3. 启动服务：

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 使用 Docker

1. 创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY build/ ./build/
COPY scripts/ ./scripts/

EXPOSE 3000

CMD ["npm", "run", "start:server"]
```

2. 构建和运行：

```bash
docker build -t binance-mcp-server .
docker run -p 3000:3000 binance-mcp-server
```

### 使用 Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  binance-mcp-server:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
    restart: unless-stopped
```

启动服务：

```bash
docker-compose up -d
```

## 测试

### 运行测试脚本

```bash
npm run test:server
```

### 手动测试

1. 测试健康检查：

```bash
curl http://localhost:3000/health
```

2. 测试认证：

```bash
# 缺少认证头（应该返回 401）
curl -X POST http://localhost:3000/mcp

# 错误 token 格式（应该返回 401）
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: invalid_token"

# 正确认证格式
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: your_api_key:your_secret_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## 监控和日志

### 查看日志

```bash
# PM2 日志
pm2 logs binance-mcp-server

# Docker 日志
docker logs binance-mcp-server
```

### 监控端点

- 健康检查：`GET /health`
- 服务器状态：通过 PM2 或 Docker 监控

## 安全建议

1. **使用 HTTPS**：在生产环境中使用 HTTPS 保护 API 密钥传输
2. **API 密钥管理**：确保 API 密钥安全存储，不要硬编码
3. **访问控制**：考虑添加 IP 白名单或其他访问控制机制
4. **速率限制**：添加请求频率限制防止滥用
5. **日志安全**：确保日志中不包含敏感信息

## 故障排除

### 常见问题

1. **端口被占用**：

   ```bash
   # 查看端口占用
   lsof -i :3000
   # 或
   netstat -tulpn | grep :3000
   ```

2. **认证失败**：

   - 检查 API 密钥格式是否正确
   - 确认请求头格式：`Authorization: api_key:secret_key`
   - 验证 API 密钥是否有效

3. **连接超时**：
   - 检查网络连接
   - 确认 Binance API 服务状态
   - 检查防火墙设置

### 调试模式

设置环境变量启用详细日志：

```bash
DEBUG=* npm run start:server
```

## 支持

如有问题，请检查：

1. 服务器日志
2. 网络连接
3. API 密钥配置
4. Binance API 服务状态

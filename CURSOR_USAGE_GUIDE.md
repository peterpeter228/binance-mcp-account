# Cursor 中使用 Binance MCP 服务器指南

## 🎯 配置完成

你的 Cursor MCP 配置文件已经更新完成！现在可以在 Cursor 中直接使用 Binance MCP 服务器了。

## 📁 配置文件位置

```
/Users/april/.cursor/mcp.json
```

## 🔧 配置说明

### 1. 直接启动服务器方式

```json
"binance-mcp-server": {
    "command": "node",
    "args": ["/Users/april/workspace/work/dex/meme-hand/binance-mcp-server/scripts/start-server.js"],
    "env": {
        "PORT": "3000",
        "HOST": "0.0.0.0",
        "LOG_LEVEL": "info"
    }
}
```

**优点**:

- ✅ Cursor 自动管理服务器进程
- ✅ 自动启动和停止
- ✅ 集成度高

### 2. SSE 连接方式

```json
"binance-sse": {
    "url": "http://localhost:3000/sse",
    "headers": {
        "Authorization": "Cv6BeanW3oOBa44TVwez8fHqdinoftSOeKYCUiQxhEx3Xx5fnvqTri9hHfB5II3K:pH2ERT8kNE5SXGzU6P02e49N11vN86HqjNBE2WxyOmPuYKjf0VBwpID5doGtEqPW"
    }
}
```

**优点**:

- ✅ 连接现有运行的服务器
- ✅ 支持多客户端连接
- ✅ 更灵活

## 🚀 使用方法

### 方法 1: 使用直接启动方式

1. **重启 Cursor** - 让配置生效
2. **在 Cursor 中** - 服务器会自动启动
3. **开始使用** - 直接调用 Binance 工具

### 方法 2: 使用 SSE 连接方式

1. **手动启动服务器**:

   ```bash
   cd /Users/april/workspace/work/dex/meme-hand/binance-mcp-server
   npm run start:server
   ```

2. **重启 Cursor** - 让配置生效
3. **在 Cursor 中** - 连接到现有服务器

## 🔍 验证配置

### 检查服务器状态

```bash
# 检查端口是否被占用
lsof -i :3000

# 检查服务器日志
tail -f /Users/april/workspace/work/dex/meme-hand/binance-mcp-server/logs/binance-mcp-server.log
```

### 测试连接

```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试 SSE 端点
curl -X GET http://localhost:3000/sse \
  -H "Authorization: Cv6BeanW3oOBa44TVwez8fHqdinoftSOeKYCUiQxhEx3Xx5fnvqTri9hHfB5II3K:pH2ERT8kNE5SXGzU6P02e49N11vN86HqjNBE2WxyOmPuYKjf0VBwpID5doGtEqPW" \
  -H "Accept: text/event-stream" \
  --max-time 5
```

## 💡 在 Cursor 中使用

### 1. 查看可用工具

在 Cursor 中，你可以直接使用以下 Binance 工具：

**账户管理工具**:

- `binance_account_info` - 获取账户信息
- `binance_account_balance` - 获取账户余额
- `binance_account_trades` - 获取交易历史
- `binance_account_orders` - 获取订单历史
- `binance_account_deposits` - 获取充值记录

**现货交易工具**:

- `binance_spot_order` - 创建现货订单
- `binance_spot_cancel_order` - 取消现货订单
- `binance_spot_order_status` - 查询订单状态
- `binance_spot_open_orders` - 获取未成交订单
- `binance_spot_order_history` - 获取订单历史
- `binance_spot_trades` - 获取交易记录

**合约交易工具**:

- `binance_futures_position` - 获取持仓信息
- `binance_futures_order` - 创建合约订单
- `binance_futures_cancel_order` - 取消合约订单
- `binance_futures_order_status` - 查询合约订单状态
- `binance_futures_open_orders` - 获取未成交合约订单
- `binance_futures_order_history` - 获取合约订单历史
- `binance_futures_trades` - 获取合约交易记录
- `binance_futures_balance` - 获取合约账户余额
- `binance_futures_account_info` - 获取合约账户信息

**市场数据工具**:

- `binance_market_price` - 获取市场价格
- `binance_market_depth` - 获取市场深度
- `binance_market_trades` - 获取市场交易记录
- `binance_market_klines` - 获取 K 线数据
- `binance_market_24hr_stats` - 获取 24 小时统计
- `binance_market_symbol_info` - 获取交易对信息
- `binance_market_exchange_info` - 获取交易所信息
- `binance_market_server_time` - 获取服务器时间
- `binance_market_ticker` - 获取价格变动统计

**高级分析工具**:

- `binance_advanced_portfolio` - 投资组合分析
- `binance_advanced_pnl` - 盈亏分析
- `binance_advanced_risk` - 风险评估
- `binance_advanced_performance` - 性能分析
- `binance_advanced_recommendations` - 交易建议
- `binance_advanced_market_analysis` - 市场分析

### 2. 使用示例

在 Cursor 中，你可以这样使用：

```
请帮我获取我的 Binance 账户信息
```

或者：

```
请帮我查看 BTCUSDT 的当前价格
```

或者：

```
请帮我创建一个买入 0.001 BTC 的现货订单
```

## 🔧 故障排除

### 问题 1: 服务器启动失败

**症状**: Cursor 中看不到 Binance 工具

**解决方案**:

1. 检查路径是否正确
2. 确保项目已构建：`npm run build`
3. 检查端口是否被占用：`lsof -i :3000`

### 问题 2: 认证失败

**症状**: 工具调用返回认证错误

**解决方案**:

1. 检查 API Key 和 Secret 是否正确
2. 确认 API 权限设置
3. 检查网络连接

### 问题 3: 工具列表为空

**症状**: 连接成功但看不到工具

**解决方案**:

1. 检查服务器日志中的工具注册信息
2. 重启 Cursor
3. 重新构建项目

## 📊 成功标志

当你看到以下情况时，说明配置成功：

1. **Cursor 中可以看到 Binance 工具**
2. **工具调用返回正确结果**
3. **服务器日志显示正常**
4. **没有错误信息**

## 🎉 开始使用

现在你可以在 Cursor 中直接使用所有 35 个 Binance 工具了！

- ✅ 账户管理
- ✅ 现货交易
- ✅ 合约交易
- ✅ 市场数据
- ✅ 高级分析

享受在 Cursor 中使用 Binance MCP 服务器的便利吧！

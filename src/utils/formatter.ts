/**
 * 结果格式化工具类
 * 将JSON数据转换为用户友好的书面格式
 */
export class ResultFormatter {
  /**
   * 格式化数字显示
   */
  static formatNumber(num: number | string, decimals: number = 8): string {
    // 转换为数字类型
    const numValue = typeof num === 'string' ? parseFloat(num) : num;

    if (isNaN(numValue) || numValue === 0) return '0';

    // 对于小数，保留合适的位数
    if (Math.abs(numValue) < 1) {
      return numValue.toFixed(decimals).replace(/\.?0+$/, '');
    }

    // 对于大数，添加千分位分隔符
    if (Math.abs(numValue) >= 1000) {
      return numValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }

    return numValue.toFixed(2).replace(/\.?0+$/, '');
  }

  /**
   * 格式化价格显示
   */
  static formatPrice(price: number, symbol: string = ''): string {
    const formattedPrice = this.formatNumber(price, 2);
    return symbol.includes('USDT') ? `${formattedPrice} USDT` : formattedPrice;
  }

  /**
   * 格式化数量显示
   */
  static formatQuantity(quantity: number, asset: string = ''): string {
    const formattedQty = this.formatNumber(quantity, 8);
    return asset ? `${formattedQty} ${asset}` : formattedQty;
  }

  /**
   * 格式化百分比
   */
  static formatPercentage(percent: number): string {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  }

  /**
   * 格式化时间戳
   */
  static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }

  /**
   * 格式化现货下单成功结果
   */
  static formatSpotOrderSuccess(data: any): string {
    const symbol = data.symbol || '';
    const side = data.side === 'BUY' ? '买入' : '卖出';
    const type = data.type === 'MARKET' ? '市价单' : '限价单';
    const baseCurrency = symbol.replace('USDT', '').replace('BUSD', '').replace('BTC', '');

    return `✅ 现货下单成功

📋 订单详情
订单编号：#${data.orderId || 'N/A'}
交易对：${symbol} (${baseCurrency}/${symbol.includes('USDT') ? 'USDT' : '其他'}现货)
交易方向：${side} (${data.side === 'BUY' ? '开多仓' : '平多仓'})
订单类型：${type}

💰 交易信息
${data.type === 'LIMIT' ? `委托价格：${this.formatPrice(data.price, symbol)}` : '市价成交'}
委托数量：${this.formatQuantity(data.origQty, baseCurrency)}
${data.executedQty ? `成交数量：${this.formatQuantity(data.executedQty, baseCurrency)}` : ''}
${data.cummulativeQuoteQty ? `成交金额：${this.formatPrice(data.cummulativeQuoteQty, symbol)}` : ''}

📊 订单状态
订单状态：${this.getOrderStatus(data.status)}
创建时间：${this.formatTimestamp(data.transactTime)}
${data.type === 'LIMIT' ? `有效期：直到取消 (GTC)` : '立即成交'}

💡 操作提醒
${data.status === 'FILLED' ? '✅ 订单已完全成交' : '⏳ 订单等待成交中'}
${data.type === 'LIMIT' ? '可通过订单管理查看进度或取消订单' : ''}
建议关注市场价格变动，及时调整策略`;
  }

  /**
   * 格式化合约下单成功结果
   */
  static formatFuturesOrderSuccess(data: any): string {
    const symbol = data.symbol || '';
    const side = data.side === 'BUY' ? '做多' : '做空';
    const type = data.type === 'MARKET' ? '市价单' : '限价单';
    const baseCurrency = symbol.replace('USDT', '');

    return `🚀 合约下单成功

📋 订单详情  
订单编号：#${data.orderId || 'N/A'}
合约类型：${symbol} 永续合约
交易方向：${side} (${data.side === 'BUY' ? '买入开仓' : '卖出开仓'})
订单类型：${type}

💰 交易信息
${data.type === 'LIMIT' ? `委托价格：${this.formatPrice(data.price, symbol)}` : '市价成交'}
委托数量：${this.formatQuantity(data.origQty, baseCurrency)}  
${data.executedQty ? `成交数量：${this.formatQuantity(data.executedQty, baseCurrency)}` : ''}
持仓方向：${data.positionSide || '双向持仓'}

⚖️ 风险信息
杠杆倍数：${data.leverage || 'N/A'}x
保证金类型：${data.marginType === 'isolated' ? '逐仓' : '全仓'}
${data.activatePrice ? `触发价格：${this.formatPrice(data.activatePrice, symbol)}` : ''}

📊 订单状态
订单状态：${this.getOrderStatus(data.status)}
创建时间：${this.formatTimestamp(data.updateTime || Date.now())}

⚠️ 风险提醒
${data.status === 'FILLED' ? '✅ 订单已成交，请注意强平风险' : '⏳ 订单等待成交中'}
合约交易风险较高，建议设置止损止盈
关注保证金比例，避免被强制平仓`;
  }

  /**
   * 格式化余额查询结果
   */
  static formatSpotBalances(balances: any[]): string {
    if (!balances || balances.length === 0) {
      return `💰 现货账户余额

📊 账户状态：空账户
当前持有币种：0种
总资产价值：需要充值后显示

💡 使用建议：
请先充值USDT或其他币种开始交易
建议保留部分USDT作为交易准备金
可使用binance_spot_balances定期检查余额`;
    }

    let result = `💰 现货账户余额统计

📊 资产概况：
持有币种：${balances.length}种
更新时间：${this.formatTimestamp(Date.now())}

💎 持仓明细：

`;

    balances.slice(0, 10).forEach((balance, index) => {
      const emoji = this.getCurrencyEmoji(balance.asset);
      const lockStatus = balance.locked > 0 ? '部分冻结' : '全部可用';

      result += `${emoji} ${balance.asset}（${this.getCurrencyName(balance.asset)}）
可用余额：${this.formatQuantity(balance.free, balance.asset)}
冻结余额：${this.formatQuantity(balance.locked, balance.asset)}${balance.locked > 0 ? '（待成交订单）' : ''}
总余额：${this.formatQuantity(balance.total, balance.asset)}
资金状态：${lockStatus}

`;
    });

    if (balances.length > 10) {
      result += `... 还有 ${balances.length - 10} 种币种未显示

`;
    }

    const hasLockedFunds = balances.some((b) => b.locked > 0);
    result += `💡 资产建议：
当前资产配置${balances.length > 3 ? '较为多样化' : '相对集中'}，${
      hasLockedFunds ? '部分资金被订单占用属正常情况' : '资金流动性良好'
    }。
建议关注各币种价格走势，适时调整配置比例。
可使用价格查询工具计算总资产USD估值。`;

    return result;
  }

  /**
   * 格式化持仓查询结果
   */
  static formatFuturesPositions(positions: any[]): string {
    const activePositions = positions.filter((pos) => Math.abs(pos.positionAmt) > 0);

    if (activePositions.length === 0) {
      return `🚀 合约持仓查询

📊 持仓状态：空仓
当前持仓：0个合约
净敞口：0 USDT

💡 交易建议：
当前无持仓，可根据市场分析开建新仓位
建议先进行市场分析，制定交易计划
注意合约交易风险，合理控制仓位大小`;
    }

    let totalNotional = 0;
    let totalPnl = 0;
    let longPositions = 0;
    let shortPositions = 0;

    activePositions.forEach((pos) => {
      totalNotional += Math.abs(pos.notional);
      totalPnl += pos.unRealizedProfit;
      if (pos.positionAmt > 0) longPositions++;
      else shortPositions++;
    });

    let result = `🚀 合约持仓详情

📈 持仓概况：
持仓合约数：${activePositions.length}个
总名义价值：${this.formatPrice(totalNotional)} USDT
净敞口方向：${longPositions > shortPositions ? '偏多头' : shortPositions > longPositions ? '偏空头' : '平衡'}
风险等级：${this.getRiskLevel(totalPnl, totalNotional)}

💰 详细持仓信息：

`;

    activePositions.slice(0, 5).forEach((position, index) => {
      const symbol = position.symbol;
      const baseCurrency = symbol.replace('USDT', '');
      const direction = position.positionAmt > 0 ? '多头 (LONG)' : '空头 (SHORT)';
      const pnlStatus = position.unRealizedProfit >= 0 ? '✅ 盈利中' : '❌ 亏损中';
      const riskLevel = this.getPositionRiskLevel(
        position.liquidationPrice,
        position.markPrice,
        position.positionAmt > 0,
      );

      result += `【${index + 1}】${this.getCurrencyEmoji(baseCurrency)} ${symbol} 永续合约
持仓方向：${direction}
持仓数量：${position.positionAmt > 0 ? '+' : ''}${this.formatQuantity(Math.abs(position.positionAmt), baseCurrency)}
入场均价：${this.formatPrice(position.entryPrice)} USDT
标记价格：${this.formatPrice(position.markPrice)} USDT
当前价值：${this.formatPrice(Math.abs(position.notional))} USDT

💸 盈亏情况：
未实现盈亏：${position.unRealizedProfit >= 0 ? '+' : ''}${this.formatPrice(
        position.unRealizedProfit,
      )} USDT (${this.formatPercentage((position.unRealizedProfit / Math.abs(position.notional)) * 100)})
盈亏状态：${pnlStatus}

⚖️ 风险数据：
杠杆倍数：${position.leverage}x（${position.leverage > 10 ? '高风险' : position.leverage > 5 ? '中风险' : '低风险'}）
保证金类型：${position.marginType === 'isolated' ? '逐仓' : '全仓'}
强平价格：${this.formatPrice(position.liquidationPrice)} USDT
距强平：${this.formatPercentage(
        ((position.markPrice - position.liquidationPrice) / position.markPrice) *
          100 *
          (position.positionAmt > 0 ? 1 : -1),
      )}（${riskLevel}）

`;
    });

    result += `📊 总体分析：
总盈亏：${totalPnl >= 0 ? '+' : ''}${this.formatPrice(totalPnl)} USDT (${this.formatPercentage(
      (totalPnl / totalNotional) * 100,
    )})
多头敞口：${this.formatPrice(
      activePositions.filter((p) => p.positionAmt > 0).reduce((sum, p) => sum + Math.abs(p.notional), 0),
    )} USDT
空头敞口：${this.formatPrice(
      activePositions.filter((p) => p.positionAmt < 0).reduce((sum, p) => sum + Math.abs(p.notional), 0),
    )} USDT

💡 操作建议：
${this.getPositionAdvice(totalPnl, activePositions)}`;

    return result;
  }

  /**
   * 获取订单状态描述
   */
  private static getOrderStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      NEW: '⏳ 新建订单（等待成交）',
      PARTIALLY_FILLED: '🔄 部分成交',
      FILLED: '✅ 完全成交',
      CANCELED: '❌ 已取消',
      PENDING_CANCEL: '⏳ 取消中',
      REJECTED: '❌ 被拒绝',
      EXPIRED: '⏰ 已过期',
    };
    return statusMap[status] || status;
  }

  /**
   * 获取币种表情符号
   */
  private static getCurrencyEmoji(asset: string): string {
    const emojiMap: { [key: string]: string } = {
      BTC: '₿',
      ETH: '🔷',
      BNB: '🟠',
      USDT: '🟡',
      BUSD: '🔵',
      ADA: '🔵',
      DOT: '⚪',
      LINK: '🔗',
      LTC: '🥈',
      XRP: '💧',
    };
    return emojiMap[asset] || '💰';
  }

  /**
   * 获取币种中文名称
   */
  private static getCurrencyName(asset: string): string {
    const nameMap: { [key: string]: string } = {
      BTC: '比特币',
      ETH: '以太坊',
      BNB: '币安币',
      USDT: '泰达币',
      BUSD: '币安美元',
      ADA: '艾达币',
      DOT: '波卡',
      LINK: '链接币',
      LTC: '莱特币',
      XRP: '瑞波币',
    };
    return nameMap[asset] || asset;
  }

  /**
   * 获取风险等级
   */
  private static getRiskLevel(pnl: number, notional: number): string {
    const pnlPercent = (pnl / notional) * 100;
    if (pnlPercent > 5) return '🟢 低风险';
    if (pnlPercent > -5) return '🟡 中等风险';
    if (pnlPercent > -15) return '🟠 高风险';
    return '🔴 极高风险';
  }

  /**
   * 获取持仓风险等级
   */
  private static getPositionRiskLevel(liquidationPrice: number, markPrice: number, isLong: boolean): string {
    const distance = Math.abs((markPrice - liquidationPrice) / markPrice) * 100;
    if (distance > 20) return '相对安全';
    if (distance > 10) return '需关注';
    if (distance > 5) return '高风险';
    return '极危险';
  }

  /**
   * 获取持仓操作建议
   */
  private static getPositionAdvice(totalPnl: number, positions: any[]): string {
    if (totalPnl > 0) {
      return '目前持仓整体盈利，建议适当止盈保护利润。\n密切关注市场动态，及时调整止盈止损点位。';
    } else {
      const highRiskPositions = positions.filter((p) => {
        const distance = Math.abs((p.markPrice - p.liquidationPrice) / p.markPrice) * 100;
        return distance < 10;
      });

      if (highRiskPositions.length > 0) {
        return '存在高风险持仓，建议立即调整或减仓。\n建议增加保证金或设置止损降低风险。';
      } else {
        return '持仓风险可控，但需要关注市场变化。\n建议制定明确的止损止盈策略。';
      }
    }
  }

  /**
   * 格式化价格数据
   */
  static formatPriceData(data: any): string {
    const symbol = data.symbol || 'N/A';
    const price = this.formatNumber(data.price);

    return `💰 ${symbol} 当前价格\n\n价格：${price} ${
      symbol.includes('USDT') ? 'USDT' : ''
    }\n更新时间：${new Date().toLocaleString()}\n\n💡 价格仅供参考，实际交易价格可能有差异`;
  }

  /**
   * 格式化24小时行情
   */
  static format24hrTicker(ticker: any): string {
    const symbol = ticker.symbol || 'N/A';
    const lastPrice = this.formatNumber(ticker.lastPrice);
    const changePercent = this.formatPercentage(parseFloat(ticker.priceChangePercent) || 0);
    const volume = this.formatNumber(ticker.volume);
    const high = this.formatNumber(ticker.high);
    const low = this.formatNumber(ticker.low);
    const openPrice = this.formatNumber(ticker.openPrice);

    const trend = parseFloat(ticker.priceChangePercent) >= 0 ? '📈' : '📉';
    const trendText = parseFloat(ticker.priceChangePercent) >= 0 ? '上涨' : '下跌';

    return (
      `${trend} ${symbol} 24小时行情\n\n` +
      `💰 当前价格：${lastPrice} ${symbol.includes('USDT') ? 'USDT' : ''}\n` +
      `📊 24小时变化：${changePercent} (${trendText})\n` +
      `📈 最高价：${high} ${symbol.includes('USDT') ? 'USDT' : ''}\n` +
      `📉 最低价：${low} ${symbol.includes('USDT') ? 'USDT' : ''}\n` +
      `🕐 开盘价：${openPrice} ${symbol.includes('USDT') ? 'USDT' : ''}\n` +
      `📦 24小时成交量：${volume} ${symbol.replace('USDT', '').replace('BUSD', '')}\n\n` +
      `💡 数据更新时间：${new Date().toLocaleString()}`
    );
  }

  /**
   * 格式化订单簿深度
   */
  static formatOrderbook(orderbook: any): string {
    const bids = orderbook.bids || [];
    const asks = orderbook.asks || [];

    let result = '📊 订单深度 (实时买卖盘)\n\n';

    // 卖盘 (从高到低)
    result += '🔴 卖盘 (Ask):\n';
    asks.slice(0, 5).forEach((ask: string[], index: number) => {
      const price = this.formatNumber(ask[0]);
      const quantity = this.formatNumber(ask[1]);
      result += `${index + 1}. ${price} | ${quantity}\n`;
    });

    result += '\n';

    // 买盘 (从高到低)
    result += '🟢 买盘 (Bid):\n';
    bids.slice(0, 5).forEach((bid: string[], index: number) => {
      const price = this.formatNumber(bid[0]);
      const quantity = this.formatNumber(bid[1]);
      result += `${index + 1}. ${price} | ${quantity}\n`;
    });

    result += '\n💡 深度数据实时更新，价格按优先级排序';

    return result;
  }

  /**
   * 格式化账户信息
   */
  static formatAccountInfo(account: any): string {
    const accountType = account.accountType || 'SPOT';
    const canTrade = account.canTrade ? '✅' : '❌';
    const canWithdraw = account.canWithdraw ? '✅' : '❌';
    const canDeposit = account.canDeposit ? '✅' : '❌';

    let result = `👤 账户信息概览\n\n`;
    result += `📋 基本信息：\n`;
    result += `账户类型：${accountType === 'SPOT' ? '现货账户' : '合约账户'}\n`;
    result += `交易权限：${canTrade} ${account.canTrade ? '可交易' : '禁止交易'}\n`;
    result += `提现权限：${canWithdraw} ${account.canWithdraw ? '可提现' : '禁止提现'}\n`;
    result += `充值权限：${canDeposit} ${account.canDeposit ? '可充值' : '禁止充值'}\n`;
    result += `更新时间：${new Date(account.updateTime || Date.now()).toLocaleString()}\n\n`;

    if (account.totalWalletBalance) {
      result += `💰 资产统计：\n`;
      result += `总钱包余额：${this.formatNumber(account.totalWalletBalance)} USDT\n`;
      if (account.totalUnrealizedPnl) {
        const pnlIcon = parseFloat(account.totalUnrealizedPnl) >= 0 ? '📈' : '📉';
        result += `未实现盈亏：${pnlIcon} ${this.formatNumber(account.totalUnrealizedPnl)} USDT\n`;
      }
      result += '\n';
    }

    if (account.balances && account.balances.length > 0) {
      result += `📊 持仓资产：\n`;
      const activeBalances = account.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
      result += `活跃币种：${activeBalances.length} 种\n`;
      result += `总币种数：${account.balances.length} 种\n\n`;

      // 显示前5个有余额的币种
      activeBalances.slice(0, 5).forEach((balance: any) => {
        const emoji = this.getCurrencyEmoji(balance.asset);
        const total = parseFloat(balance.free) + parseFloat(balance.locked);
        result += `${emoji} ${balance.asset}: ${this.formatNumber(total)}\n`;
      });

      if (activeBalances.length > 5) {
        result += `... 及其他 ${activeBalances.length - 5} 种币种\n`;
      }
    }

    result += '\n💡 建议定期检查账户权限状态，确保交易安全';

    return result;
  }
}

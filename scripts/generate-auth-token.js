#!/usr/bin/env node

// Authorization Token 生成工具
// 用于生成Claude Desktop HTTP模式所需的authorization_token

import { AuthTokenHandler } from '../build/utils/auth.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function showUsage() {
  console.log('🔑 Binance MCP Authorization Token 生成工具');
  console.log('================================================');
  console.log('');
  console.log('使用方法:');
  console.log('  node scripts/generate-auth-token.js --api-key YOUR_API_KEY --secret-key YOUR_SECRET_KEY [--testnet]');
  console.log('');
  console.log('参数:');
  console.log('  --api-key      Binance API Key (必需)');
  console.log('  --secret-key   Binance Secret Key (必需)');
  console.log('  --testnet      使用测试网 (可选)');
  console.log('  --help         显示帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  # 主网配置');
  console.log('  node scripts/generate-auth-token.js --api-key "abc123..." --secret-key "def456..."');
  console.log('');
  console.log('  # 测试网配置');
  console.log('  node scripts/generate-auth-token.js --api-key "test_abc123..." --secret-key "test_def456..." --testnet');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    apiKey: null,
    secretKey: null,
    testnet: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--secret-key':
        config.secretKey = args[++i];
        break;
      case '--testnet':
        config.testnet = true;
        break;
      case '--help':
        config.help = true;
        break;
    }
  }

  return config;
}

function generateConfig(apiKey, secretKey) {
  const token = AuthTokenHandler.generateToken(apiKey, secretKey);
  
  return {
    "mcpServers": {
      "binance-mcp-server": {
        "command": "sse",
        "args": ["http://your-server:3000/message"],
        "authorization_token": token
      }
    }
  };
}

function main() {
  console.log('🔑 Binance MCP Authorization Token 生成工具');
  console.log('================================================\n');

  const config = parseArgs();

  if (config.help) {
    showUsage();
    return;
  }

  if (!config.apiKey || !config.secretKey) {
    console.log('❌ 错误: 缺少必需的参数\n');
    showUsage();
    process.exit(1);
  }

  try {
    // 生成token
    const token = AuthTokenHandler.generateToken(config.apiKey, config.secretKey);
    
    // 验证token
    if (!AuthTokenHandler.validateToken(token)) {
      throw new Error('生成的token验证失败');
    }

    console.log('✅ Authorization Token 生成成功!\n');
    
    console.log('📋 配置信息:');
    console.log(`   API Key: ${config.apiKey.substring(0, 8)}...`);
    console.log(`   Secret Key: ${config.secretKey.substring(0, 8)}...`);
    console.log(`   测试网模式: 请在服务器端环境变量BINANCE_TESTNET中设置`);
    console.log('');
    
    console.log('🔑 生成的Authorization Token:');
    console.log(`${token}\n`);
    
    console.log('📄 完整的Claude Desktop配置 (claude_desktop_config.json):');
    console.log('```json');
    console.log(JSON.stringify(generateConfig(config.apiKey, config.secretKey), null, 2));
    console.log('```\n');
    
    console.log('📝 配置步骤:');
    console.log('1. 复制上面的JSON配置');
    console.log('2. 替换 "your-server" 为实际的服务器地址');
    console.log('3. 在服务器端设置环境变量BINANCE_TESTNET=true/false');
    console.log('4. 保存到Claude Desktop配置文件中');
    console.log('5. 重启Claude Desktop');
    console.log('');
    
    console.log('📍 配置文件位置:');
    console.log('   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
    console.log('   Windows: %APPDATA%\\Claude\\claude_desktop_config.json');
    console.log('');
    
    console.log('🔐 安全提醒:');
    console.log('• 请妥善保管authorization_token，它包含您的API密钥信息');
    console.log('• 不要在公共场所或不安全的渠道分享此token');
    console.log('• 定期更换API密钥和重新生成token');
    
  } catch (error) {
    console.log(`❌ 生成失败: ${error.message}`);
    process.exit(1);
  }
}

main();
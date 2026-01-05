import * as dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

function asBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function asNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  server: {
    host: process.env.SERVER_HOST ?? process.env.HOST ?? '0.0.0.0',
    port: asNumber(process.env.SERVER_PORT ?? process.env.PORT, 3000),
    mode: process.env.SERVER_MODE ?? 'stdio',
  },
  binance: {
    apiKey: process.env.BINANCE_API_KEY ?? '',
    apiSecret: process.env.BINANCE_SECRET_KEY ?? '',
    apiUrl: process.env.BINANCE_API_URL ?? 'https://api.binance.com',
    testnet: asBoolean(process.env.BINANCE_TESTNET, false),
  },
  dune: {
    apiKey: process.env.DUNE_API_KEY ?? '',
  },
  rpc: {
    evm: process.env.EVM_RPC_URL ?? '',
    bitcoin: process.env.BITCOIN_RPC_URL ?? '',
    solana: process.env.SOLANA_RPC_URL ?? '',
    polygon: process.env.POLYGON_RPC_URL ?? '',
  },
  analytics: {
    defiLlamaBaseUrl: process.env.DEFI_LLAMA_BASE_URL ?? 'https://yields.llama.fi',
    fearGreedIndexUrl: process.env.FEAR_GREED_INDEX_URL ?? 'https://api.alternative.me/fng/',
    gdeltApiKey: process.env.GDELT_API_KEY ?? '',
    gdeltQueryEndpoint: process.env.GDELT_QUERY_ENDPOINT ?? 'https://api.gdeltproject.org/api/v2/doc/doc',
  },
  database: {
    sqlitePath: process.env.SQLITE_DB_PATH ?? './data/mcp.sqlite',
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
    format: process.env.LOG_FORMAT ?? 'json',
    enableHttpLogs: asBoolean(process.env.ENABLE_HTTP_LOGS, true),
  },
};

export type EnvConfig = typeof env;

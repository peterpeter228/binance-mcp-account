import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'liquidity_windowed:v1';

export function createLiquidityWindowTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_liquidity_window',
    description: 'Fetch order book depth snapshot with truncation handling and quality flags.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol (e.g., BTCUSDT).' },
        limit: {
          type: 'number',
          description: 'Depth limit. Defaults to 10. If more data exists, truncated flag is set.',
        },
        ttl_ms: { type: 'number', description: 'Cache TTL in milliseconds. Defaults to 5000.' },
      },
      required: ['symbol'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        ts_ms: { type: 'number' },
        data_age_ms: { type: 'number' },
        quality_flags: { type: 'array', items: { type: 'string' } },
        truncated: { type: 'boolean' },
        truncation_reason: { type: 'string' },
        provenance: { type: 'object' },
        window: { type: 'object' },
        data: { type: 'object' },
      },
      required: ['ts_ms', 'data_age_ms', 'provenance', 'data'],
    },
  };

  return {
    tool,
    execute: async (args: any) => {
      const symbol = (args?.symbol ?? 'BTCUSDT').toUpperCase();
      const limit = typeof args?.limit === 'number' ? args.limit : 10;
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 5_000;
      const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${Math.min(limit, 100)}`;

      const result = await httpClient.fetchJson<any>(url, {
        ttlMs,
        optional: true,
        source: 'binance_rest',
        cacheKey: `depth-${symbol}-${limit}`,
      });

      const bids = Array.isArray(result.value?.bids) ? result.value.bids.slice(0, limit) : [];
      const asks = Array.isArray(result.value?.asks) ? result.value.asks.slice(0, limit) : [];
      const availableBids = result.value?.bids?.length ?? 0;
      const availableAsks = result.value?.asks?.length ?? 0;
      const truncated = availableBids > bids.length || availableAsks > asks.length;

      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['orderbook_missing']);
      const rawProvenance = [
        {
          source: 'binance_rest',
          reference: url,
          ts_ms: result.tsMs,
          ttl_ms: ttlMs,
          hash: result.hash,
        },
      ];

      return buildObservation(
        {
          symbol,
          bids,
          asks,
          available_depth: {
            bids: availableBids,
            asks: availableAsks,
          },
        },
        {
          anchorTsMs: args?.anchor_ts_ms,
          windowMs: args?.window_ms,
          sourceTsMs: result.tsMs,
          qualityFlags,
          truncated,
          truncationReason: truncated ? 'limited_by_limit_parameter' : undefined,
          calcVersion,
          rawProvenance,
        },
      );
    },
  };
}

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'price_windowed:v1';

export function createPriceWindowTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_price_window',
    description: 'Fetch spot price with cache-aware REST calls and quality flag propagation.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to fetch (e.g., BTCUSDT).',
        },
        ttl_ms: {
          type: 'number',
          description: 'Cache TTL in milliseconds. Defaults to 10000.',
        },
      },
      required: ['symbol'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        ts_ms: { type: 'number' },
        data_age_ms: { type: 'number' },
        quality_flags: { type: 'array', items: { type: 'string' } },
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
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 10_000;
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;

      const result = await httpClient.fetchJson<{ price: string }>(url, {
        ttlMs,
        optional: true,
        source: 'binance_rest',
        cacheKey: `price-${symbol}`,
      });

      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['price_missing']);
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
          price: result.value?.price ?? null,
        },
        {
          anchorTsMs: args?.anchor_ts_ms,
          windowMs: args?.window_ms,
          sourceTsMs: result.tsMs,
          qualityFlags,
          calcVersion,
          rawProvenance,
        },
      );
    },
  };
}

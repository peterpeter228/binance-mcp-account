import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'funding_windowed:v1';

export function createFundingWindowTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_funding_window',
    description: 'Fetch recent funding rate snapshot with TTL-aware cache and provenance metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Perpetual symbol (e.g., BTCUSDT).',
        },
        ttl_ms: {
          type: 'number',
          description: 'Cache TTL in milliseconds. Defaults to 120000.',
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
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 120_000;
      const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;

      const result = await httpClient.fetchJson<any>(url, {
        ttlMs,
        optional: true,
        source: 'binance_futures',
        cacheKey: `funding-${symbol}`,
      });

      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['funding_missing']);
      const rawProvenance = [
        {
          source: 'binance_futures',
          reference: url,
          ts_ms: result.tsMs,
          ttl_ms: ttlMs,
          hash: result.hash,
        },
      ];

      return buildObservation(
        {
          symbol,
          funding_rate: result.value?.lastFundingRate ?? null,
          next_funding_time_ms: result.value?.nextFundingTime ?? null,
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

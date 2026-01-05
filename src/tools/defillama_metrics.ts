import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'defillama_metrics:v1';

export function createDefillamaMetricsTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_defillama_tvl',
    description: 'Fetch DeFiLlama TVL metrics (optional) with caching, provenance, and quality flags.',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          description: 'Protocol slug on DeFiLlama (e.g., uniswap). Optional and treated gracefully.',
        },
        ttl_ms: {
          type: 'number',
          description: 'TTL for cache in milliseconds. Defaults to 60000.',
        },
      },
      required: [],
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
      const protocol = args?.protocol ?? 'ethereum';
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 60_000;
      const url =
        protocol === 'aggregate'
          ? 'https://api.llama.fi/protocols'
          : `https://api.llama.fi/protocol/${encodeURIComponent(protocol)}`;

      const result = await httpClient.fetchJson<any>(url, {
        ttlMs,
        optional: true,
        source: 'defillama',
      });

      const data = protocol === 'aggregate' ? result.value ?? [] : result.value ?? {};
      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['defillama_missing']);
      const rawProvenance = [
        {
          source: 'defillama',
          reference: url,
          ts_ms: result.tsMs,
          ttl_ms: ttlMs,
          hash: result.hash,
        },
      ];

      return buildObservation(
        { tvl: data },
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

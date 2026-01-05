import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'dune_analytics:v1';

export function createDuneAnalyticsTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_dune_query',
    description:
      'Execute a cached Dune Analytics query (optional source) and return metrics with provenance and quality flags.',
    inputSchema: {
      type: 'object',
      properties: {
        query_url: {
          type: 'string',
          description: 'Fully qualified Dune query URL returning JSON. Treated as optional and cached with TTL.',
        },
        ttl_ms: {
          type: 'number',
          description: 'Cache TTL in milliseconds. Defaults to 30000.',
        },
      },
      required: ['query_url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        ts_ms: { type: 'number' },
        data_age_ms: { type: 'number' },
        quality_flags: { type: 'array', items: { type: 'string' } },
        truncated: { type: 'boolean' },
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
      const queryUrl = args?.query_url;
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 30_000;
      const result = await httpClient.fetchJson<any>(queryUrl, {
        ttlMs,
        optional: true,
        source: 'dune',
      });

      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['dune_missing']);
      const rawProvenance = [
        {
          source: 'dune',
          reference: queryUrl,
          ts_ms: result.tsMs,
          ttl_ms: ttlMs,
          hash: result.hash,
        },
      ];

      return buildObservation(
        {
          metrics: result.value ?? {},
          cache_hit: !!result,
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

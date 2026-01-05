import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'rpc_latency:v1';

export function createRpcLatencyTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_rpc_latency',
    description:
      'Measure latency against multiple RPC providers with fallback handling, caching, and quality flag propagation.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of RPC endpoints to probe. Optional; defaults to public endpoints.',
        },
        ttl_ms: {
          type: 'number',
          description: 'TTL for caching probe results. Defaults to 15000ms.',
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
      const endpoints: string[] =
        Array.isArray(args?.endpoints) && args.endpoints.length > 0
          ? args.endpoints
          : ['https://rpc.ankr.com/eth', 'https://rpc.ankr.com/bsc'];
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 15_000;

      const probes = await Promise.all(
        endpoints.map(async (endpoint) => {
          const start = Date.now();
          const response = await httpClient.fetchJson<any>(endpoint, {
            method: 'POST',
            optional: true,
            ttlMs,
            source: 'rpc',
            cacheKey: `rpc-${endpoint}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
          });
          const latencyMs = Date.now() - start;
          return {
            endpoint,
            latency_ms: response.value ? latencyMs : null,
            quality_flags: response.qualityFlags,
            hash: response.hash,
            ts_ms: response.tsMs,
          };
        }),
      );

      const aggregatedQuality = mergeQualityFlags(...probes.map((p) => p.quality_flags));
      const rawProvenance = probes.map((probe) => ({
        source: 'rpc',
        reference: probe.endpoint,
        ts_ms: probe.ts_ms,
        ttl_ms: ttlMs,
        hash: probe.hash,
      }));

      return buildObservation(
        { probes },
        {
          anchorTsMs: args?.anchor_ts_ms,
          windowMs: args?.window_ms,
          sourceTsMs: Date.now(),
          qualityFlags: aggregatedQuality,
          calcVersion,
          rawProvenance,
        },
      );
    },
  };
}

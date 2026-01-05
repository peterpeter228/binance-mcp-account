import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'rpc_balance:v1';

export function createRpcBalanceTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_rpc_balance',
    description:
      'Fetch account balance using fallback RPC providers with TTL-aware caching and optional source degradation.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address to query.',
        },
        network: {
          type: 'string',
          description: 'Network name for labeling (e.g., ethereum, bsc).',
        },
        rpc_endpoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fallback list of RPC endpoints. Optional.',
        },
        ttl_ms: {
          type: 'number',
          description: 'Cache TTL in milliseconds. Defaults to 20000.',
        },
      },
      required: ['address'],
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
      const address = args?.address;
      const network = args?.network ?? 'ethereum';
      const endpoints: string[] =
        Array.isArray(args?.rpc_endpoints) && args.rpc_endpoints.length > 0
          ? args.rpc_endpoints
          : ['https://rpc.ankr.com/eth', 'https://cloudflare-eth.com'];
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 20_000;

      const attempts = [];
      for (const endpoint of endpoints) {
        const response = await httpClient.fetchJson<any>(endpoint, {
          method: 'POST',
          ttlMs,
          optional: true,
          source: 'rpc',
          cacheKey: `rpc-balance-${endpoint}-${address}`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }),
        });
        attempts.push({
          endpoint,
          raw: response.value,
          quality_flags: response.qualityFlags,
          hash: response.hash,
          ts_ms: response.tsMs,
        });
        if (response.value && response.value.result) {
          break;
        }
      }

      const primary = attempts.find((a) => a.raw && a.raw.result);
      const qualityFlags = mergeQualityFlags(...attempts.map((a) => a.quality_flags), primary ? [] : ['no_successful_rpc']);
      const rawProvenance = attempts.map((attempt) => ({
        source: 'rpc',
        reference: attempt.endpoint,
        ts_ms: attempt.ts_ms,
        ttl_ms: ttlMs,
        hash: attempt.hash,
      }));

      return buildObservation(
        {
          address,
          network,
          balance: primary?.raw?.result ?? null,
          attempts,
        },
        {
          anchorTsMs: args?.anchor_ts_ms,
          windowMs: args?.window_ms,
          sourceTsMs: primary?.ts_ms ?? Date.now(),
          qualityFlags,
          calcVersion,
          rawProvenance,
        },
      );
    },
  };
}

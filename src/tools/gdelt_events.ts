import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'gdelt_events:v1';

export function createGdeltEventsTool(httpClient: HttpClient) {
  const tool: Tool = {
    name: 'observability_gdelt_events',
    description:
      'Fetch recent GDELT events (optional source) with quality flags, provenance, and unified time window metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Free text filter passed to GDELT. Treated as optional source.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return. Defaults to 5.',
        },
        ttl_ms: {
          type: 'number',
          description: 'Cache TTL in milliseconds. Defaults to 60000.',
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
      const search = args?.search ?? 'crypto';
      const limit = typeof args?.limit === 'number' ? args.limit : 5;
      const ttlMs = typeof args?.ttl_ms === 'number' ? args.ttl_ms : 60_000;
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(search)}&format=json`;

      const result = await httpClient.fetchJson<any>(gdeltUrl, {
        ttlMs,
        optional: true,
        source: 'gdelt',
      });

      const events = Array.isArray(result.value?.articles) ? result.value.articles.slice(0, limit) : [];
      const truncated = (result.value?.articles?.length ?? 0) > events.length;
      const qualityFlags = mergeQualityFlags(result.qualityFlags, result.value ? [] : ['gdelt_missing']);
      const rawProvenance = [
        {
          source: 'gdelt',
          reference: gdeltUrl,
          ts_ms: result.tsMs,
          ttl_ms: ttlMs,
          hash: result.hash,
        },
      ];

      return buildObservation(
        {
          events,
          total_available: result.value?.articles?.length ?? 0,
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

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildObservation } from '../infra/schemas.js';

const calcVersion = 'time_window_snapshot:v1';

export function createTimeWindowTool() {
  const tool: Tool = {
    name: 'observability_time_window_snapshot',
    description:
      'Generate a synthetic observation describing the active unified time window and auditing anchors for downstream tools.',
    inputSchema: {
      type: 'object',
      properties: {
        anchor_ts_ms: {
          type: 'number',
          description: 'Anchor timestamp for TIMEWINDOW_UNIFY in milliseconds.',
        },
        window_ms: {
          type: 'number',
          description: 'Window size to align to. Defaults to 60000ms.',
        },
        note: {
          type: 'string',
          description: 'Optional note describing the planned use of the window.',
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
        data: {
          type: 'object',
          properties: {
            note: { type: 'string' },
          },
        },
      },
      required: ['ts_ms', 'data_age_ms', 'provenance', 'window', 'data'],
    },
  };

  return {
    tool,
    execute: async (args: any) => {
      const anchorTsMs = typeof args?.anchor_ts_ms === 'number' ? args.anchor_ts_ms : undefined;
      const windowMs = typeof args?.window_ms === 'number' ? args.window_ms : undefined;
      return buildObservation(
        {
          note: args?.note ?? 'TIMEWINDOW_UNIFY anchor established',
        },
        {
          anchorTsMs,
          windowMs,
          sourceTsMs: anchorTsMs ?? Date.now(),
          calcVersion,
          rawProvenance: [
            {
              source: 'internal',
              reference: 'time_window_snapshot',
              ts_ms: anchorTsMs ?? Date.now(),
            },
          ],
        },
      );
    },
  };
}

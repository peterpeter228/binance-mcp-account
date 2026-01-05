import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GapDetector } from '../infra/ws_manager.js';
import { buildObservation, mergeQualityFlags } from '../infra/schemas.js';

const calcVersion = 'ws_gap_monitor:v1';

export function createWsGapTool() {
  const detector = new GapDetector('observability_ws');

  const tool: Tool = {
    name: 'observability_ws_gap',
    description: 'Detect websocket sequence/timing gaps and emit quality flags for downstream consumers.',
    inputSchema: {
      type: 'object',
      properties: {
        seq: { type: 'number', description: 'Sequence number from WS payload.' },
        ts_ms: { type: 'number', description: 'Timestamp from WS payload.' },
      },
      required: ['seq', 'ts_ms'],
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
      const seq = Number(args?.seq);
      const tsMs = Number(args?.ts_ms);
      const event = detector.ingest({ seq, tsMs, payload: args });
      const qualityFlags = mergeQualityFlags(event.qualityFlag ? [event.qualityFlag] : []);

      return buildObservation(
        {
          seq_received: seq,
          ws_gap_detected: event.gapDetected,
          expected_next_seq: event.expectedNextSeq,
        },
        {
          anchorTsMs: args?.anchor_ts_ms,
          windowMs: args?.window_ms,
          sourceTsMs: tsMs,
          qualityFlags,
          calcVersion,
          rawProvenance: [
            {
              source: 'ws',
              reference: 'ingest',
              ts_ms: tsMs,
            },
          ],
        },
      );
    },
  };
}

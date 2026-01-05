import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../infra/http_client.js';
import { logger } from '../infra/logging.js';
import { ObservationPayload } from '../infra/schemas.js';
import { createTimeWindowTool } from './time_window_snapshot.js';
import { createDuneAnalyticsTool } from './dune_analytics.js';
import { createGdeltEventsTool } from './gdelt_events.js';
import { createDefillamaMetricsTool } from './defillama_metrics.js';
import { createRpcLatencyTool } from './rpc_latency.js';
import { createRpcBalanceTool } from './rpc_balance.js';
import { createWsGapTool } from './ws_gap_monitor.js';
import { createPriceWindowTool } from './price_windowed.js';
import { createFundingWindowTool } from './funding_windowed.js';
import { createLiquidityWindowTool } from './liquidity_windowed.js';

export interface ObservabilityTool {
  tool: Tool;
  execute: (args: any) => Promise<ObservationPayload<any>>;
}

function formatObservation(observation: ObservationPayload<any>) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(observation, null, 2),
      },
    ],
  };
}

export function createObservabilityTools(httpClient?: HttpClient): {
  tools: Tool[];
  handlers: Record<string, (args: any) => Promise<any>>;
} {
  const client = httpClient ?? new HttpClient();

  const definitions: ObservabilityTool[] = [
    createTimeWindowTool(),
    createDuneAnalyticsTool(client),
    createGdeltEventsTool(client),
    createDefillamaMetricsTool(client),
    createRpcLatencyTool(client),
    createRpcBalanceTool(client),
    createWsGapTool(),
    createPriceWindowTool(client),
    createFundingWindowTool(client),
    createLiquidityWindowTool(client),
  ];

  const handlers: Record<string, (args: any) => Promise<any>> = {};
  const tools: Tool[] = [];

  definitions.forEach((definition) => {
    tools.push(definition.tool);
    handlers[definition.tool.name] = async (args: any) => {
      const observation = await definition.execute(args);
      logger.debug(`Executed ${definition.tool.name}`);
      return formatObservation(observation);
    };
  });

  return { tools, handlers };
}

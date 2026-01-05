import assert from 'node:assert/strict';
import { HttpClient } from '../src/infra/http_client.js';
import { buildObservation, mergeQualityFlags } from '../src/infra/schemas.js';
import { createTimeWindowTool } from '../src/tools/time_window_snapshot.js';
import { createDuneAnalyticsTool } from '../src/tools/dune_analytics.js';
import { createGdeltEventsTool } from '../src/tools/gdelt_events.js';
import { createDefillamaMetricsTool } from '../src/tools/defillama_metrics.js';
import { createRpcLatencyTool } from '../src/tools/rpc_latency.js';
import { createRpcBalanceTool } from '../src/tools/rpc_balance.js';
import { createWsGapTool } from '../src/tools/ws_gap_monitor.js';
import { createPriceWindowTool } from '../src/tools/price_windowed.js';
import { createFundingWindowTool } from '../src/tools/funding_windowed.js';
import { createLiquidityWindowTool } from '../src/tools/liquidity_windowed.js';

class StubHttpClient extends HttpClient {
  private responses: Record<string, any>;

  constructor(responses: Record<string, any>) {
    super(1000);
    this.responses = responses;
  }

  async fetchJson<T = any>(url: string, options: any = {}): Promise<any> {
    const now = Date.now();
    const payload = this.responses[url];
    if (payload) {
      return {
        value: payload as T,
        tsMs: now,
        ttlMs: options.ttlMs ?? 1000,
        hash: 'stubhash',
        qualityFlags: [],
        source: options.source ?? 'stub',
      };
    }
    return {
      value: null,
      tsMs: now,
      ttlMs: options.ttlMs ?? 1000,
      hash: undefined,
      qualityFlags: ['stub_missing'],
      source: options.source ?? 'stub',
    };
  }
}

function makeResponse(body: any) {
  return {
    ok: true,
    async json() {
      return body;
    },
  };
}

async function testHttpClientCache() {
  let fetches = 0;
  const client = new HttpClient(10_000, async () => {
    fetches += 1;
    return makeResponse({ value: fetches });
  });

  const first = await client.fetchJson('https://cache.test');
  const second = await client.fetchJson('https://cache.test');
  assert.equal(fetches, 1, 'should serve second call from cache');
  assert.deepEqual(first.value, second.value);
}

async function testTools() {
  const now = Date.now();
  const stubResponses: Record<string, any> = {
    'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT': { price: '50000' },
    'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT': {
      lastFundingRate: '0.0001',
      nextFundingTime: now + 3600_000,
    },
    'https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=2': {
      bids: [
        ['50000', '1'],
        ['49900', '2'],
        ['49800', '3'],
      ],
      asks: [
        ['50100', '1'],
        ['50200', '2'],
        ['50300', '3'],
      ],
    },
    'https://api.gdeltproject.org/api/v2/doc/doc?query=crypto&format=json': {
      articles: [{ id: 1 }, { id: 2 }, { id: 3 }],
    },
    'https://api.llama.fi/protocol/ethereum': { tvl: 123 },
    'https://rpc.ankr.com/eth': { result: '0xde0b6b3a7640000' },
    'https://rpc.ankr.com/bsc': { result: '0x1' },
    'https://cloudflare-eth.com': { result: '0xde0b6b3a7640000' },
    'https://api.dune.test/mock': { rows: [{ key: 'value' }] },
  };

  const stubClient = new StubHttpClient(stubResponses);

  const timeTool = createTimeWindowTool();
  const timeObs = await timeTool.execute({ anchor_ts_ms: now });
  assert(timeObs.window.window_end_ms > timeObs.window.window_start_ms);

  const duneTool = createDuneAnalyticsTool(stubClient);
  const duneObs = await duneTool.execute({ query_url: 'https://api.dune.test/mock' });
  assert.equal(duneObs.data.metrics.rows.length, 1);

  const gdeltTool = createGdeltEventsTool(stubClient);
  const gdeltObs = await gdeltTool.execute({ limit: 2 });
  assert.equal(gdeltObs.data.events.length, 2);
  assert.equal(gdeltObs.truncated, true);
  assert.ok(gdeltObs.truncation_reason);

  const defillamaTool = createDefillamaMetricsTool(stubClient);
  const defillamaObs = await defillamaTool.execute({});
  assert.equal(defillamaObs.data.tvl.tvl, 123);

  const rpcLatencyTool = createRpcLatencyTool(stubClient);
  const rpcLatencyObs = await rpcLatencyTool.execute({
    endpoints: ['https://rpc.ankr.com/eth', 'https://rpc.ankr.com/bsc'],
  });
  assert.equal(rpcLatencyObs.data.probes.length, 2);

  const rpcBalanceTool = createRpcBalanceTool(stubClient);
  const rpcBalanceObs = await rpcBalanceTool.execute({ address: '0x123' });
  assert.ok(rpcBalanceObs.data.balance);

  const wsTool = createWsGapTool();
  await wsTool.execute({ seq: 1, ts_ms: now });
  const wsGapObs = await wsTool.execute({ seq: 3, ts_ms: now + 1000 });
  assert(wsGapObs.quality_flags.includes('observability_ws_gap_detected'));

  const priceTool = createPriceWindowTool(stubClient);
  const priceObs = await priceTool.execute({ symbol: 'BTCUSDT' });
  assert.equal(priceObs.data.price, '50000');

  const fundingTool = createFundingWindowTool(stubClient);
  const fundingObs = await fundingTool.execute({ symbol: 'BTCUSDT' });
  assert.equal(fundingObs.data.funding_rate, '0.0001');

  const liquidityTool = createLiquidityWindowTool(stubClient);
  const liquidityObs = await liquidityTool.execute({ symbol: 'BTCUSDT', limit: 2 });
  assert(liquidityObs.truncated);
  assert.equal(liquidityObs.data.bids.length, 2);

  // Provenance & quality flag propagation
  const merged = mergeQualityFlags(['a', 'b'], ['b', 'c']);
  assert.deepEqual(merged.sort(), ['a', 'b', 'c']);

  assert(timeObs.provenance.raw.length > 0);
}

async function run() {
  await testHttpClientCache();
  await testTools();
  console.log('✅ observability tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

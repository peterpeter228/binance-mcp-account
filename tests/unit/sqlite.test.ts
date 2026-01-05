import { initializeDatabase } from '../../src/infra/sqlite.js';
import { cacheRestResponse, getRestCache, cacheWsMessage, getWsCache, setToolOutput, getToolOutput, hashPayload } from '../../src/infra/cache.js';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-db.db');

beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('SQLite initialization', () => {
  it('creates all required tables', () => {
    const { primary } = initializeDatabase(TEST_DB_PATH);
    const tables = primary.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);
    expect(tableNames).toEqual(expect.arrayContaining(['rest_cache', 'ws_cache', 'tool_outputs', 'payload_hashes']));
  });
});

describe('Cache operations', () => {
  it('stores and retrieves REST cache with TTL', () => {
    initializeDatabase(TEST_DB_PATH);
    cacheRestResponse('k1', 'payload1', 1000, TEST_DB_PATH);
    const value = getRestCache('k1', TEST_DB_PATH);
    expect(value).toBe('payload1');
  });

  it('expires REST cache', async () => {
    initializeDatabase(TEST_DB_PATH);
    cacheRestResponse('k2', 'payload2', 10, TEST_DB_PATH);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const value = getRestCache('k2', TEST_DB_PATH);
    expect(value).toBeNull();
  });

  it('stores and retrieves WS cache', () => {
    initializeDatabase(TEST_DB_PATH);
    cacheWsMessage('k3', 'payload3', 1000, TEST_DB_PATH);
    const value = getWsCache('k3', TEST_DB_PATH);
    expect(value).toBe('payload3');
  });
});

describe('Tool outputs', () => {
  it('stores and retrieves tool output by hash', () => {
    initializeDatabase(TEST_DB_PATH);
    const input = JSON.stringify({ a: 1 });
    const hash = hashPayload(input);
    setToolOutput('toolA', input, 'resultA', TEST_DB_PATH);
    const output = getToolOutput('toolA', input, TEST_DB_PATH);
    expect(hash).toBeDefined();
    expect(output).toBe('resultA');
  });
});

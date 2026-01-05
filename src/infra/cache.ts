import { getDatabase } from './sqlite.js';
import { computeExpiry, isExpired, sha256 } from './hashing.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheTable = 'rest_cache' | 'ws_cache';

type CachedRow = {
  id: number;
  key: string;
  payload: string;
  expires_at: number;
  created_at: number;
};

type ToolOutputRow = {
  id: number;
  tool: string;
  input_hash: string;
  output: string;
  created_at: number;
};

function getDb(dbPath?: string) {
  return getDatabase(dbPath).primary;
}

export function setCache(table: CacheTable, key: string, payload: string, ttlMs: number = DEFAULT_TTL_MS, dbPath?: string) {
  const db = getDb(dbPath);
  const expiresAt = computeExpiry(ttlMs);
  const createdAt = Date.now();

  const insert = db.prepare(
    `INSERT INTO ${table} (key, payload, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  );
  insert.run(key, payload, expiresAt, createdAt);
}

export function getCache(table: CacheTable, key: string, dbPath?: string): string | null {
  const db = getDb(dbPath);
  const row = db
    .prepare(`SELECT * FROM ${table} WHERE key = ? ORDER BY id DESC LIMIT 1`)
    .get(key) as CachedRow | undefined;

  if (!row) return null;
  if (isExpired(row.expires_at)) {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
    return null;
  }

  return row.payload;
}

export function setToolOutput(tool: string, input: string, output: string, dbPath?: string) {
  const db = getDb(dbPath);
  const inputHash = sha256(input);
  const createdAt = Date.now();

  db.prepare(
    `INSERT INTO tool_outputs (tool, input_hash, output, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(tool, inputHash, output, createdAt);

  db.prepare(
    `INSERT INTO payload_hashes (hash, created_at)
     VALUES (?, ?)`
  ).run(inputHash, createdAt);
}

export function getToolOutput(tool: string, input: string, dbPath?: string): string | null {
  const db = getDb(dbPath);
  const inputHash = sha256(input);
  const row = db
    .prepare(
      `SELECT * FROM tool_outputs
       WHERE tool = ? AND input_hash = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(tool, inputHash) as ToolOutputRow | undefined;

  return row ? row.output : null;
}

export function cacheRestResponse(key: string, payload: string, ttlMs?: number, dbPath?: string) {
  setCache('rest_cache', key, payload, ttlMs, dbPath);
}

export function getRestCache(key: string, dbPath?: string) {
  return getCache('rest_cache', key, dbPath);
}

export function cacheWsMessage(key: string, payload: string, ttlMs?: number, dbPath?: string) {
  setCache('ws_cache', key, payload, ttlMs, dbPath);
}

export function getWsCache(key: string, dbPath?: string) {
  return getCache('ws_cache', key, dbPath);
}

export function hashPayload(payload: string): string {
  return sha256(payload);
}

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface DatabaseConnections {
  primary: Database.Database;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'binance-mcp.db');

function ensureDirectory(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runMigrations(db: Database.Database) {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS rest_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ws_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tool_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payload_hashes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`
  ];

  const pragma = db.prepare('PRAGMA journal_mode = WAL;');
  pragma.run();

  for (const sql of createStatements) {
    db.prepare(sql).run();
  }
}

export function initializeDatabase(dbPath: string = DEFAULT_DB_PATH): DatabaseConnections {
  ensureDirectory(dbPath);
  const primary = new Database(dbPath);
  runMigrations(primary);
  return { primary };
}

export function getDatabase(dbPath?: string): DatabaseConnections {
  return initializeDatabase(dbPath);
}

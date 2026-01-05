import crypto from 'crypto';
import { logger as baseLogger } from '../utils/logger.js';

export interface AuditRecord<T = any> {
  tool: string;
  tsMs: number;
  hash: string;
  payloadPreview: string;
  meta?: T;
}

export function hashPayload(payload: any): string {
  const normalized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function createAuditRecord(tool: string, payload: any, meta?: any): AuditRecord {
  const tsMs = Date.now();
  const hash = hashPayload(payload);
  const payloadPreview = typeof payload === 'string' ? payload.slice(0, 128) : JSON.stringify(payload).slice(0, 128);
  return {
    tool,
    tsMs,
    hash,
    payloadPreview,
    meta,
  };
}

export const logger = {
  debug: (message: string, ...args: any[]) => baseLogger.debug(message, ...args),
  info: (message: string, ...args: any[]) => baseLogger.info(message, ...args),
  warn: (message: string, ...args: any[]) => baseLogger.warn(message, ...args),
  error: (message: string, ...args: any[]) => baseLogger.error(message, ...args),
  audit: (record: AuditRecord) => baseLogger.info(`AUDIT ${record.tool} ${record.hash}`, record),
};

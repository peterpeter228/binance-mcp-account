import crypto from 'crypto';

/**
 * Compute SHA-256 hash for a payload.
 */
export function sha256(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Determine whether a given expiration timestamp (ms) has passed.
 */
export function isExpired(expiresAt: number): boolean {
  return expiresAt <= Date.now();
}

/**
 * Calculate an expiration timestamp based on a TTL in milliseconds.
 */
export function computeExpiry(ttlMs: number): number {
  return Date.now() + ttlMs;
}


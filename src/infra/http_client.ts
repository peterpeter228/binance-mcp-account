import crypto from 'crypto';
import fetch, { RequestInit } from 'node-fetch';
import { logger } from './logging.js';

export interface CachedResponse<T = any> {
  value: T | null;
  tsMs: number;
  ttlMs: number;
  hash?: string;
  qualityFlags: string[];
  source: string;
}

export interface FetchOptions extends RequestInit {
  ttlMs?: number;
  optional?: boolean;
  source?: string;
  cacheKey?: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<any>;

export class HttpClient {
  private cache = new Map<string, CachedResponse>();
  private defaultTtlMs: number;
  private readonly fetcher: Fetcher;

  constructor(defaultTtlMs: number = 15_000, fetcher: Fetcher = fetch as any) {
    this.defaultTtlMs = defaultTtlMs;
    this.fetcher = fetcher;
  }

  async fetchJson<T = any>(url: string, options: FetchOptions = {}): Promise<CachedResponse<T>> {
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const cacheKey = options.cacheKey ?? url;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    const source = options.source ?? 'http';

    if (cached && cached.tsMs + cached.ttlMs > now) {
      return cached as CachedResponse<T>;
    }

    try {
      const response = await this.fetcher(url, options);
      if (!response.ok) {
        const errMessage = `HTTP ${response.status} for ${url}`;
        if (options.optional) {
          logger.warn(`Optional source failed: ${errMessage}`);
          const fallback: CachedResponse<T> = {
            value: null,
            tsMs: now,
            ttlMs,
            qualityFlags: [`optional_source_unavailable:${source}`],
            source,
          };
          this.cache.set(cacheKey, fallback);
          return fallback;
        }
        throw new Error(errMessage);
      }

      const json = (await response.json()) as T;
      const hash = crypto.createHash('sha256').update(JSON.stringify(json)).digest('hex');
      const wrapped: CachedResponse<T> = {
        value: json,
        tsMs: now,
        ttlMs,
        hash,
        qualityFlags: [],
        source,
      };
      this.cache.set(cacheKey, wrapped);
      return wrapped;
    } catch (error) {
      if (options.optional) {
        logger.warn(`Optional source error for ${source}: ${String(error)}`);
        const fallback: CachedResponse<T> = {
          value: null,
          tsMs: now,
          ttlMs,
          qualityFlags: [`optional_source_error:${source}`],
          source,
        };
        this.cache.set(cacheKey, fallback);
        return fallback;
      }
      logger.error(`HTTP fetch failed for ${url}`, error);
      throw error;
    }
  }
}

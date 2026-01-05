import { z } from 'zod';
import { calculateDataAgeMs, unifyTimeWindow } from './time.js';
import { createAuditRecord, logger } from './logging.js';

export const rawProvenanceSchema = z.object({
  source: z.string(),
  reference: z.string(),
  ts_ms: z.number().nonnegative(),
  ttl_ms: z.number().nonnegative().optional(),
  hash: z.string().optional(),
});

export const provenanceSchema = z.object({
  calc_version: z.string(),
  raw: z.array(rawProvenanceSchema),
});

export const qualityFlagsSchema = z.array(z.string());

export const baseWindowSchema = z.object({
  anchor_ts_ms: z.number().nonnegative(),
  window_start_ms: z.number().nonnegative(),
  window_end_ms: z.number().nonnegative(),
  window_ms: z.number().nonnegative(),
});

export const baseObservationSchema = z.object({
  ts_ms: z.number().nonnegative(),
  data_age_ms: z.number().nonnegative(),
  quality_flags: qualityFlagsSchema,
  truncated: z.boolean().default(false),
  truncation_reason: z.string().optional(),
  provenance: provenanceSchema,
  window: baseWindowSchema,
});

export type BaseObservation = z.infer<typeof baseObservationSchema>;

export interface ObservationPayload<T> extends BaseObservation {
  data: T;
}

export interface ObservationArgs {
  anchorTsMs?: number;
  sourceTsMs: number;
  windowMs?: number;
  qualityFlags?: string[];
  truncated?: boolean;
  truncationReason?: string;
  calcVersion: string;
  rawProvenance: Array<z.infer<typeof rawProvenanceSchema>>;
}

export function buildObservation<T>(data: T, args: ObservationArgs): ObservationPayload<T> {
  const window = unifyTimeWindow(args.anchorTsMs, args.windowMs);
  const tsMs = Date.now();
  const dataAgeMs = calculateDataAgeMs(tsMs, args.sourceTsMs);
  const observation: ObservationPayload<T> = {
    ts_ms: tsMs,
    data_age_ms: dataAgeMs,
    quality_flags: args.qualityFlags ?? [],
    truncated: args.truncated ?? false,
    truncation_reason: args.truncationReason,
    provenance: {
      calc_version: args.calcVersion,
      raw: args.rawProvenance,
    },
    window,
    data,
  };

  logger.audit(createAuditRecord('observation', observation, { calcVersion: args.calcVersion }));
  return observation;
}

export function mergeQualityFlags(...sets: Array<string[] | undefined>): string[] {
  const merged = new Set<string>();
  sets.forEach((set) => {
    (set ?? []).forEach((flag) => merged.add(flag));
  });
  return Array.from(merged);
}

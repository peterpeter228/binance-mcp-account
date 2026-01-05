import EventEmitter from 'events';
import { logger } from './logging.js';

export interface GapEvent {
  gapDetected: boolean;
  expectedNextSeq?: number;
  receivedSeq?: number;
  qualityFlag?: string;
}

export interface WsMessageEnvelope {
  seq: number;
  tsMs: number;
  payload: any;
}

export class GapDetector extends EventEmitter {
  private lastSeq?: number;
  private lastTsMs?: number;
  private readonly maxGapMs: number;
  private readonly label: string;

  constructor(label: string, maxGapMs: number = 5_000) {
    super();
    this.label = label;
    this.maxGapMs = maxGapMs;
  }

  ingest(message: WsMessageEnvelope): GapEvent {
    const now = Date.now();
    const timeGap = this.lastTsMs ? now - this.lastTsMs : 0;
    const expectedNextSeq = this.lastSeq !== undefined ? this.lastSeq + 1 : undefined;
    const seqGap = expectedNextSeq !== undefined && message.seq !== expectedNextSeq;

    const gapDetected = seqGap || timeGap > this.maxGapMs;
    const qualityFlag = gapDetected ? `${this.label}_gap_detected` : undefined;

    this.lastSeq = message.seq;
    this.lastTsMs = now;

    const event: GapEvent = {
      gapDetected,
      expectedNextSeq,
      receivedSeq: message.seq,
      qualityFlag,
    };

    if (gapDetected) {
      logger.warn(`WS gap detected for ${this.label}`, event);
      this.emit('gap', event);
    }
    return event;
  }
}

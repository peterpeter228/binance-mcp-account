import path from 'node:path';

import { Logger } from '../utils/logger.js';
import { env } from './env.js';

const defaultLogFile = path.join(process.cwd(), 'logs', 'binance-mcp-server.log');

export const logger = new Logger(env.logging.level, defaultLogFile);

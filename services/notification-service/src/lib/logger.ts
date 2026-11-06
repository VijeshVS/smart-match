import { createLogger, type Logger } from '@talent-ai/logger';
import { config } from '../config.js';

export const logger: Logger = createLogger({
  serviceName: config.serviceName,
  level: config.logLevel,
});

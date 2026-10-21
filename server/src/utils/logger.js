import { config } from '../config/env.js';

/**
 * Tiny console logger. Tests stay quiet; production emits one line per event so
 * Render's log viewer stays readable. Intentionally not a dependency.
 */
const silent = config.isTest;

export const logger = {
  info: (...args) => !silent && console.log('[info]', ...args),
  warn: (...args) => !silent && console.warn('[warn]', ...args),
  error: (...args) => !silent && console.error('[error]', ...args),
  debug: (...args) => !silent && config.isDevelopment && console.debug('[debug]', ...args),
};

export default logger;

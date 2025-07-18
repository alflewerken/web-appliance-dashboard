// Centralized logging utility
const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const logger = {
  error: (...args) => {
    if (levels[logLevel] >= levels.error) {
      console.error('[ERROR]', new Date().toISOString(), ...args);
    }
  },
  warn: (...args) => {
    if (levels[logLevel] >= levels.warn) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },
  info: (...args) => {
    if (levels[logLevel] >= levels.info) {
      console.info('[INFO]', new Date().toISOString(), ...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment && levels[logLevel] >= levels.debug) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }
};

module.exports = logger;

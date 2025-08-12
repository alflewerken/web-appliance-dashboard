// Temporary simple logger until winston is properly configured
const logger = {
    info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
    error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
    warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
    debug: (...args) => console.debug('[DEBUG]', new Date().toISOString(), ...args),
    stream: {
        write: (message) => console.log('[STREAM]', message.trim())
    }
};

module.exports = { logger };
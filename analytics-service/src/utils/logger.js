export const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...meta }));
  },
  error: (message, meta = {}) => {
    console.error(JSON.stringify({ level: 'ERROR', message, ...meta }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({ level: 'WARN', message, ...meta }));
  },
  debug: (message, meta = {}) => {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(JSON.stringify({ level: 'DEBUG', message, ...meta }));
    }
  }
};

export const logger = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...data })),
  warn: (msg, data = {}) => console.warn(JSON.stringify({ level: 'WARN', msg, ...data })),
  error: (msg, data = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...data }))
};

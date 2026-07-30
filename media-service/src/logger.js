export const createLogger = (event) => {
    // Extract request context for logging
    const requestId = event?.requestContext?.requestId || 'N/A';
    const route = event?.routeKey || event?.rawPath || event?.path || 'N/A';
    const method = event?.requestContext?.http?.method || event?.httpMethod || 'N/A';
    const startTime = Date.now();

    const formatLog = (level, message, data = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            requestId,
            route,
            method,
            executionTimeMs: Date.now() - startTime,
            message,
            ...data
        };
        return JSON.stringify(logEntry);
    };

    return {
        info: (message, data) => console.log(formatLog('INFO', message, data)),
        warn: (message, data) => console.warn(formatLog('WARN', message, data)),
        error: (message, data) => console.error(formatLog('ERROR', message, data))
    };
};

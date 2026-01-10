/**
 * Structured Logging Utility
 * Provides structured logging with levels, context, and optional analytics hooks
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLogLevel = LOG_LEVELS.INFO;
let analyticsHook = null;

/**
 * Set the log level
 * 
 * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR'
 */
export function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLogLevel = LOG_LEVELS[level];
  }
}

/**
 * Set analytics hook for structured logging
 * 
 * @param {function} hook - Function to call with log data
 */
export function setAnalyticsHook(hook) {
  analyticsHook = hook;
}

/**
 * Create structured log entry
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
function log(level, message, context = {}) {
  if (LOG_LEVELS[level] < currentLogLevel) {
    return; // Skip if below current log level
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // Console logging (always for errors and warnings)
  if (level === 'ERROR') {
    console.error(`[${level}] ${message}`, context);
  } else if (level === 'WARN') {
    console.warn(`[${level}] ${message}`, context);
  } else if (level === 'INFO') {
    console.log(`[${level}] ${message}`, context);
  } else if (level === 'DEBUG' && import.meta.env.DEV) {
    console.debug(`[${level}] ${message}`, context);
  }

  // Send to analytics hook if available
  if (analyticsHook && typeof analyticsHook === 'function') {
    try {
      analyticsHook(logEntry);
    } catch (error) {
      console.error('[Logger] Analytics hook error:', error);
    }
  }
}

/**
 * Log debug message
 */
export function debug(message, context = {}) {
  log('DEBUG', message, context);
}

/**
 * Log info message
 */
export function info(message, context = {}) {
  log('INFO', message, context);
}

/**
 * Log warning message
 */
export function warn(message, context = {}) {
  log('WARN', message, context);
}

/**
 * Log error message
 */
export function error(message, context = {}) {
  log('ERROR', message, context);
}

/**
 * Log performance metric
 */
export function performance(metric, value, context = {}) {
  log('INFO', `Performance: ${metric}`, {
    metric,
    value,
    ...context,
  });
}

/**
 * Log user action (for analytics)
 */
export function userAction(action, context = {}) {
  log('INFO', `User Action: ${action}`, {
    action,
    ...context,
  });
}


/**
 * Structured logging utility for API routes and server-side code.
 * Replaces console.log/console.error with structured, context-aware logging.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  tenantId?: string | null;
  requestId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private isDev: boolean;
  private isTest: boolean;

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development';
    this.isTest = process.env.NODE_ENV === 'test';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isTest) return level === 'error'; // Only errors in test
    return true;
  }

  private format(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...(error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDev ? error.stack : undefined,
          code: (error as { code?: string }).code,
        }
      } : {}),
    };
  }

  private output(entry: LogEntry): void {
    const output = this.isDev 
      ? `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
      : JSON.stringify(entry);
    
    switch (entry.level) {
      case 'debug':
        if (this.isDev) console.debug(output);
        break;
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    this.output(this.format('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    this.output(this.format('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    this.output(this.format('warn', message, context));
  }

  error(message: string, error: Error, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    this.output(this.format('error', message, context, error));
  }

  /**
   * Log API request/response cycle
   */
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, { method, path, ...context });
  }

  /**
   * Log API error with full context
   */
  apiError(method: string, path: string, error: Error, context?: LogContext): void {
    this.error(`API ${method} ${path} failed`, error, { method, path, ...context });
  }

  /**
   * Log database operations
   */
  dbOperation(operation: string, model: string, context?: LogContext): void {
    this.debug(`DB ${operation} on ${model}`, { operation, model, ...context });
  }

  /**
   * Log database errors
   */
  dbError(operation: string, model: string, error: Error, context?: LogContext): void {
    this.error(`DB ${operation} on ${model} failed`, error, { operation, model, ...context });
  }
}

export const logger = new Logger();

/**
 * Create a child logger with preset context
 */
export function createChildLogger(baseContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => 
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) => 
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) => 
      logger.warn(message, { ...baseContext, ...context }),
    error: (message: string, error: Error, context?: LogContext) => 
      logger.error(message, error, { ...baseContext, ...context }),
    apiRequest: (method: string, path: string, context?: LogContext) => 
      logger.apiRequest(method, path, { ...baseContext, ...context }),
    apiError: (method: string, path: string, error: Error, context?: LogContext) => 
      logger.apiError(method, path, error, { ...baseContext, ...context }),
    dbOperation: (operation: string, model: string, context?: LogContext) => 
      logger.dbOperation(operation, model, { ...baseContext, ...context }),
    dbError: (operation: string, model: string, error: Error, context?: LogContext) => 
      logger.dbError(operation, model, error, { ...baseContext, ...context }),
  };
}

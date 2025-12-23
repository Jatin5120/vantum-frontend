/**
 * Structured Logger
 * Provides log levels and structured logging with context
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevelValue = typeof LogLevel[keyof typeof LogLevel];

export interface LogContext {
  eventType?: string;
  sessionId?: string;
  eventId?: string;
  utteranceId?: string;
  connectionId?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevelValue;
  private enabled: boolean;

  constructor() {
    // Set log level from environment or default to INFO
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
    this.level = (envLevel && envLevel in LogLevel) 
      ? (LogLevel[envLevel as keyof typeof LogLevel] as LogLevelValue)
      : LogLevel.INFO;
    this.enabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGGING === 'true';
  }

  private shouldLog(level: LogLevelValue): boolean {
    return this.enabled && level >= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext: LogContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
      };
      console.error(this.formatMessage('ERROR', message, errorContext));
    }
  }
}

export const logger = new Logger();

type _LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

class EnvironmentLogger implements Logger {
  private shouldLog(): boolean {
    return (
      typeof window === 'undefined' && // Server-side only
      process.env.NODE_ENV === 'development' && // Development only
      !process.env.NEXT_PHASE && // Not during build
      !process.env.CI // Not in CI
    );
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog()) {
      console.debug(`[COD Debug] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog()) {
      console.info(`[COD Info] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog()) {
      console.warn(`[COD Warn] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog()) {
      console.error(`[COD Error] ${message}`, ...args);
    }
  }
}

export const logger = new EnvironmentLogger();
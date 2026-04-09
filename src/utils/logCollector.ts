
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type LogLevel = 'LOG' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  messages: any[];
}

type LoggableConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

class LogCollector {
  private logs: LogEntry[] = [];
  private originalConsole: Partial<Console> = {};
  private isStarted = false;
  private readonly MAX_LOGS = 1000; // Reduced to keep memory footprint light

  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;

    const levels: Record<LogLevel, LoggableConsoleMethod> = {
      LOG: 'log',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      DEBUG: 'debug',
    };

    for (const [level, method] of Object.entries(levels)) {
      const m = method as LoggableConsoleMethod;
      this.originalConsole[m] = console[m];
      
      (console as any)[m] = (...args: any[]) => {
        // Keep original behavior intact so developers still see logs in DevTools
        this.originalConsole[m]?.apply(console, args);
        
        // Capture log asynchronously/lightweight to prevent blocking the main thread
        this.addLog(level as LogLevel, args);
      };
    }
    
    console.log('[LogCollector] Logging started. Max logs:', this.MAX_LOGS);
  }

  private safeSerialize(arg: any): any {
      if (typeof arg !== 'object' || arg === null) {
          return String(arg);
      }
      
      if (arg instanceof Error) {
          return { message: arg.message, stack: arg.stack, name: arg.name };
      }

      try {
          // Attempt a shallow copy/stringify to avoid holding references to large DOM/React objects
          return JSON.stringify(arg, (key, value) => {
              if (key === 'children' || key === '_owner' || key.startsWith('__')) return '[React Internal]';
              if (typeof value === 'function') return '[Function]';
              return value;
          });
      } catch (e) {
          return '[Circular/Unsafe Object]';
      }
  }

  private addLog(level: LogLevel, args: any[]) {
      const timestamp = new Date().toISOString();
      
      // Immediately serialize to release references to live objects
      const safeArgs = args.map(arg => this.safeSerialize(arg));

      this.logs.push({ timestamp, level, messages: safeArgs });
      
      if (this.logs.length > this.MAX_LOGS) {
          this.logs.shift();
      }
  }

  public formatLogs(): string {
    const metaHeader = `User Agent: ${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}\nDPR: ${window.devicePixelRatio}\nTime: ${new Date().toISOString()}\n\n`;

    const logLines = this.logs.map(entry => {
      const messages = entry.messages.map(m => {
        if (typeof m === 'string') return m;
        try {
          return JSON.stringify(m, null, 2);
        } catch (e) {
          return String(m);
        }
      }).join(' ');
      return `[${entry.timestamp}] [${entry.level}] ${messages}`;
    }).join('\n');

    return metaHeader + logLines;
  }
  
  public clear() {
      this.logs = [];
  }
}

export const logCollector = new LogCollector();

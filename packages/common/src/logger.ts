export interface KanjiLogger {
  log(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
}

export const LOGGER = Symbol('LOGGER');

export class DefaultConsoleLogger implements KanjiLogger {
  private useColor: boolean;

  constructor() {
    const isTTY = typeof process !== 'undefined' && process.stdout?.isTTY;
    const noColor = typeof process !== 'undefined' && process.env?.NO_COLOR !== undefined;
    this.useColor = !!isTTY && !noColor;
  }

  private formatRouterMessage(message: string): string {
    if (!this.useColor) {
      return message;
    }
    // Formats Router latency message "METHOD /path - STATUS - +DURATIONms" with color codes
    return message.replace(
      / - (\d+) - \+(.+ms)/,
      (_match, status, duration) => {
        const statusCode = parseInt(status, 10);
        const statusColor = statusCode >= 500 ? '\x1b[31m' : statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
        return ` - ${statusColor}${status}\x1b[0m - \x1b[36m+${duration}\x1b[0m`;
      }
    );
  }

  log(message: string, context?: string): void {
    const ts = new Date().toLocaleTimeString();
    const formattedMsg = context === 'Router' ? this.formatRouterMessage(message) : message;
    const ctx = context ? (this.useColor ? `\x1b[33m[${context}]\x1b[0m` : `[${context}]`) : '';
    const prefix = this.useColor ? `\x1b[35m[Kanji]\x1b[0m` : '[Kanji]';
    console.log(`${prefix} ${ts} ${ctx} ${formattedMsg}`);
  }

  warn(message: string, context?: string): void {
    const ts = new Date().toLocaleTimeString();
    const formattedMsg = context === 'Router' ? this.formatRouterMessage(message) : message;
    const ctx = context ? (this.useColor ? `\x1b[33m[${context}]\x1b[0m` : `[${context}]`) : '';
    const prefix = this.useColor ? `\x1b[33m[Kanji-Warn]\x1b[0m` : '[Kanji-Warn]';
    console.warn(`${prefix} ${ts} ${ctx} ${formattedMsg}`);
  }

  error(message: string, trace?: string, context?: string): void {
    const ts = new Date().toLocaleTimeString();
    const formattedMsg = context === 'Router' ? this.formatRouterMessage(message) : message;
    const ctx = context ? (this.useColor ? `\x1b[31m[${context}]\x1b[0m` : `[${context}]`) : '';
    const prefix = this.useColor ? '\x1b[31m[Kanji-Error]\x1b[0m' : '[Kanji-Error]';
    const traceStr = trace ? `\n${trace}` : '';
    console.error(`${prefix} ${ts} ${ctx} ${formattedMsg}${traceStr}`);
  }
}

export enum ValidationSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface ValidationResult {
  severity: ValidationSeverity;
  message: string;
  location: {
    controller: string;
    method?: string;
    file?: string; // Physical file path and line location for interactive terminal Ctrl+Click
  };
  suggestion?: string;
}

/**
 * Captures the current stack trace and parses it to locate where a decorator
 * was invoked in user application space, skipping framework internals.
 */
export function captureLocation(): string | undefined {
  const stack = new Error().stack;
  if (!stack) return undefined;

  const lines = stack.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('at ') &&
      !line.includes('packages/contracts/') &&
      !line.includes('packages/platform-hono/') &&
      !line.includes('node_modules') &&
      !line.includes('captureLocation') &&
      !line.includes('bun:wrap')
    ) {
      // Clean up the stack frame line to extract the raw file path, line, and column.
      // Typically: "    at Object.Contract (/path/to/users.controller.ts:12:3)" or "    at /path/to/users.controller.ts:12:3"
      const match = line.match(/at\s+(?:\S+\s+\()?(.*?)\)?$/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return undefined;
}

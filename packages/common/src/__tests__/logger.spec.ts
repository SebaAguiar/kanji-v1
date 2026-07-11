import { describe, it, expect, spyOn, afterEach } from 'bun:test';
import { DefaultConsoleLogger } from '../logger.js';

describe('DefaultConsoleLogger', () => {
  let logSpy = spyOn(console, 'log').mockImplementation(() => {});
  let warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  let errorSpy = spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  it('should print log messages without throwing', () => {
    const logger = new DefaultConsoleLogger();
    logger.log('Normal info message');
    logger.log('Hono router method GET /users - 200 - +5ms', 'Router');
    
    expect(logSpy).toHaveBeenCalled();
  });

  it('should print warnings without throwing', () => {
    const logger = new DefaultConsoleLogger();
    logger.warn('Some warning message', 'Contracts');
    
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should print errors without throwing', () => {
    const logger = new DefaultConsoleLogger();
    logger.error('Critical failure message', 'stacktrace-mock-data', 'InstanceLoader');
    
    expect(errorSpy).toHaveBeenCalled();
  });
});

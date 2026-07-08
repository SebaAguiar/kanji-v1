import type { MiddlewareHandler } from 'hono';
import { LOGGER, KanjiLogger } from '@kanjijs/common';
import { Container } from '@kanjijs/core';

export function requestLoggerMiddleware(container: Container): MiddlewareHandler {
  // Resolve dependency once during initialization to avoid request-time lookup overhead
  const logger = container.getInstances().get(LOGGER) as KanjiLogger | undefined;

  return async (c, next) => {
    if (!logger) {
      return next();
    }

    const startTime = performance.now();
    const method = c.req.method;
    const path = c.req.path; // Efficient path resolution without URL parsing overhead

    try {
      await next();
    } finally {
      const duration = (performance.now() - startTime).toFixed(2);
      const status = c.res.status;
      const message = `${method} ${path} - ${status} - +${duration}ms`;

      if (status >= 500) {
        logger.error(message, undefined, 'Router');
      } else if (status >= 400) {
        logger.warn(message, 'Router');
      } else {
        logger.log(message, 'Router');
      }
    }
  };
}

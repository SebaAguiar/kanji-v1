import { randomUUID } from 'crypto';
import type { MiddlewareHandler } from 'hono';
import { KANJI_CTX } from '../types.js';

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  c.set(KANJI_CTX.REQUEST_ID as string, randomUUID());
  await next();
};

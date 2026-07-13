// packages/contracts/src/validator.ts

import type { Context, MiddlewareHandler } from 'hono';
import { ZodError, type ZodTypeAny } from 'zod';
import { formatZodIssues } from './errors.js';
import type { KanjiContract } from './types.js';

const VALIDATED_KEYS = {
  body: 'kanji.validated.body',
  params: 'kanji.validated.params',
  query: 'kanji.validated.query',
  headers: 'kanji.validated.headers',
} as const;

async function validatePart(
  schema: ZodTypeAny,
  data: unknown,
  key: keyof typeof VALIDATED_KEYS,
  c: Context,
): Promise<Response | undefined> {
  try {
    const validated = await schema.parseAsync(data);
    c.set(VALIDATED_KEYS[key], validated);
    return undefined;
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return c.json(formatZodIssues(err.issues), 400);
    }
    throw err;
  }
}

export class ZodValidator {
  public validate(contract: KanjiContract): MiddlewareHandler {
    return async (c, next) => {
      if (contract.request?.body) {
        const body = await c.req.json().catch(() => ({}));
        const error = await validatePart(contract.request.body, body, 'body', c);
        if (error) return error;
      }

      if (contract.request?.params) {
        const params = c.req.param();
        const error = await validatePart(contract.request.params, params, 'params', c);
        if (error) return error;
      }

      if (contract.request?.query) {
        const query = c.req.query();
        const error = await validatePart(contract.request.query, query, 'query', c);
        if (error) return error;
      }

      if (contract.request?.headers) {
        const headers = c.req.header();
        const error = await validatePart(contract.request.headers, headers, 'headers', c);
        if (error) return error;
      }

      await next();
    };
  }
}

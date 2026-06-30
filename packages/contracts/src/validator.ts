import type { MiddlewareHandler } from 'hono';
import { ZodError } from 'zod';
import { formatZodIssues } from './errors';

export class ZodValidator {
  public validate(contract: any): MiddlewareHandler {
    return async (c, next) => {
      // 1. Validar el Body si el contrato lo define
      if (contract.request?.body) {
        try {
          const body = await c.req.json().catch(() => ({}));
          const validated = await contract.request.body.parseAsync(body);
          c.set('kanji.validated.body' as any, validated);
        } catch (err: any) {
          if (err instanceof ZodError) {
            return c.json(formatZodIssues(err.issues), 400);
          }
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
      }

      // 2. Validar URL params si el contrato lo define
      if (contract.request?.params) {
        try {
          const params = c.req.param();
          const validated = await contract.request.params.parseAsync(params);
          c.set('kanji.validated.params' as any, validated);
        } catch (err: any) {
          if (err instanceof ZodError) {
            return c.json(formatZodIssues(err.issues), 400);
          }
          throw err;
        }
      }

      // 3. Validar Query params si el contrato lo define
      if (contract.request?.query) {
        try {
          const query = c.req.query();
          const validated = await contract.request.query.parseAsync(query);
          c.set('kanji.validated.query' as any, validated);
        } catch (err: any) {
          if (err instanceof ZodError) {
            return c.json(formatZodIssues(err.issues), 400);
          }
          throw err;
        }
      }

      // 4. Validar Headers si el contrato lo define
      if (contract.request?.headers) {
        try {
          const headers = c.req.header();
          const validated = await contract.request.headers.parseAsync(headers);
          c.set('kanji.validated.headers' as any, validated);
        } catch (err: any) {
          if (err instanceof ZodError) {
            return c.json(formatZodIssues(err.issues), 400);
          }
          throw err;
        }
      }

      await next();
    };
  }
}

import type { Context } from 'hono';
import { KANJI_CTX } from './types.js';

export function getValidatedBody<T = Record<string, unknown>>(c: Context): T {
  return c.get(KANJI_CTX.VALIDATED_BODY as string) as T;
}

export function getValidatedQuery<T = Record<string, unknown>>(c: Context): T {
  return c.get(KANJI_CTX.VALIDATED_QUERY as string) as T;
}

export function getValidatedParams<T = Record<string, unknown>>(c: Context): T {
  return c.get(KANJI_CTX.VALIDATED_PARAMS as string) as T;
}

export function getValidatedHeaders<T = Record<string, unknown>>(c: Context): T {
  return c.get(KANJI_CTX.VALIDATED_HEADERS as string) as T;
}

export function getRequestId(c: Context): string {
  return c.get(KANJI_CTX.REQUEST_ID as string);
}

export function getAuthUser<T = { id: string; email: string; name: string; roles: string[] }>(c: Context): T | undefined {
  return c.get(KANJI_CTX.AUTH_USER as string) as T | undefined;
}

export function getAuthSession<T = Record<string, unknown>>(c: Context): T | undefined {
  return c.get(KANJI_CTX.AUTH_SESSION as string) as T | undefined;
}

export function getAuthRoles(c: Context): string[] {
  return c.get(KANJI_CTX.AUTH_ROLES as string) ?? [];
}

export function getAuthScopes(c: Context): string[] {
  return c.get(KANJI_CTX.AUTH_SCOPES as string) ?? [];
}

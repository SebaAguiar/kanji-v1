import 'hono';
import type { Container } from '@kanjijs/core';

declare module 'hono' {
  interface ContextVariableMap {
    'kanji.validated.body': Record<string, unknown>;
    'kanji.validated.query': Record<string, unknown>;
    'kanji.validated.params': Record<string, unknown>;
    'kanji.validated.headers': Record<string, unknown>;
    'kanji.validated.cookies': Record<string, unknown>;
    'kanji.auth.user': {
      id: string;
      email: string;
      name: string;
      roles: string[];
    };
    'kanji.auth.session': Record<string, unknown>;
    'kanji.auth.roles': string[];
    'kanji.auth.principal': string;
    'kanji.auth.scopes': string[];
    'kanji.authz.cache': Map<string, { allowed: boolean; reason: string }>;
    'kanji.authz.decision': { allowed: boolean; resource: string; action: string } | null;
    'kanji.requestId': string;
    'kanji.container': Container;
    'kanji.resource.read': Record<string, unknown>;
    'kanji.resource.update': Record<string, unknown>;
    'kanji.resource.delete': Record<string, unknown>;
    'kanji.resource.create': Record<string, unknown>;
  }
}

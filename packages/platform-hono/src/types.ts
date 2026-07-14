// packages/platform-hono/src/types.ts

import type { MiddlewareHandler } from 'hono';
import { KanjiLogger } from '@kanjijs/common';

export const KANJI_CTX = {
  VALIDATED_BODY: 'kanji.validated.body',
  VALIDATED_QUERY: 'kanji.validated.query',
  VALIDATED_PARAMS: 'kanji.validated.params',
  VALIDATED_HEADERS: 'kanji.validated.headers',
  VALIDATED_COOKIES: 'kanji.validated.cookies',
  AUTH_USER: 'kanji.auth.user',
  AUTH_SESSION: 'kanji.auth.session',
  AUTH_ROLES: 'kanji.auth.roles',
  AUTH_PRINCIPAL: 'kanji.auth.principal',
  AUTH_SCOPES: 'kanji.auth.scopes',
  AUTHZ_CACHE: 'kanji.authz.cache',
  AUTHZ_DECISION: 'kanji.authz.decision',
  REQUEST_ID: 'kanji.requestId',
  CONTAINER: 'kanji.container',
} as const;

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => string);
  allowMethods?: string[];
  allowHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface ContractMetadata {
  method: string;
  path: string;
}

export interface Validator {
  validate(contract: ContractMetadata): MiddlewareHandler;
}

export interface KanjijsPlatformOptions {
  validator?: Validator;
  logger?: KanjiLogger | boolean;
  requestLogger?: boolean;
  cors?: CorsOptions | boolean;
  exceptionFilters?: Array<new (...args: never[]) => any>;
}

export type KanjijsAdapterOptions = KanjijsPlatformOptions;

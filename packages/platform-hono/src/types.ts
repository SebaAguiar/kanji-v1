import type { MiddlewareHandler } from 'hono';
import { KanjiLogger, type ExceptionFilter } from '@kanjijs/common';
import type { SecurityHeadersOptions } from './middleware/security-headers.js';

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
  RESOURCE_READ: 'kanji.resource.read',
  RESOURCE_UPDATE: 'kanji.resource.update',
  RESOURCE_DELETE: 'kanji.resource.delete',
  RESOURCE_CREATE: 'kanji.resource.create',
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
  securityHeaders?: SecurityHeadersOptions | boolean;
  exceptionFilters?: Array<new (...args: never[]) => ExceptionFilter>;
}

export type KanjijsAdapterOptions = KanjijsPlatformOptions;

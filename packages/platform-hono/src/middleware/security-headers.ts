import type { MiddlewareHandler } from 'hono';

export interface SecurityHeadersOptions {
  hsts?: { maxAge: number; includeSubDomains?: boolean; preload?: boolean } | false;
  contentSecurityPolicy?: string | false;
  xContentTypeOptions?: boolean;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;
  xssProtection?: boolean;
}

export function securityHeadersMiddleware(
  options: SecurityHeadersOptions = {},
): MiddlewareHandler {
  return async (c, next) => {
    await next();

    // HSTS
    if (options.hsts !== false) {
      const hsts = (options.hsts && typeof options.hsts === 'object')
        ? options.hsts
        : { maxAge: 31536000, includeSubDomains: true };
      let value = `max-age=${hsts.maxAge}`;
      if (hsts.includeSubDomains) value += '; includeSubDomains';
      if (hsts.preload) value += '; preload';
      c.header('Strict-Transport-Security', value);
    }

    // CSP
    if (options.contentSecurityPolicy !== false) {
      c.header(
        'Content-Security-Policy',
        options.contentSecurityPolicy ?? "default-src 'self'",
      );
    }

    // X-Content-Type-Options
    if (options.xContentTypeOptions !== false) {
      c.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (options.xFrameOptions !== false) {
      c.header('X-Frame-Options', options.xFrameOptions ?? 'DENY');
    }

    // X-XSS-Protection
    if (options.xssProtection !== false) {
      c.header('X-XSS-Protection', '0');
    }
  };
}

import type { Context, Next, MiddlewareHandler } from 'hono';
import { KANJI_CTX, HttpMetadataStorage } from '@kanjijs/platform-hono';
import type { ClassLevelPermissions, ClpPermissionRule, AclOptions } from './policy.js';

interface AuthorizationDecision {
  allowed: boolean;
  action: string;
  reason: string;
}

export const AuthGuard: MiddlewareHandler = async (
  c: Context,
  next: Next,
): Promise<Response | void> => {
  const user = c.get(KANJI_CTX.AUTH_USER as string);
  if (!user) {
    return c.json(
      { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
      401,
    );
  }
  await next();
};

export function clp(permissions: ClassLevelPermissions): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const method = c.req.method.toUpperCase();
    let action: 'create' | 'read' | 'list' | 'update' | 'delete' | null = null;

    if (method === 'POST') action = 'create';
    else if (method === 'GET') action = 'read';
    else if (method === 'PATCH' || method === 'PUT') action = 'update';
    else if (method === 'DELETE') action = 'delete';

    // Distinguish list from read: if the route has no :id param and action is read,
    // check if 'list' permission exists and use it instead
    if (action === 'read') {
      const hasIdParam = c.req.param('id') !== undefined && c.req.param('id') !== '';
      if (!hasIdParam && permissions.list) {
        action = 'list';
      }
    }

    if (!action) {
      return c.json({ error: 'Forbidden', message: 'Method not allowed for CLP validation' }, 403);
    }

    const rule = permissions[action];
    if (!rule) {
      return c.json(
        { error: 'Forbidden', message: `No permissions defined for action "${action}"` },
        403,
      );
    }

    const setAuthzDecision = (reason: string) => {
      const decision: AuthorizationDecision = { allowed: true, action, reason };
      c.set(KANJI_CTX.AUTHZ_DECISION as string, decision);
      let cache = c.get(KANJI_CTX.AUTHZ_CACHE as string) as Map<string, AuthorizationDecision>;
      if (!cache) {
        cache = new Map();
        c.set(KANJI_CTX.AUTHZ_CACHE as string, cache);
      }
      cache.set(action, decision);
    };

    if (rule === 'public' || (typeof rule === 'object' && rule.public === true)) {
      setAuthzDecision('public access');
      await next();
      return;
    }

    const user = c.get(KANJI_CTX.AUTH_USER as string);
    if (!user) {
      return c.json(
        { error: 'Unauthorized', message: 'Authentication required for this resource' },
        401,
      );
    }

    if (rule === 'authenticated') {
      setAuthzDecision('authenticated access');
      await next();
      return;
    }

    const ruleObj = rule as ClpPermissionRule;
    if (ruleObj.authenticated) {
      setAuthzDecision('authenticated access');
      await next();
      return;
    }

    const userRoles: string[] = user.roles || [];
    if (ruleObj.role && !userRoles.includes(ruleObj.role)) {
      return c.json(
        { error: 'Forbidden', message: `Required role "${ruleObj.role}" is missing` },
        403,
      );
    }

    if (ruleObj.anyRole && !ruleObj.anyRole.some((r) => userRoles.includes(r))) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Missing required role. Required one of: ${ruleObj.anyRole.join(', ')}`,
        },
        403,
      );
    }

    setAuthzDecision('role matched');
    await next();
  };
}

export function acl(options: AclOptions): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = c.get(KANJI_CTX.AUTH_USER as string);
    if (!user) {
      return c.json(
        { error: 'Unauthorized', message: 'Authentication required for ACL validation' },
        401,
      );
    }

    const idSelector = options.resourceId ?? ((ctx) => ctx.req.param('id'));
    const resourceId = idSelector(c);

    if (!resourceId) {
      return c.json({ error: 'Bad Request', message: 'Resource ID parameter is missing' }, 400);
    }

    const resource = await options.resourceResolver(c, resourceId);
    if (!resource) {
      return c.json({ error: 'Not Found', message: 'Resource not found' }, 404);
    }

    const container = c.get(KANJI_CTX.CONTAINER as string) as
      import('@kanjijs/core').Container | undefined;
    if (!container) {
      throw new Error('[Kanji] DI Container not found in Hono context.');
    }
    const policyInstance = await container.resolve(options.policy, options.contextModule);

    let isAuthorized = false;
    if (options.action === 'create' && policyInstance.canCreate) {
      isAuthorized = await policyInstance.canCreate(c, resource, user);
    } else if (options.action === 'read' && policyInstance.canRead) {
      isAuthorized = await policyInstance.canRead(c, resource, user);
    } else if (options.action === 'update' && policyInstance.canUpdate) {
      isAuthorized = await policyInstance.canUpdate(c, resource, user);
    } else if (options.action === 'delete' && policyInstance.canDelete) {
      isAuthorized = await policyInstance.canDelete(c, resource, user);
    }

    if (!isAuthorized) {
      if (options.hideExistence) {
        return c.json({ error: 'Not Found', message: 'Resource not found' }, 404);
      }
      return c.json(
        { error: 'Forbidden', message: 'You do not have access to this resource object' },
        403,
      );
    }

    const decision: AuthorizationDecision = { allowed: true, action: options.action, reason: 'policy passed' };
    c.set(KANJI_CTX.AUTHZ_DECISION as string, decision);
    let cache = c.get(KANJI_CTX.AUTHZ_CACHE as string) as Map<string, AuthorizationDecision>;
    if (!cache) {
      cache = new Map();
      c.set(KANJI_CTX.AUTHZ_CACHE as string, cache);
    }
    cache.set(options.action, decision);

    const resourceKey = KANJI_CTX[`RESOURCE_${options.action.toUpperCase()}` as keyof typeof KANJI_CTX];
    if (typeof resourceKey === 'string') {
      c.set(resourceKey, resource);
    } else {
      c.set(`kanji.resource.${options.action}`, resource);
    }
    await next();
  };
}

export function UseGuards(
  ...guards: MiddlewareHandler[]
): (target: object | Function, propertyKey?: string | symbol) => void {
  return (target: object | Function, propertyKey?: string | symbol): void => {
    if (propertyKey) {
      HttpMetadataStorage.getInstance().registerRouteMiddleware(
        target.constructor,
        propertyKey,
        guards,
      );
    } else {
      HttpMetadataStorage.getInstance().registerControllerMiddleware(target as Function, guards);
    }
  };
}

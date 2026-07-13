import type { Token, Constructor } from '@kanjijs/core';

export interface ClpPermissionRule {
  role?: string;
  anyRole?: string[];
  public?: boolean;
  authenticated?: boolean;
}

export interface ClassLevelPermissions {
  create?: ClpPermissionRule | 'public' | 'authenticated';
  read?: ClpPermissionRule | 'public' | 'authenticated';
  list?: ClpPermissionRule | 'public' | 'authenticated';
  update?: ClpPermissionRule | 'public' | 'authenticated';
  delete?: ClpPermissionRule | 'public' | 'authenticated';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export interface ResourcePolicy<R = Record<string, unknown>, U = AuthUser> {
  canCreate?(c: import('hono').Context, resource: R, user: U): Promise<boolean> | boolean;
  canRead?(c: import('hono').Context, resource: R, user: U): Promise<boolean> | boolean;
  canUpdate?(c: import('hono').Context, resource: R, user: U): Promise<boolean> | boolean;
  canDelete?(c: import('hono').Context, resource: R, user: U): Promise<boolean> | boolean;
}

export interface AclOptions {
  policy: Token<ResourcePolicy>;
  action: 'create' | 'read' | 'update' | 'delete';
  resourceId?: (c: import('hono').Context) => string;
  resourceResolver: (c: import('hono').Context, id: string) => Promise<Record<string, unknown> | null>;
  hideExistence?: boolean;
  contextModule: Constructor<object>;
}

import type { Context } from 'hono';

export interface ClpPermissionRule {
  role?: string;
  anyRole?: string[];
  public?: boolean;
  authenticated?: boolean;
}

export interface ClassLevelPermissions {
  create?: ClpPermissionRule | 'public' | 'authenticated';
  read?: ClpPermissionRule | 'public' | 'authenticated';
  update?: ClpPermissionRule | 'public' | 'authenticated';
  delete?: ClpPermissionRule | 'public' | 'authenticated';
}

export interface ResourcePolicy {
  canRead?(c: Context, resource: any, user: any): Promise<boolean> | boolean;
  canUpdate?(c: Context, resource: any, user: any): Promise<boolean> | boolean;
  canDelete?(c: Context, resource: any, user: any): Promise<boolean> | boolean;
}

export interface AclOptions {
  policy: any;
  action: 'read' | 'update' | 'delete';
  resourceId?: (c: Context) => string;
  resourceResolver: (c: Context, id: string) => Promise<any>;
  hideExistence?: boolean;
}

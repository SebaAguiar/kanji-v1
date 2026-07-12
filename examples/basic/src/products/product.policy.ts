import { Injectable } from '@kanjijs/core';
import type { ResourcePolicy } from '@kanjijs/auth';
import type { Context } from 'hono';

@Injectable()
export class ProductPolicy implements ResourcePolicy {
  canRead(c: Context, resource: any, user: any): boolean {
    return true;
  }

  canCreate(c: Context, resource: any, user: any): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }

  canUpdate(c: Context, resource: any, user: any): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }

  canDelete(c: Context, resource: any, user: any): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }
}

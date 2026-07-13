import { Injectable } from '@kanjijs/core';
import type { ResourcePolicy } from '@kanjijs/auth';
import type { Context } from 'hono';

interface ProductResource {
  userId: string;
}

interface UserAuth {
  userId: string;
  roles: string[];
}

@Injectable()
export class ProductPolicy implements ResourcePolicy<ProductResource, UserAuth> {
  canRead(_c: Context, _resource: ProductResource, _user: UserAuth): boolean {
    return true;
  }

  canCreate(_c: Context, resource: ProductResource, user: UserAuth): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }

  canUpdate(_c: Context, resource: ProductResource, user: UserAuth): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }

  canDelete(_c: Context, resource: ProductResource, user: UserAuth): boolean {
    return resource.userId === user.userId || user.roles.includes('admin');
  }
}

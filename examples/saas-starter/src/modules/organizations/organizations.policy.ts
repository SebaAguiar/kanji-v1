import { Injectable } from '@kanjijs/core';
import type { ResourcePolicy, AuthUser } from '@kanjijs/auth';
import type { Context } from 'hono';
import { OrganizationsService } from './organizations.service.js';

@Injectable()
export class OrganizationPolicy implements ResourcePolicy {
  constructor(private readonly orgService: OrganizationsService) {}

  async canRead(_c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = resource.id as string;
    const member = (await this.orgService.getMember(orgId, user.id)) as { role: string } | null;
    return member !== null;
  }

  async canUpdate(_c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = resource.id as string;
    const member = (await this.orgService.getMember(orgId, user.id)) as { role: string } | null;
    return member !== null && member.role === 'admin';
  }

  async canDelete(_c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = resource.id as string;
    const member = (await this.orgService.getMember(orgId, user.id)) as { role: string } | null;
    return member !== null && member.role === 'admin';
  }
}

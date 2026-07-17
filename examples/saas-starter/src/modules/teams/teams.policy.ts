import { Injectable } from '@kanjijs/core';
import type { ResourcePolicy, AuthUser } from '@kanjijs/auth';
import type { Context } from 'hono';
import { OrganizationsService } from '../organizations/organizations.service.js';

@Injectable()
export class TeamPolicy implements ResourcePolicy {
  constructor(private readonly orgService: OrganizationsService) {}

  async canCreate(c: Context, _resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = c.req.param('orgId');
    if (!orgId) return false;
    const member = await this.orgService.getMember(orgId, user.id);
    return member !== null;
  }

  async canRead(c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = (resource.organizationId as string) || c.req.param('orgId');
    if (!orgId) return false;
    const member = await this.orgService.getMember(orgId, user.id);
    return member !== null;
  }

  async canUpdate(c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = (resource.organizationId as string) || c.req.param('orgId');
    if (!orgId) return false;
    const member = (await this.orgService.getMember(orgId, user.id)) as { role: string } | null;
    return member !== null && member.role === 'admin';
  }

  async canDelete(c: Context, resource: Record<string, unknown>, user: AuthUser): Promise<boolean> {
    const orgId = (resource.organizationId as string) || c.req.param('orgId');
    if (!orgId) return false;
    const member = (await this.orgService.getMember(orgId, user.id)) as { role: string } | null;
    return member !== null && member.role === 'admin';
  }
}

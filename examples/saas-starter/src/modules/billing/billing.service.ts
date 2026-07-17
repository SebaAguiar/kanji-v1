import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { NotFoundError, ForbiddenError } from '@kanjijs/common';
import { OrganizationsService } from '../organizations/organizations.service.js';
import type { SubscribeInput } from './billing.contracts.js';

interface DbSub {
  id: string;
  organizationId: string;
  plan: string;
  status: string;
  expiresAt: Date;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
    private readonly orgService: OrganizationsService,
  ) {}

  async getPlan(userId: string, orgId: string) {
    const member = await this.orgService.getMember(orgId, userId);
    if (!member) {
      throw new ForbiddenError('You are not a member of this organization');
    }

    const sub = (await this.db.query.subscriptions.findBy({ organizationId: orgId })) as unknown as DbSub | null;
    if (!sub) {
      throw new NotFoundError('Subscription not found');
    }
    return {
      id: sub.id,
      organizationId: sub.organizationId,
      plan: sub.plan,
      status: sub.status,
      expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : new Date(),
    };
  }

  async subscribe(userId: string, input: SubscribeInput) {
    const member = (await this.orgService.getMember(input.orgId, userId)) as { role: string } | null;
    if (!member || member.role !== 'admin') {
      throw new ForbiddenError('Only organization admins can manage subscriptions');
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const existing = (await this.db.query.subscriptions.findBy({ organizationId: input.orgId })) as unknown as DbSub | null;
    if (existing) {
      await this.db.query.subscriptions
        .update({
          plan: input.plan,
          status: 'active',
          expiresAt,
        })
        .where({ organizationId: input.orgId });
    } else {
      await this.db.query.subscriptions.insert({
        id: crypto.randomUUID(),
        organizationId: input.orgId,
        plan: input.plan,
        status: 'active',
        expiresAt,
      });
    }

    const updated = (await this.db.query.subscriptions.findBy({ organizationId: input.orgId })) as unknown as DbSub;
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      plan: updated.plan,
      status: updated.status,
      expiresAt: updated.expiresAt ? new Date(updated.expiresAt) : new Date(),
    };
  }
}

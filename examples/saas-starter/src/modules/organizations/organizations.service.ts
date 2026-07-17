import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { NotFoundError } from '@kanjijs/common';
import type { CreateOrgInput } from './organizations.contracts.js';

interface DbOrg {
  id: string;
  name: string;
  createdAt?: Date;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async create(userId: string, input: CreateOrgInput) {
    const orgId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const subId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year free subscription

    return this.db.transaction(async (tx) => {
      await tx.query.organizations.insert({
        id: orgId,
        name: input.name,
      });

      await tx.query.organizationMembers.insert({
        id: memberId,
        organizationId: orgId,
        userId,
        role: 'admin',
      });

      await tx.query.subscriptions.insert({
        id: subId,
        organizationId: orgId,
        plan: 'free',
        status: 'active',
        expiresAt,
      });

      return {
        id: orgId,
        name: input.name,
        createdAt: new Date(),
      };
    });
  }

  async findAll(userId: string) {
    const query = `
      SELECT o.id, o.name, m.role, o.created_at as "createdAt"
      FROM organizations o
      JOIN organization_members m ON o.id = m.organization_id
      WHERE m.user_id = $1
    `;
    const results = await this.db.raw(query, [userId]);
    return results.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      role: r.role as string,
      createdAt: r.createdAt ? new Date(r.createdAt as string) : new Date(),
    }));
  }

  async findById(id: string) {
    const org = (await this.db.query.organizations.findById(id)) as unknown as DbOrg | null;
    if (!org) throw new NotFoundError('Organization not found');
    return org;
  }

  async update(id: string, input: CreateOrgInput) {
    await this.db.query.organizations.update({ name: input.name }).where({ id });
    const updated = (await this.db.query.organizations.findById(id)) as unknown as DbOrg;
    return updated;
  }

  async delete(id: string) {
    return this.db.transaction(async (tx) => {
      await tx.query.organizationMembers.delete().where({ organizationId: id });
      await tx.query.subscriptions.delete().where({ organizationId: id });
      await tx.query.teams.delete().where({ organizationId: id });
      await tx.query.organizations.delete().where({ id });
      return { success: true };
    });
  }

  async getMember(orgId: string, userId: string) {
    const member = await this.db.query.organizationMembers.findBy({
      organizationId: orgId,
      userId,
    });
    return member;
  }
}

import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { NotFoundError } from '@kanjijs/common';
import type { CreateTeamInput } from './teams.contracts.js';

interface DbTeam {
  id: string;
  organizationId: string;
  name: string;
  createdAt?: Date;
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async create(orgId: string, input: CreateTeamInput) {
    const id = crypto.randomUUID();
    await this.db.query.teams.insert({
      id,
      organizationId: orgId,
      name: input.name,
    });
    return {
      id,
      organizationId: orgId,
      name: input.name,
      createdAt: new Date(),
    };
  }

  async findAll(orgId: string) {
    const results = await this.db.query.teams.select().where({ organizationId: orgId });
    return results.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      organizationId: r.organizationId as string,
      name: r.name as string,
      createdAt: r.createdAt ? new Date(r.createdAt as string) : new Date(),
    }));
  }

  async findById(id: string) {
    const team = (await this.db.query.teams.findById(id)) as unknown as DbTeam | null;
    if (!team) throw new NotFoundError('Team not found');
    return team;
  }

  async update(id: string, input: CreateTeamInput) {
    await this.db.query.teams.update({ name: input.name }).where({ id });
    const updated = (await this.db.query.teams.findById(id)) as unknown as DbTeam;
    return updated;
  }

  async delete(id: string) {
    await this.db.query.teams.delete().where({ id });
    return { success: true };
  }
}

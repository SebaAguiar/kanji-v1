import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { NotFoundError, ConflictError } from '@kanjijs/common';
import type { UpdateMeInput } from './users.contracts.js';

interface DbUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
  ) {}

  async getMe(userId: string) {
    const user = (await this.db.query.users.findById(userId)) as unknown as DbUser | null;
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async updateMe(userId: string, input: UpdateMeInput) {
    const user = (await this.db.query.users.findById(userId)) as unknown as DbUser | null;
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (input.email && input.email !== user.email) {
      const existing = await this.db.query.users.findBy({ email: input.email });
      if (existing) {
        throw new ConflictError('Email already in use');
      }
    }

    const updateData: Record<string, string> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;

    if (Object.keys(updateData).length > 0) {
      await this.db.query.users.update(updateData).where({ id: userId });
    }

    const updated = (await this.db.query.users.findById(userId)) as unknown as DbUser;
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    };
  }
}

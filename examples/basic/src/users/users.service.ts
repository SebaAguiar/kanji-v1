import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import type { CreateUserInput } from './users.contracts.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database
  ) {}

  async create(input: CreateUserInput) {
    const id = crypto.randomUUID();
    
    // We utilize the Database proxy query builder interface
    await this.db.query.users.insert({
      id,
      email: input.email,
      name: input.name,
    });
    
    return {
      id,
      ...input,
      status: 'active' as const,
      createdAt: new Date(),
    };
  }

  async findAll() {
    const results = await this.db.query.users.select();
    return results.map((r: any) => ({
      ...r,
      status: 'active' as const,
      createdAt: new Date(),
    }));
  }
}

import { Injectable, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import { SESSION_PROVIDER, SessionProvider } from '@kanjijs/auth';
import { UnauthorizedError, ConflictError } from '@kanjijs/common';
import type { RegisterInput, LoginInput } from './auth.contracts.js';

interface DbUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database,
    @Inject(SESSION_PROVIDER)
    private readonly session: SessionProvider,
  ) {}

  async register(input: RegisterInput) {
    const existing = (await this.db.query.users.findBy({ email: input.email })) as unknown as DbUser | null;
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const id = crypto.randomUUID();
    const passwordHash = await Bun.password.hash(input.password, 'bcrypt');

    await this.db.query.users.insert({
      id,
      email: input.email,
      name: input.name,
      passwordHash,
      role: 'user',
    });

    const user = {
      id,
      email: input.email,
      name: input.name,
      role: 'user',
    };

    const token = this.session.createToken(
      {
        userId: id,
        email: user.email,
        name: user.name,
        roles: [user.role],
        scopes: ['read', 'write'],
      },
      3600,
    );

    return { token, user };
  }

  async login(input: LoginInput) {
    const user = (await this.db.query.users.findBy({ email: input.email })) as unknown as DbUser | null;
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const matches = await Bun.password.verify(input.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = this.session.createToken(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        roles: [user.role],
        scopes: ['read', 'write'],
      },
      3600,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

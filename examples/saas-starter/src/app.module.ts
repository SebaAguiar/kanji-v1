import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { AuthModule } from '@kanjijs/auth';
import { OpenApiModule } from '@kanjijs/openapi';
import { env } from '@kanjijs/common';
import { z } from 'zod';
import { PolicyModule } from './modules/policy.module.js';
import { AuthExampleModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import * as schema from './database/schema.js';

@KanjijsModule({
  imports: [
    StoreModule.forRoot({
      type: 'postgres',
      connectionString:
        env('DATABASE_URL', z.string().default('postgres://postgres:postgres@localhost:5432/kanji_saas_dev')),
      schema,
    }),
    AuthModule.forRoot({
      jwtSecret: env('JWT_SECRET', z.string().default('dev-secret-key-9988776655')),
    }),
    OpenApiModule.forRoot({
      title: 'SaaS API',
      version: '1.0.0',
      description: 'SaaS Multi-tenant Example App using Kanji Framework',
    }),
    PolicyModule, // Import global policies and services first
    AuthExampleModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    BillingModule,
  ],
})
export class AppModule {}

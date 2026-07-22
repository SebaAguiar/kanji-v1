import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { AuthModule } from '@kanjijs/auth';
import { OpenApiModule } from '@kanjijs/openapi';
import { env } from '@kanjijs/common';
import { z } from 'zod';
import { UsersModule } from './users/users.module.js';
import { AuthExampleModule } from './auth/auth.module.js';
import * as usersSchema from './users/users.schema.js';
import { ProductModule } from './products/product.module.js';

@KanjijsModule({
  imports: [
    StoreModule.forRoot({
      type: 'postgres',
      connectionString:
        env('DATABASE_URL', z.string().default('postgres://postgres:postgres@localhost:5432/kanji_test')),
      schema: usersSchema,
    }),
    AuthModule.forRoot({
      jwtSecret: env('JWT_SECRET', z.string().default('dev-secret-key-12345')),
    }),
    OpenApiModule.forRoot({
      title: 'Basic API',
      version: '1.0.0',
      description: 'Example app using Kanji Framework',
    }),
    UsersModule,
    AuthExampleModule,
    ProductModule,
  ],
})
export class AppModule {}

import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { AuthModule } from '@kanjijs/auth';
import { UsersModule } from './users/users.module.js';
import { AuthExampleModule } from './auth/auth.module.js';
import * as usersSchema from './users/users.schema.js';
import { ProductModule } from './products/product.module.js';

@KanjijsModule({
  imports: [
    StoreModule.forRoot({
      type: 'postgres',
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kanji_test',
      schema: usersSchema,
    }),
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-12345',
    }),
    UsersModule,
    AuthExampleModule,
    ProductModule,
  ],
})
export class AppModule {}

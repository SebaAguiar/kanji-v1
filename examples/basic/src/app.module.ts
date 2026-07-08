import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';
import { UsersModule } from './users/users.module.js';
import * as usersSchema from './users/users.schema.js';

@KanjijsModule({
  imports: [
    StoreModule.forRoot({
      type: 'postgres',
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kanji_test',
      schema: usersSchema,
    }),
    UsersModule,
  ],
})
export class AppModule {}

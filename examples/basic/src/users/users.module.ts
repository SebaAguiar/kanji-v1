import { KanjijsModule } from '@kanjijs/core';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@KanjijsModule({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

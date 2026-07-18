import { KanjijsModule } from '@kanjijs/core';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

@KanjijsModule({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

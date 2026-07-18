import { KanjijsModule } from '@kanjijs/core';
import { AuthController } from './auth.controller.js';

@KanjijsModule({
  controllers: [AuthController],
})
export class AuthExampleModule {}

import { KanjijsModule } from '@kanjijs/core';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@KanjijsModule({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthExampleModule {}

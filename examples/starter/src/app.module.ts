import { KanjijsModule } from '@kanjijs/core';
import { HelloController } from './hello.controller.js';

@KanjijsModule({
  controllers: [HelloController],
})
export class AppModule {}

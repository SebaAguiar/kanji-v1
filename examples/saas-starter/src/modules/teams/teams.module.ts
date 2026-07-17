import { KanjijsModule } from '@kanjijs/core';
import { TeamsController } from './teams.controller.js';

@KanjijsModule({
  controllers: [TeamsController],
})
export class TeamsModule {}

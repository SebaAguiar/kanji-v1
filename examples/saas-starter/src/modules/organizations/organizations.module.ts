import { KanjijsModule } from '@kanjijs/core';
import { OrganizationsController } from './organizations.controller.js';

@KanjijsModule({
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}

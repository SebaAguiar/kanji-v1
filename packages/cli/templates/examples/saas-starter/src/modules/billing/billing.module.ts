import { KanjijsModule } from '@kanjijs/core';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';

@KanjijsModule({
  imports: [OrganizationsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

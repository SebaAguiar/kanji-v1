import { KanjijsModule } from '@kanjijs/core';
import { OrganizationsService } from './organizations/organizations.service.js';
import { OrganizationPolicy } from './organizations/organizations.policy.js';
import { TeamsService } from './teams/teams.service.js';
import { TeamPolicy } from './teams/teams.policy.js';

@KanjijsModule({
  providers: [
    OrganizationsService,
    OrganizationPolicy,
    TeamsService,
    TeamPolicy,
  ],
  exports: [
    OrganizationsService,
    OrganizationPolicy,
    TeamsService,
    TeamPolicy,
  ],
  global: true,
})
export class PolicyModule {}

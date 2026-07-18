import { Controller, Get, Post, Patch, Delete, getValidatedBody } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { AuthGuard, UseGuards, acl } from '@kanjijs/auth';
import { BearerAuth, OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { TeamsService } from './teams.service.js';
import { TeamContracts, CreateTeamInput } from './teams.contracts.js';
import { TeamPolicy } from './teams.policy.js';

class LocalTeamsModule {}

@ContractOf(TeamContracts)
@Controller('/organizations')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('/:orgId/teams')
  @Contract(TeamContracts.create)
  @OperationId('createTeam')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: TeamPolicy,
      action: 'create',
      contextModule: LocalTeamsModule,
      resourceId: (c) => c.req.param('orgId')!,
      resourceResolver: async (_c, orgId) => ({ organizationId: orgId }),
    })
  )
  async create(c: Context): Promise<Response> {
    const orgId = c.req.param('orgId')!;
    const input = getValidatedBody<CreateTeamInput>(c);
    const result = await this.teamsService.create(orgId, input);
    return c.json(result, 201);
  }

  @Get('/:orgId/teams')
  @Contract(TeamContracts.findAll)
  @OperationId('listTeams')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: TeamPolicy,
      action: 'read',
      contextModule: LocalTeamsModule,
      resourceId: (c) => c.req.param('orgId')!,
      resourceResolver: async (_c, orgId) => ({ organizationId: orgId }),
    })
  )
  async findAll(c: Context): Promise<Response> {
    const orgId = c.req.param('orgId')!;
    const result = await this.teamsService.findAll(orgId);
    return c.json(result, 200);
  }

  @Get('/:orgId/teams/:id')
  @Contract(TeamContracts.findById)
  @OperationId('getTeamDetail')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: TeamPolicy,
      action: 'read',
      contextModule: LocalTeamsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const teamsService = await container.resolve(TeamsService, LocalTeamsModule);
        try {
          const team = await teamsService.findById(id);
          return team as unknown as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    })
  )
  async findById(c: Context): Promise<Response> {
    const resource = c.get('kanji.resource.read');
    return c.json(resource, 200);
  }

  @Patch('/:orgId/teams/:id')
  @Contract(TeamContracts.update)
  @OperationId('updateTeam')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: TeamPolicy,
      action: 'update',
      contextModule: LocalTeamsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const teamsService = await container.resolve(TeamsService, LocalTeamsModule);
        try {
          const team = await teamsService.findById(id);
          return team as unknown as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    })
  )
  async update(c: Context): Promise<Response> {
    const id = c.req.param('id')!;
    const input = getValidatedBody<CreateTeamInput>(c);
    const result = await this.teamsService.update(id, input);
    return c.json(result, 200);
  }

  @Delete('/:orgId/teams/:id')
  @Contract(TeamContracts.delete)
  @OperationId('deleteTeam')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: TeamPolicy,
      action: 'delete',
      contextModule: LocalTeamsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const teamsService = await container.resolve(TeamsService, LocalTeamsModule);
        try {
          const team = await teamsService.findById(id);
          return team as unknown as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    })
  )
  async delete(c: Context): Promise<Response> {
    const id = c.req.param('id')!;
    const result = await this.teamsService.delete(id);
    return c.json(result, 200);
  }
}

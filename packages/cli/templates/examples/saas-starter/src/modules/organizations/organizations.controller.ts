import { Controller, Get, Post, Patch, Delete, getValidatedBody, getAuthUser } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { AuthGuard, UseGuards, acl } from '@kanjijs/auth';
import { BearerAuth, OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationContracts, CreateOrgInput } from './organizations.contracts.js';
import { OrganizationPolicy } from './organizations.policy.js';

class LocalOrganizationsModule {}

@ContractOf(OrganizationContracts)
@Controller('/organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post('/')
  @Contract(OrganizationContracts.create)
  @OperationId('createOrg')
  @BearerAuth()
  async create(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const input = getValidatedBody<CreateOrgInput>(c);
    const result = await this.orgService.create(session.id, input);
    return c.json(result, 201);
  }

  @Get('/')
  @Contract(OrganizationContracts.findAll)
  @OperationId('listOrgs')
  @BearerAuth()
  async findAll(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const result = await this.orgService.findAll(session.id);
    return c.json(result, 200);
  }

  @Get('/:id')
  @Contract(OrganizationContracts.findById)
  @OperationId('getOrgDetail')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: OrganizationPolicy,
      action: 'read',
      contextModule: LocalOrganizationsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const orgService = await container.resolve(OrganizationsService, LocalOrganizationsModule);
        try {
          const org = await orgService.findById(id);
          return org as unknown as Record<string, unknown>;
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

  @Patch('/:id')
  @Contract(OrganizationContracts.update)
  @OperationId('updateOrg')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: OrganizationPolicy,
      action: 'update',
      contextModule: LocalOrganizationsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const orgService = await container.resolve(OrganizationsService, LocalOrganizationsModule);
        try {
          const org = await orgService.findById(id);
          return org as unknown as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    })
  )
  async update(c: Context): Promise<Response> {
    const id = c.req.param('id')!;
    const input = getValidatedBody<CreateOrgInput>(c);
    const result = await this.orgService.update(id, input);
    return c.json(result, 200);
  }

  @Delete('/:id')
  @Contract(OrganizationContracts.delete)
  @OperationId('deleteOrg')
  @BearerAuth()
  @UseGuards(
    acl({
      policy: OrganizationPolicy,
      action: 'delete',
      contextModule: LocalOrganizationsModule,
      resourceResolver: async (c, id) => {
        const container = c.get('kanji.container') as import('@kanjijs/core').Container;
        const orgService = await container.resolve(OrganizationsService, LocalOrganizationsModule);
        try {
          const org = await orgService.findById(id);
          return org as unknown as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    })
  )
  async delete(c: Context): Promise<Response> {
    const id = c.req.param('id')!;
    const result = await this.orgService.delete(id);
    return c.json(result, 200);
  }
}

import { Controller, Get, Patch, getValidatedBody, getAuthUser } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { AuthGuard, UseGuards } from '@kanjijs/auth';
import { BearerAuth, OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { UsersService } from './users.service.js';
import { UserContracts, UpdateMeInput } from './users.contracts.js';

@ContractOf(UserContracts)
@Controller('/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/me')
  @Contract(UserContracts.getMe)
  @OperationId('getMe')
  @BearerAuth()
  async getMe(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const result = await this.usersService.getMe(session.id);
    return c.json(result, 200);
  }

  @Patch('/me')
  @Contract(UserContracts.updateMe)
  @OperationId('updateMe')
  @BearerAuth()
  async updateMe(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const input = getValidatedBody<UpdateMeInput>(c);
    const result = await this.usersService.updateMe(session.id, input);
    return c.json(result, 200);
  }
}

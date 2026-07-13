import { Controller, Get, Post, getValidatedBody, getAuthUser } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { AuthGuard, UseGuards } from '@kanjijs/auth';
import { BearerAuth, Deprecated, OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { UsersService } from './users.service.js';
import { UserContracts, CreateUserInput } from './users.contracts.js';

@ContractOf(UserContracts)
@Controller('/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('/')
  @Contract(UserContracts.create)
  @OperationId('createUser')
  async create(c: Context): Promise<Response> {
    const input = getValidatedBody<CreateUserInput>(c);
    const result = await this.usersService.create(input);
    return c.json(result, 201);
  }

  @Get('/')
  @Contract(UserContracts.findAll)
  @Deprecated()
  async findAll(c: Context): Promise<Response> {
    const result = await this.usersService.findAll();
    return c.json(result, 200);
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  @BearerAuth()
  @OperationId('getMeProfile')
  async getMe(c: Context): Promise<Response> {
    const user = getAuthUser(c);
    return c.json(user, 200);
  }
}

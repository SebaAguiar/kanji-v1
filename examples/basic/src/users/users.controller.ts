import { Controller, Get, Post } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
import { type Context } from 'hono';
import { UsersService } from './users.service.js';
import { UserContracts } from './users.contracts.js';

@Controller('/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('/')
  @Contract(UserContracts.create)
  async create(c: Context): Promise<Response> {
    const input = c.get('kanji.validated.body');
    const result = await this.usersService.create(input);
    return c.json(result, 201);
  }

  @Get('/')
  @Contract(UserContracts.findAll)
  async findAll(c: Context): Promise<Response> {
    const result = await this.usersService.findAll();
    return c.json(result, 200);
  }
}

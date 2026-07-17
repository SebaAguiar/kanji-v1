import { Controller, Post, getValidatedBody } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { AuthService } from './auth.service.js';
import { AuthContracts, RegisterInput, LoginInput } from './auth.contracts.js';

@ContractOf(AuthContracts)
@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @Contract(AuthContracts.register)
  @OperationId('registerUser')
  async register(c: Context): Promise<Response> {
    const input = getValidatedBody<RegisterInput>(c);
    const result = await this.authService.register(input);
    return c.json(result, 201);
  }

  @Post('/login')
  @Contract(AuthContracts.login)
  @OperationId('loginUser')
  async login(c: Context): Promise<Response> {
    const input = getValidatedBody<LoginInput>(c);
    const result = await this.authService.login(input);
    return c.json(result, 200);
  }
}

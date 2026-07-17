import { Controller, Get, getValidatedQuery } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { type Context } from 'hono';
import { HelloContracts } from './hello.contracts.js';

@ContractOf(HelloContracts)
@Controller()
export class HelloController {
  @Get('/hello')
  @Contract(HelloContracts.greet)
  async greet(c: Context): Promise<Response> {
    const { name } = getValidatedQuery<{ name: string }>(c);
    return c.json({ message: `Hello, ${name}!` }, 200);
  }
}

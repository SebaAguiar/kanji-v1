import { Controller, Get, Post, getValidatedBody, getValidatedQuery, getAuthUser } from '@kanjijs/platform-hono';
import { Contract, ContractOf } from '@kanjijs/contracts';
import { AuthGuard, UseGuards } from '@kanjijs/auth';
import { BearerAuth, OperationId } from '@kanjijs/openapi';
import { type Context } from 'hono';
import { BillingService } from './billing.service.js';
import { BillingContracts, SubscribeInput } from './billing.contracts.js';

@ContractOf(BillingContracts)
@Controller('/billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('/plan')
  @Contract(BillingContracts.getPlan)
  @OperationId('getBillingPlan')
  @BearerAuth()
  async getPlan(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const { orgId } = getValidatedQuery<{ orgId: string }>(c);
    const result = await this.billingService.getPlan(session.id, orgId);
    return c.json(result, 200);
  }

  @Post('/subscribe')
  @Contract(BillingContracts.subscribe)
  @OperationId('subscribeBilling')
  @BearerAuth()
  async subscribe(c: Context): Promise<Response> {
    const session = getAuthUser(c)!;
    const input = getValidatedBody<SubscribeInput>(c);
    const result = await this.billingService.subscribe(session.id, input);
    return c.json(result, 200);
  }
}

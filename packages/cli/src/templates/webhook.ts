import { capitalize } from '../utils/inflection.js';
import { WebhookOptions } from '../types.js';

export function getWebhookTemplate(
  name: string,
  opts: WebhookOptions,
): { webhook: string; module: string; events: string } {
  const capName = capitalize(name);
  const eventEnumValues =
    opts.events.length > 0 ? opts.events.map((e) => `'${e}'`).join(', ') : `'webhook.event'`;

  const events = `import { z } from 'zod';

export const ${capName}EventSchema = z.object({
  id: z.string(),
  type: z.enum([${eventEnumValues}]),
  created: z.number(),
  data: z.record(z.unknown()),
});

export type ${capName}Event = z.infer<typeof ${capName}EventSchema>;
`;

  const hasAuth = opts.auth === 'secret' || opts.auth === 'signature';

  let authLogic = '';
  if (opts.auth === 'secret') {
    authLogic = `
    const signature = c.req.header('X-${capName}-Webhook-Secret');
    const expectedSecret = process.env.${name.toUpperCase()}_WEBHOOK_SECRET;

    if (!signature || signature !== expectedSecret) {
      return c.json({ error: 'Unauthorized: invalid webhook secret' }, 401);
    }
`;
  } else if (opts.auth === 'signature') {
    authLogic = `
    const signature = c.req.header('X-${capName}-Signature');
    const secret = process.env.${name.toUpperCase()}_WEBHOOK_SECRET;

    if (!signature || !secret) {
      return c.json({ error: 'Unauthorized: signature or secret missing' }, 401);
    }

    // Signature verification would happen against rawBody below
`;
  }

  let retryLogic = '';
  if (opts.retry) {
    retryLogic = `
    // Retry queue processing enabled.
    // In production, delegate this to a queue service (e.g., BullMQ)
    console.log('[Webhook Retry Queue] Queueing event for background processing:', event.id);
`;
  }

  const webhook = `import { Controller, Post } from '@kanjijs/platform-hono';
import { type Context } from 'hono';
import { ${capName}EventSchema } from './events.js';

@Controller('/webhooks/${name.toLowerCase()}')
export class ${capName}WebhookController {
  @Post('/')
  async handle(c: Context): Promise<Response> {
    // Read body once to avoid consuming the request stream twice
    const rawBody: string = await c.req.text();${hasAuth ? `
    ${authLogic}` : ''}
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    let event;
    try {
      event = ${capName}EventSchema.parse(parsed);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return c.json({ error: \`Invalid payload: \${errMsg}\` }, 400);
    }

    console.log(\`Received ${name} webhook event: \${event.type}\`);
${retryLogic}
    // TODO: Implement your event business logic handler here

    return c.json({ received: true }, 200);
  }
}
`;

  const module = `import { KanjijsModule } from '@kanjijs/core';
import { ${capName}WebhookController } from './${name}.webhook.js';

@KanjijsModule({
  controllers: [${capName}WebhookController],
  providers: [],
})
export class ${capName}WebhookModule {}
`;

  return { webhook, module, events };
}

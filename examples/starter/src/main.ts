import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { env } from '@kanjijs/common';
import { z } from 'zod';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = env('PORT', z.coerce.number().default(3000));
  const { app } = await KanjijsAdapter.create(AppModule, {
    validator: new ZodValidator(),
    requestLogger: true,
  });

  console.log(`\n🚀 Kanji Starter App is running on http://localhost:${port}`);

  Bun.serve({
    fetch: app.fetch,
    port,
  });
}

bootstrap().catch(console.error);

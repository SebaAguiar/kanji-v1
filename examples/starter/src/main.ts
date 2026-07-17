import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
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

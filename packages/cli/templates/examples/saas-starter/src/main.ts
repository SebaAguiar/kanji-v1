import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  const { app } = await KanjijsAdapter.create(AppModule, {
    validator: new ZodValidator(),
    requestLogger: true,
    cors: {
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    },
  });

  // Generate OpenAPI and SDK files automatically on bootstrap
  const openapiConfig = {
    title: 'SaaS API',
    version: '1.0.0',
    description: 'SaaS Multi-tenant Example App using Kanji Framework',
  };
  const { OpenApiGenerator, SdkGenerator } = await import('@kanjijs/openapi');
  const generator = new OpenApiGenerator(openapiConfig);
  const spec = generator.generateSpec();

  const fs = await import('fs/promises');
  const path = await import('path');

  await fs.writeFile(
    path.join(import.meta.dirname, 'openapi.json'),
    JSON.stringify(spec, null, 2),
    'utf-8',
  );
  console.log('✅ OpenAPI Spec generated in src/openapi.json');

  const sdkGenerator = new SdkGenerator();
  await sdkGenerator.generateToFile(spec, path.join(import.meta.dirname, 'sdk.ts'));
  console.log('✅ Client SDK generated in src/sdk.ts');

  console.log(`\n🚀 Kanji SaaS App is running on http://localhost:${port}`);

  // Start Bun native HTTP server
  Bun.serve({
    fetch: app.fetch,
    port,
  });
}

bootstrap().catch(console.error);

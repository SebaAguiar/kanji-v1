import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { AppModule } from './src/app.module.js';
import { OpenApiGenerator, SdkGenerator } from '@kanjijs/openapi';
import * as fs from 'fs/promises';
import * as path from 'path';

async function generate() {
  // Bootstrap adapter to register routes and metadata
  await KanjijsAdapter.create(AppModule, {
    validator: new ZodValidator(),
    logger: false,
  });

  const openapiConfig = {
    title: 'Basic API',
    version: '1.0.0',
    description: 'Example app using Kanji Framework',
  };
  const generator = new OpenApiGenerator(openapiConfig);
  const spec = generator.generateSpec();

  await fs.writeFile(
    path.join(import.meta.dirname, 'src/openapi.json'),
    JSON.stringify(spec, null, 2),
    'utf-8',
  );
  console.log('✅ OpenAPI Spec generated in src/openapi.json');

  const sdkGenerator = new SdkGenerator();
  await sdkGenerator.generateToFile(spec, path.join(import.meta.dirname, 'src/sdk.ts'));
  console.log('✅ Client SDK generated in src/sdk.ts');

  process.exit(0);
}

generate().catch(console.error);

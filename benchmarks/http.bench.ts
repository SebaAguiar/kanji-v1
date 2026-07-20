import { bench, run } from 'mitata';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { AppModule } from '../examples/basic/src/app.module.js';
import { ZodValidator } from '@kanjijs/contracts';

const { app } = await KanjijsAdapter.create(AppModule, {
  validator: new ZodValidator(),
  logger: false,
});

// Registrar una ruta GET y una POST de prueba en el bench
bench('GET /users', async () => {
  await app.request('/users');
});

bench('POST /users (validated)', async () => {
  await app.request('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', email: 'alice@test.com' }),
  });
});

await run();

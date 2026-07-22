import 'reflect-metadata';
import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { ZodValidator } from '@kanjijs/contracts';
import { env } from '@kanjijs/common';
import { z } from 'zod';
import { ChatModule } from './chat.module.js';
import { JWT_SECRET } from './chat.gateway.js';
import jwt from 'jsonwebtoken';

async function bootstrap() {
  const { serve } = await KanjijsAdapter.create(ChatModule, {
    validator: new ZodValidator(),
    requestLogger: true,
  });

  const port = env('PORT', z.coerce.number().default(3000));

  // Generate a demo token for testing
  const demoToken = jwt.sign(
    {
      userId: 'user-demo',
      email: 'demo@example.com',
      name: 'Demo User',
      roles: ['user'],
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  console.log(`\n🚀 Kanji Chat is running on ws://localhost:${port}/chat`);
  console.log(`\n📋 Demo token for testing:`);
  console.log(`   ${demoToken}`);
  console.log(`\n🔌 Connect using: wscat ws://localhost:${port}/chat?token=${demoToken}`);
  console.log(`\n   Or paste the token above into WebSocket client query param "token"\n`);

  // Bun.serve with WebSocket support is managed internally by KanjijsAdapter
  serve({ port });
}

bootstrap().catch(console.error);

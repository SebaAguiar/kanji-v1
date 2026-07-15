export function getPackageJsonTemplate(appName: string): object {
  return {
    name: appName,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'bun --watch src/main.ts',
      build: 'tsc',
      start: 'bun src/main.ts',
    },
    dependencies: {
      '@kanjijs/core': 'latest',
      '@kanjijs/platform-hono': 'latest',
      '@kanjijs/contracts': 'latest',
      '@kanjijs/store': 'latest',
      '@kanjijs/auth': 'latest',
      '@kanjijs/openapi': 'latest',
      hono: '^4.0.0',
      zod: '^3.0.0',
      'reflect-metadata': '^0.2.2',
    },
    devDependencies: {
      typescript: '^6.0.3',
    },
  };
}

export function getTsConfigTemplate(): object {
  return {
    compilerOptions: {
      target: 'ESNext',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
  };
}

export function getMainTsTemplate(): string {
  return `import { KanjijsAdapter } from '@kanjijs/platform-hono';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const { app } = await KanjijsAdapter.create(AppModule);
  
  console.log('Server is running on http://localhost:3000 🚀');
  Bun.serve({
    fetch: app.fetch,
    port: 3000,
  });
}

bootstrap();
`;
}

export function getAppModuleTemplate(): string {
  return `import { KanjijsModule } from '@kanjijs/core';
import { AppController } from './app.controller.js';

@KanjijsModule({
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
`;
}

export function getAppControllerTemplate(): string {
  return `import { Controller, Get } from '@kanjijs/platform-hono';
import { type Context } from 'hono';

@Controller('')
export class AppController {
  @Get('/')
  index(c: Context): Response {
    return c.json({ message: 'Welcome to Kanji Framework!' });
  }
}
`;
}

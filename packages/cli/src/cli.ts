#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { mkdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const program = new Command();

program
  .name('kanji')
  .description('Kanji Framework CLI for rapid backend development')
  .version('1.0.0-alpha.1');

// --- Helpers de Formateo y Nombres ---
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toSingular(str: string): string {
  if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
  if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
  return str;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// --- Plantillas ---
const getContractsTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { z } from 'zod';

export const Create${singularCapitalized}Schema = z.object({
  name: z.string().min(2),
});

export const ${singularCapitalized}ResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type Create${singularCapitalized}Input = z.infer<typeof Create${singularCapitalized}Schema>;
export type ${singularCapitalized}Response = z.infer<typeof ${singularCapitalized}ResponseSchema>;

export const ${singularCapitalized}Contracts = {
  create: {
    method: 'POST' as const,
    path: '/' as const,
    body: Create${singularCapitalized}Schema,
    responses: {
      201: ${singularCapitalized}ResponseSchema,
    },
  },
  findAll: {
    method: 'GET' as const,
    path: '/' as const,
    responses: {
      200: z.array(${singularCapitalized}ResponseSchema),
    },
  },
};
`;
};

const getServiceTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Injectable } from '@kanjijs/core';
import type { Create${singularCapitalized}Input, ${singularCapitalized}Response } from './${singular}.contracts.js';

@Injectable()
export class ${singularCapitalized}Service {
  private readonly ${name}: ${singularCapitalized}Response[] = [];

  async create(input: Create${singularCapitalized}Input): Promise<${singularCapitalized}Response> {
    const item: ${singularCapitalized}Response = {
      id: Math.random().toString(36).substring(7),
      ...input,
    };
    this.${name}.push(item);
    return item;
  }

  async findAll(): Promise<${singularCapitalized}Response[]> {
    return this.${name};
  }
}
`;
};

const getControllerTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Controller, Get, Post, Contract } from '@kanjijs/platform-hono';
import { type Context } from 'hono';
import { ${singularCapitalized}Service } from './${singular}.service.js';
import { ${singularCapitalized}Contracts } from './${singular}.contracts.js';

@Controller('/${name.toLowerCase()}')
export class ${singularCapitalized}Controller {
  constructor(private readonly ${singular}Service: ${singularCapitalized}Service) {}

  @Post('/')
  @Contract(${singularCapitalized}Contracts.create)
  async create(c: Context): Promise<Response> {
    const input = c.get('kanji.validated.body');
    const result = await this.${singular}Service.create(input);
    return c.json(result, 201);
  }

  @Get('/')
  @Contract(${singularCapitalized}Contracts.findAll)
  async findAll(c: Context): Promise<Response> {
    const result = await this.${singular}Service.findAll();
    return c.json(result, 200);
  }
}
`;
};

const getModuleTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { KanjijsModule } from '@kanjijs/core';
import { ${singularCapitalized}Controller } from './${singular}.controller.js';
import { ${singularCapitalized}Service } from './${singular}.service.js';

@KanjijsModule({
  controllers: [${singularCapitalized}Controller],
  providers: [${singularCapitalized}Service],
})
export class ${singularCapitalized}Module {}
`;
};

const getIndexTemplate = (name: string): string => {
  const singular = toSingular(name);
  return `export * from './${singular}.contracts.js';
export * from './${singular}.service.js';
export * from './${singular}.controller.js';
export * from './${singular}.module.js';
`;
};

// --- Comando: kanji g resource <name> ---
program
  .command('g')
  .alias('generate')
  .argument('<type>', 'Type of artifact to generate (resource)')
  .argument('<name>', 'Name of the resource (e.g. users)')
  .option('--dry-run', 'Preview changes without writing to disk', false)
  .option('--force', 'Overwrite existing files', false)
  .action(async (type: string, name: string, options: { dryRun: boolean; force: boolean }) => {
    if (type.toLowerCase() !== 'resource') {
      console.error(pc.red(`Error: Generating type "${type}" is not supported. Use "resource".`));
      process.exit(1);
    }

    const normalizedName = name.toLowerCase().trim();
    const singular = toSingular(normalizedName);
    const targetDir = join(process.cwd(), 'src', normalizedName);

    console.log(pc.cyan(`\nProcessing resource "${normalizedName}"...`));

    const files = [
      { path: `${singular}.contracts.ts`, content: getContractsTemplate(normalizedName) },
      { path: `${singular}.service.ts`, content: getServiceTemplate(normalizedName) },
      { path: `${singular}.controller.ts`, content: getControllerTemplate(normalizedName) },
      { path: `${singular}.module.ts`, content: getModuleTemplate(normalizedName) },
      { path: 'index.ts', content: getIndexTemplate(normalizedName) },
    ];

    if (options.dryRun) {
      console.log(pc.yellow('--- DRY RUN (No changes will be applied) ---'));
      for (const file of files) {
        console.log(pc.gray(`Would create: src/${normalizedName}/${file.path}`));
      }
      console.log(pc.bold(pc.green('Dry run completed! 🎉')));
      return;
    }

    try {
      // Validar conflictos de archivos preexistentes si no se usa --force
      if (!options.force) {
        for (const file of files) {
          const filePath = join(targetDir, file.path);
          if (await fileExists(filePath)) {
            console.error(pc.red(`Error: File already exists: src/${normalizedName}/${file.path}.`));
            console.error(pc.yellow('Use the --force option to overwrite existing files.'));
            process.exit(1);
          }
        }
      }

      await mkdir(targetDir, { recursive: true });

      for (const file of files) {
        const filePath = join(targetDir, file.path);
        await writeFile(filePath, file.content, 'utf-8');
        console.log(pc.green(`  CREATED  src/${normalizedName}/${file.path}`));
      }

      console.log(pc.bold(pc.green(`\nResource "${normalizedName}" successfully generated! 🎉`)));
      console.log(pc.yellow(`Remember to import ${capitalize(singular)}Module in your AppModule.`));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error generating resource: ${msg}`));
      process.exit(1);
    }
  });

// --- Comando: kanji new <app-name> ---
program
  .command('new')
  .argument('<app-name>', 'Name of the new application')
  .action(async (appName: string) => {
    const targetDir = join(process.cwd(), appName);
    console.log(pc.cyan(`Creating a new Kanji project in ${targetDir}...`));

    try {
      await mkdir(join(targetDir, 'src'), { recursive: true });

      const packageJson = {
        name: appName,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: "bun --watch src/main.ts",
          build: "tsc",
          start: "bun src/main.ts"
        },
        dependencies: {
          "@kanjijs/core": "latest",
          "@kanjijs/platform-hono": "latest",
          "hono": "^4.0.0",
          "zod": "^3.0.0",
          "reflect-metadata": "^0.2.2"
        },
        devDependencies: {
          "typescript": "^5.0.0"
        }
      };

      const tsconfigJson = {
        compilerOptions: {
          target: "ESNext",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        },
        include: ["src/**/*"]
      };

      const mainTs = `import { KanjijsAdapter } from '@kanjijs/platform-hono';
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

      const appModuleTs = `import { KanjijsModule } from '@kanjijs/core';
import { AppController } from './app.controller.js';

@KanjijsModule({
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
`;

      const appControllerTs = `import { Controller, Get } from '@kanjijs/platform-hono';
import { type Context } from 'hono';

@Controller('')
export class AppController {
  @Get('/')
  index(c: Context): Response {
    return c.json({ message: 'Welcome to Kanji Framework!' });
  }
}
`;

      await writeFile(join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
      await writeFile(join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfigJson, null, 2), 'utf-8');
      await writeFile(join(targetDir, 'src', 'main.ts'), mainTs, 'utf-8');
      await writeFile(join(targetDir, 'src', 'app.module.ts'), appModuleTs, 'utf-8');
      await writeFile(join(targetDir, 'src', 'app.controller.ts'), appControllerTs, 'utf-8');
      await writeFile(join(targetDir, '.env.example'), 'PORT=3000\nJWT_SECRET=super-secret-key-change-me\n', 'utf-8');

      console.log(pc.bold(pc.green(`\nKanji project "${appName}" successfully created! 🚀`)));
      console.log(pc.yellow(`Next steps:\n  cd ${appName}\n  bun install\n  bun dev`));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error creating project: ${msg}`));
      process.exit(1);
    }
  });

// --- Comandos Delegados ---
function runDelegateCommand(cmd: string) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    // child_process maneja la impresión de salida de error directamente con 'inherit'
    process.exit(1);
  }
}

// Base de datos
program
  .command('migrate')
  .description('Run database migrations')
  .action(() => {
    console.log(pc.cyan('Running migrations...'));
    runDelegateCommand('bunx drizzle-kit migrate');
  });

program
  .command('migrate:create')
  .description('Create a new database migration')
  .action(() => {
    console.log(pc.cyan('Generating new migration files...'));
    runDelegateCommand('bunx drizzle-kit generate');
  });

program
  .command('seed:run')
  .description('Run the database seed script')
  .action(() => {
    console.log(pc.cyan('Running seed file...'));
    runDelegateCommand('bun src/db/seed.ts');
  });

program
  .command('db:studio')
  .description('Open Drizzle Studio dashboard')
  .action(() => {
    console.log(pc.cyan('Opening Drizzle Studio...'));
    runDelegateCommand('bunx drizzle-kit studio');
  });

// Desarrollo
program
  .command('dev')
  .description('Start the application in development mode with HMR/Watch')
  .action(() => {
    console.log(pc.cyan('Starting development server...'));
    runDelegateCommand('bun --watch src/main.ts');
  });

program
  .command('build')
  .description('Build the application for production')
  .action(() => {
    console.log(pc.cyan('Building application...'));
    runDelegateCommand('tsc');
  });

program.parse(process.argv);

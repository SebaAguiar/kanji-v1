#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { mkdir, writeFile, stat, readFile } from 'fs/promises';
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

function ensurePropertyInDecorator(content: string, propertyName: string): string {
  const regex = new RegExp(`\\b${propertyName}:`);
  if (!regex.test(content)) {
    return content.replace(/@KanjijsModule\(\{/, `@KanjijsModule({\n  ${propertyName}: [],`);
  }
  return content;
}

function updateAppModule(fileContent: string, moduleName: string, importPath: string): string {
  if (fileContent.includes(moduleName)) {
    return fileContent;
  }

  const importStatement = `import { ${moduleName} } from '${importPath}';\n`;
  let updatedContent = fileContent;
  const lastImportIndex = fileContent.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const nextNewLine = fileContent.indexOf('\n', lastImportIndex);
    if (nextNewLine !== -1) {
      updatedContent = fileContent.slice(0, nextNewLine + 1) + importStatement + fileContent.slice(nextNewLine + 1);
    } else {
      updatedContent = importStatement + fileContent;
    }
  } else {
    updatedContent = importStatement + fileContent;
  }

  updatedContent = ensurePropertyInDecorator(updatedContent, 'imports');
  const importsIndex = updatedContent.indexOf('imports:');
  if (importsIndex === -1) {
    return updatedContent;
  }

  const openBracketIndex = updatedContent.indexOf('[', importsIndex);
  if (openBracketIndex === -1) {
    return updatedContent;
  }

  let bracketCount = 1;
  let closeBracketIndex = -1;
  for (let i = openBracketIndex + 1; i < updatedContent.length; i++) {
    if (updatedContent[i] === '[') {
      bracketCount++;
    } else if (updatedContent[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        closeBracketIndex = i;
        break;
      }
    }
  }

  if (closeBracketIndex === -1) {
    return updatedContent;
  }

  const innerContent = updatedContent.slice(openBracketIndex + 1, closeBracketIndex);
  const trimmedInner = innerContent.replace(/^\s*\n/, '').trimEnd();

  let newInner = '';
  if (trimmedInner.trim().length === 0) {
    // Buscar la indentación de la línea de imports:
    const beforeImports = updatedContent.slice(0, importsIndex);
    const lastLineBeforeImports = beforeImports.split('\n').pop() || '';
    const closeIndentMatch = lastLineBeforeImports.match(/^(\s*)/);
    const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';
    
    newInner = `\n${closeIndent}  ${moduleName},\n${closeIndent}`;
  } else {
    const isMultiline = innerContent.includes('\n');
    if (isMultiline) {
      const lines = innerContent.split('\n').filter(line => line.trim().length > 0);
      const lastLine = lines[lines.length - 1];
      const indentationMatch = lastLine.match(/^(\s*)/);
      const indent = indentationMatch ? indentationMatch[1] : '    ';
      
      const beforeImports = updatedContent.slice(0, importsIndex);
      const lastLineBeforeImports = beforeImports.split('\n').pop() || '';
      const closeIndentMatch = lastLineBeforeImports.match(/^(\s*)/);
      const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';

      if (trimmedInner.endsWith(',')) {
        newInner = `\n${trimmedInner}\n${indent}${moduleName},\n${closeIndent}`;
      } else {
        newInner = `\n${trimmedInner},\n${indent}${moduleName},\n${closeIndent}`;
      }
    } else {
      newInner = `${trimmedInner.trim()}, ${moduleName}`;
    }
  }

  updatedContent = updatedContent.slice(0, openBracketIndex + 1) + newInner + updatedContent.slice(closeBracketIndex);
  return updatedContent;
}

function updateLocalModule(
  fileContent: string,
  className: string,
  importPath: string,
  arrayName: 'controllers' | 'providers' | 'exports'
): string {
  let updatedContent = fileContent;
  const importStatement = `import { ${className} } from '${importPath}';\n`;
  if (!fileContent.includes(importStatement)) {
    const lastImportIndex = fileContent.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const nextNewLine = fileContent.indexOf('\n', lastImportIndex);
      if (nextNewLine !== -1) {
        updatedContent = fileContent.slice(0, nextNewLine + 1) + importStatement + fileContent.slice(nextNewLine + 1);
      } else {
        updatedContent = importStatement + fileContent;
      }
    } else {
      updatedContent = importStatement + fileContent;
    }
  }

  updatedContent = ensurePropertyInDecorator(updatedContent, arrayName);
  const propertyKey = `${arrayName}:`;
  const propertyIndex = updatedContent.indexOf(propertyKey);
  if (propertyIndex === -1) {
    return updatedContent;
  }

  const openBracketIndex = updatedContent.indexOf('[', propertyIndex);
  if (openBracketIndex === -1) {
    return updatedContent;
  }

  let bracketCount = 1;
  let closeBracketIndex = -1;
  for (let i = openBracketIndex + 1; i < updatedContent.length; i++) {
    if (updatedContent[i] === '[') {
      bracketCount++;
    } else if (updatedContent[i] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        closeBracketIndex = i;
        break;
      }
    }
  }

  if (closeBracketIndex === -1) {
    return updatedContent;
  }

  const innerContent = updatedContent.slice(openBracketIndex + 1, closeBracketIndex);
  
  const elementRegex = new RegExp(`\\b${className}\\b`);
  if (elementRegex.test(innerContent)) {
    return updatedContent;
  }

  const trimmedInner = innerContent.replace(/^\s*\n/, '').trimEnd();

  let newInner = '';
  if (trimmedInner.trim().length === 0) {
    const beforeProperty = updatedContent.slice(0, propertyIndex);
    const lastLineBeforeProperty = beforeProperty.split('\n').pop() || '';
    const closeIndentMatch = lastLineBeforeProperty.match(/^(\s*)/);
    const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';
    
    newInner = `\n${closeIndent}  ${className},\n${closeIndent}`;
  } else {
    const isMultiline = innerContent.includes('\n');
    if (isMultiline) {
      const lines = innerContent.split('\n').filter(line => line.trim().length > 0);
      const lastLine = lines[lines.length - 1];
      const indentationMatch = lastLine.match(/^(\s*)/);
      const indent = indentationMatch ? indentationMatch[1] : '    ';
      
      const beforeProperty = updatedContent.slice(0, propertyIndex);
      const lastLineBeforeProperty = beforeProperty.split('\n').pop() || '';
      const closeIndentMatch = lastLineBeforeProperty.match(/^(\s*)/);
      const closeIndent = closeIndentMatch ? closeIndentMatch[1] : '  ';

      if (trimmedInner.endsWith(',')) {
        newInner = `\n${trimmedInner}\n${indent}${className},\n${closeIndent}`;
      } else {
        newInner = `\n${trimmedInner},\n${indent}${className},\n${closeIndent}`;
      }
    } else {
      newInner = `${trimmedInner.trim()}, ${className}`;
    }
  }

  updatedContent = updatedContent.slice(0, openBracketIndex + 1) + newInner + updatedContent.slice(closeBracketIndex);
  return updatedContent;
}

const getStandaloneModuleTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { KanjijsModule } from '@kanjijs/core';

@KanjijsModule({
  controllers: [],
  providers: [],
  exports: [],
})
export class ${singularCapitalized}Module {}
`;
};

const getStandaloneControllerTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Controller } from '@kanjijs/platform-hono';

@Controller('/${name.toLowerCase()}')
export class ${singularCapitalized}Controller {
  // constructor() {}
}
`;
};

const getStandaloneServiceTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Injectable } from '@kanjijs/core';

@Injectable()
export class ${singularCapitalized}Service {
  // constructor() {}
}
`;
};

const getStandaloneRepositoryTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Repository, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';

@Repository()
export class ${singularCapitalized}Repository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database
  ) {}
}
`;
};

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

const getRepositoryTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Repository, Inject } from '@kanjijs/core';
import { DATABASE_CLIENT, type Database } from '@kanjijs/store';
import type { Create${singularCapitalized}Input, ${singularCapitalized}Response } from './${singular}.contracts.js';

@Repository()
export class ${singularCapitalized}Repository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: Database
  ) {}

  async create(input: Create${singularCapitalized}Input): Promise<${singularCapitalized}Response> {
    const id = Math.random().toString(36).substring(7);
    await this.db.query.${name}.insert({
      id,
      ...input,
    });
    return { id, ...input };
  }

  async findAll(): Promise<${singularCapitalized}Response[]> {
    return this.db.query.${name}.select() as Promise<${singularCapitalized}Response[]>;
  }
}
`;
};

const getServiceTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Injectable } from '@kanjijs/core';
import { ${singularCapitalized}Repository } from './${singular}.repository.js';
import type { Create${singularCapitalized}Input, ${singularCapitalized}Response } from './${singular}.contracts.js';

@Injectable()
export class ${singularCapitalized}Service {
  constructor(
    private readonly repository: ${singularCapitalized}Repository
  ) {}

  async create(input: Create${singularCapitalized}Input): Promise<${singularCapitalized}Response> {
    return this.repository.create(input);
  }

  async findAll(): Promise<${singularCapitalized}Response[]> {
    return this.repository.findAll();
  }
}
`;
};

const getControllerTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Controller, Get, Post } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
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
import { ${singularCapitalized}Repository } from './${singular}.repository.js';

@KanjijsModule({
  controllers: [${singularCapitalized}Controller],
  providers: [
    ${singularCapitalized}Repository,
    ${singularCapitalized}Service,
  ],
  exports: [${singularCapitalized}Service],
})
export class ${singularCapitalized}Module {}
`;
};

const getIndexTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `export * from './${singular}.contracts.js';
export * from './${singular}.repository.js';
export * from './${singular}.service.js';
export * from './${singular}.controller.js';
export * from './${singular}.module.js';
`;
};

const getTestTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { describe, it, expect, beforeEach } from 'bun:test';
import { Test } from '@kanjijs/testing';
import { ${singularCapitalized}Controller } from '../${singular}.controller.js';
import { ${singularCapitalized}Service } from '../${singular}.service.js';
import { ${singularCapitalized}Repository } from '../${singular}.repository.js';
import { DATABASE_CLIENT } from '@kanjijs/store';

describe('${singularCapitalized}Controller', () => {
  let controller: ${singularCapitalized}Controller;
  let service: ${singularCapitalized}Service;
  let repository: ${singularCapitalized}Repository;

  beforeEach(async () => {
    const mockDb = {
      query: {
        ${name}: {
          insert: async () => {},
          select: async () => [],
        },
      },
    };

    const module = await Test.createTestingModule({
      imports: [],
    })
      .overrideProvider(DATABASE_CLIENT)
      .useValue(mockDb as any)
      .overrideProvider(${singularCapitalized}Repository)
      .useClass(${singularCapitalized}Repository)
      .overrideProvider(${singularCapitalized}Service)
      .useClass(${singularCapitalized}Service)
      .overrideProvider(${singularCapitalized}Controller)
      .useClass(${singularCapitalized}Controller)
      .compile();

    controller = module.get(${singularCapitalized}Controller);
    service = module.get(${singularCapitalized}Service);
    repository = module.get(${singularCapitalized}Repository);
  });

  describe('POST /', () => {
    it('should create a ${singular}', async () => {
      // TODO: Implementar test
      expect(controller).toBeDefined();
      expect(service).toBeDefined();
      expect(repository).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return all ${name}', async () => {
      // TODO: Implementar test
      expect(controller).toBeDefined();
    });
  });
});
`;
};

// --- Comando: kanji g <type> <name> ---
program
  .command('g')
  .alias('generate')
  .argument('<type>', 'Type of artifact to generate (resource, module, controller, service, repository)')
  .argument('<name>', 'Name of the artifact')
  .option('--dry-run', 'Preview changes without writing to disk', false)
  .option('--force', 'Overwrite existing files', false)
  .action(async (type: string, name: string, options: { dryRun: boolean; force: boolean }) => {
    const allowedTypes = ['resource', 'module', 'controller', 'service', 'repository'];
    const artifactType = type.toLowerCase().trim();

    if (!allowedTypes.includes(artifactType)) {
      console.error(pc.red(`Error: Generating type "${type}" is not supported. Use: ${allowedTypes.join(', ')}.`));
      process.exit(1);
    }

    const normalizedName = name.toLowerCase().trim();
    const singular = toSingular(normalizedName);
    const targetDir = join(process.cwd(), 'src', normalizedName);

    console.log(pc.cyan(`\nProcessing ${artifactType} "${normalizedName}"...`));

    let files: { path: string; content: string }[] = [];

    if (artifactType === 'resource') {
      files = [
        { path: `${singular}.contracts.ts`, content: getContractsTemplate(normalizedName) },
        { path: `${singular}.repository.ts`, content: getRepositoryTemplate(normalizedName) },
        { path: `${singular}.service.ts`, content: getServiceTemplate(normalizedName) },
        { path: `${singular}.controller.ts`, content: getControllerTemplate(normalizedName) },
        { path: `${singular}.module.ts`, content: getModuleTemplate(normalizedName) },
        { path: `__tests__/${singular}.controller.spec.ts`, content: getTestTemplate(normalizedName) },
        { path: 'index.ts', content: getIndexTemplate(normalizedName) },
      ];
    } else if (artifactType === 'module') {
      files = [
        { path: `${singular}.module.ts`, content: getStandaloneModuleTemplate(normalizedName) },
        { path: 'index.ts', content: `export * from './${singular}.module.js';\n` },
      ];
    } else if (artifactType === 'controller') {
      files = [
        { path: `${singular}.controller.ts`, content: getStandaloneControllerTemplate(normalizedName) },
      ];
    } else if (artifactType === 'service') {
      files = [
        { path: `${singular}.service.ts`, content: getStandaloneServiceTemplate(normalizedName) },
      ];
    } else if (artifactType === 'repository') {
      files = [
        { path: `${singular}.repository.ts`, content: getStandaloneRepositoryTemplate(normalizedName) },
      ];
    }

    if (options.dryRun) {
      console.log(pc.yellow('--- DRY RUN (No changes will be applied) ---'));
      for (const file of files) {
        console.log(pc.gray(`Would create: src/${normalizedName}/${file.path}`));
      }
      if (artifactType !== 'resource' && artifactType !== 'module') {
        console.log(pc.gray(`Would verify or create/update index: src/${normalizedName}/index.ts`));
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
      if (artifactType === 'resource') {
        await mkdir(join(targetDir, '__tests__'), { recursive: true });
      }

      // Write generated files
      for (const file of files) {
        const filePath = join(targetDir, file.path);
        await writeFile(filePath, file.content, 'utf-8');
        console.log(pc.green(`  CREATED  src/${normalizedName}/${file.path}`));
      }

      // Update local index.ts for standalone components
      if (artifactType !== 'resource' && artifactType !== 'module') {
        const indexFilePath = join(targetDir, 'index.ts');
        const exportLine = `export * from './${singular}.${artifactType}.js';\n`;
        if (await fileExists(indexFilePath)) {
          const indexContent = await readFile(indexFilePath, 'utf-8');
          if (!indexContent.includes(`./${singular}.${artifactType}.js`)) {
            await writeFile(indexFilePath, indexContent + exportLine, 'utf-8');
            console.log(pc.yellow(`  UPDATED  src/${normalizedName}/index.ts (exported ${capitalize(singular)}${capitalize(artifactType)})`));
          }
        } else {
          await writeFile(indexFilePath, exportLine, 'utf-8');
          console.log(pc.green(`  CREATED  src/${normalizedName}/index.ts`));
        }
      }

      // Auto-register in app.module.ts for resource and module
      const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
      if (await fileExists(appModulePath)) {
        if (artifactType === 'resource' || artifactType === 'module') {
          const moduleName = `${capitalize(singular)}Module`;
          const importPath = `./${normalizedName}/${singular}.module.js`;
          try {
            const content = await readFile(appModulePath, 'utf-8');
            if (!content.includes(moduleName)) {
              const updatedContent = updateAppModule(content, moduleName, importPath);
              await writeFile(appModulePath, updatedContent, 'utf-8');
              console.log(pc.yellow(`  UPDATED  src/app.module.ts (registered ${moduleName})`));
            }
          } catch (err) {
            console.warn(pc.yellow(`Warning: Could not auto-register module in app.module.ts: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      }

      // Auto-register in local module for controller, service, and repository
      if (artifactType === 'controller' || artifactType === 'service' || artifactType === 'repository') {
        const localModulePath = join(targetDir, `${singular}.module.ts`);
        if (await fileExists(localModulePath)) {
          const className = `${capitalize(singular)}${capitalize(artifactType)}`;
          const importPath = `./${singular}.${artifactType}.js`;
          
          let arrayName: 'controllers' | 'providers' | 'exports' = 'providers';
          if (artifactType === 'controller') {
            arrayName = 'controllers';
          }

          try {
            let content = await readFile(localModulePath, 'utf-8');
            let updated = false;

            if (!content.includes(className)) {
              content = updateLocalModule(content, className, importPath, arrayName);
              updated = true;
              
              if (artifactType === 'service') {
                content = updateLocalModule(content, className, importPath, 'exports');
              }
            }

            if (updated) {
              await writeFile(localModulePath, content, 'utf-8');
              console.log(pc.yellow(`  UPDATED  src/${normalizedName}/${singular}.module.ts (registered ${className})`));
            }
          } catch (err) {
            console.warn(pc.yellow(`Warning: Could not auto-register ${className} in ${singular}.module.ts: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      }

      console.log(pc.bold(pc.green(`\n${capitalize(artifactType)} "${normalizedName}" successfully generated! 🎉`)));
      if (artifactType === 'resource' || artifactType === 'module') {
        console.log(pc.yellow(`Remember to import ${capitalize(singular)}Module in your AppModule.`));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error generating ${artifactType}: ${msg}`));
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
    // child_process handles error output directly when using 'inherit'
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

program
  .command('openapi:generate')
  .description('Generate OpenAPI 3.0.0 specification from application routes')
  .option('--entry <entry>', 'Application entry file (e.g. src/main.ts or dist/main.js)', 'src/main.ts')
  .option('--output <output>', 'Path to write the generated JSON spec', 'openapi.json')
  .action(async (options: { entry: string; output: string }) => {
    const entryPath = join(process.cwd(), options.entry);
    const outputPath = join(process.cwd(), options.output);

    console.log(pc.cyan(`Bootstrapping application from ${options.entry} to scan routes...`));
    
    process.env.KANJI_GENERATE_ONLY = 'true';

    try {
      if (!(await fileExists(entryPath))) {
        console.error(pc.red(`Error: Entry file not found at ${options.entry}`));
        process.exit(1);
      }

      await import(entryPath);

      const { OpenApiGenerator } = await import('@kanjijs/openapi');
      const generator = new OpenApiGenerator();
      
      console.log(pc.cyan('Generating OpenAPI specification...'));
      await generator.generateToFile(outputPath);

      console.log(pc.bold(pc.green(`\nOpenAPI specification successfully generated at "${options.output}"! 📄`)));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error generating OpenAPI spec: ${msg}`));
      process.exit(1);
    }
  });

program
  .command('sdk:generate')
  .description('Generate TypeScript client SDK from OpenAPI spec')
  .option('--spec <spec>', 'Path to the OpenAPI JSON specification', 'openapi.json')
  .option('--output <output>', 'Path to write the generated TypeScript client', 'src/sdk.ts')
  .action(async (options: { spec: string; output: string }) => {
    const specPath = join(process.cwd(), options.spec);
    const outputPath = join(process.cwd(), options.output);

    console.log(pc.cyan(`Reading OpenAPI spec from ${options.spec}...`));

    try {
      if (!(await fileExists(specPath))) {
        console.error(pc.red(`Error: OpenAPI spec file not found at ${options.spec}`));
        console.error(pc.yellow('Generate it first with "kanji openapi:generate".'));
        process.exit(1);
      }

      const { readFileSync } = await import('fs');
      const specContent = readFileSync(specPath, 'utf-8');
      const spec = JSON.parse(specContent);

      const { SdkGenerator } = await import('@kanjijs/openapi');
      const sdkGenerator = new SdkGenerator();

      console.log(pc.cyan('Generating TypeScript client SDK...'));
      await sdkGenerator.generateToFile(spec, outputPath);

      console.log(pc.bold(pc.green(`\nTypeScript client SDK successfully generated at "${options.output}"! 🔌`)));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Error generating SDK: ${msg}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

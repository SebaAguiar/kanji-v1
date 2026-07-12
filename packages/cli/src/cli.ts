#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { mkdir, writeFile, stat, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import prompts from 'prompts';

interface GeneratorOptions {
  crudActions: ('create' | 'findAll' | 'findOne' | 'update' | 'delete')[];
  authModel: 'none' | 'role-based' | 'owner-based';
  dbAdapter: 'postgres' | 'mongodb' | 'none';
  generateTests: boolean;
}

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

export async function detectDatabaseFromAppModule(): Promise<'postgres' | 'mongodb' | null> {
  const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
  if (await fileExists(appModulePath)) {
    try {
      const content = await readFile(appModulePath, 'utf-8');
      if (content.includes("type: 'postgres'") || content.includes('type: "postgres"')) {
        return 'postgres';
      }
      if (content.includes("type: 'mongodb'") || content.includes('type: "mongodb"')) {
        return 'mongodb';
      }
    } catch {
      // Ignore read errors
    }
  }
  return null;
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
export const getContractsTemplate = (name: string, options?: GeneratorOptions): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  const crudActions = options?.crudActions ?? ['create', 'findAll'];

  let content = `import { z } from 'zod';\n\n`;

  const needsCreateSchema = crudActions.includes('create') || crudActions.includes('update');
  if (needsCreateSchema) {
    content += `export const Create${singularCapitalized}Schema = z.object({\n  name: z.string().min(2),\n});\n\n`;
  }

  content += `export const ${singularCapitalized}ResponseSchema = z.object({\n  id: z.string(),\n  name: z.string(),\n});\n\n`;

  if (needsCreateSchema) {
    content += `export type Create${singularCapitalized}Input = z.infer<typeof Create${singularCapitalized}Schema>;\n`;
  }
  content += `export type ${singularCapitalized}Response = z.infer<typeof ${singularCapitalized}ResponseSchema>;\n\n`;

  content += `export const ${singularCapitalized}Contracts = {\n`;

  if (crudActions.includes('create')) {
    content += `  create: {\n    method: 'POST' as const,\n    path: '/' as const,\n    body: Create${singularCapitalized}Schema,\n    responses: {\n      201: ${singularCapitalized}ResponseSchema,\n    },\n  },\n`;
  }
  if (crudActions.includes('findAll')) {
    content += `  findAll: {\n    method: 'GET' as const,\n    path: '/' as const,\n    responses: {\n      200: z.array(${singularCapitalized}ResponseSchema),\n    },\n  },\n`;
  }
  if (crudActions.includes('findOne')) {
    content += `  findOne: {\n    method: 'GET' as const,\n    path: '/:id' as const,\n    responses: {\n      200: ${singularCapitalized}ResponseSchema,\n    },\n  },\n`;
  }
  if (crudActions.includes('update')) {
    content += `  update: {\n    method: 'PATCH' as const,\n    path: '/:id' as const,\n    body: Create${singularCapitalized}Schema.partial(),\n    responses: {\n      200: ${singularCapitalized}ResponseSchema,\n    },\n  },\n`;
  }
  if (crudActions.includes('delete')) {
    content += `  delete: {\n    method: 'DELETE' as const,\n    path: '/:id' as const,\n    responses: {\n      200: z.object({ success: z.boolean() }),\n    },\n  },\n`;
  }

  content += `};\n`;
  return content;
};

export const getRepositoryTemplate = (name: string, options?: GeneratorOptions): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  const crudActions = options?.crudActions ?? ['create', 'findAll'];
  const dbAdapter = options?.dbAdapter ?? 'postgres';

  const needsInputType = crudActions.includes('create') || crudActions.includes('update');
  const importInput = needsInputType ? `, Create${singularCapitalized}Input` : '';

  let content = `import { Repository, Inject } from '@kanjijs/core';\n`;
  if (dbAdapter !== 'none') {
    content += `import { DATABASE_CLIENT, type Database } from '@kanjijs/store';\n`;
  }
  content += `import type { ${singularCapitalized}Response${importInput} } from './${singular}.contracts.js';\n\n`;

  content += `@Repository()\nexport class ${singularCapitalized}Repository {\n`;
  if (dbAdapter !== 'none') {
    content += `  constructor(\n    @Inject(DATABASE_CLIENT)\n    private readonly db: Database\n  ) {}\n\n`;
  } else {
    content += `  // In-memory implementation\n  private items: ${singularCapitalized}Response[] = [];\n\n`;
  }

  if (crudActions.includes('create')) {
    content += `  async create(input: Create${singularCapitalized}Input): Promise<${singularCapitalized}Response> {\n`;
    content += `    const id = Math.random().toString(36).substring(7);\n`;
    if (dbAdapter === 'postgres') {
      content += `    await this.db.query.${name}.insert({\n      id,\n      ...input,\n    });\n`;
    } else if (dbAdapter === 'mongodb') {
      content += `    await this.db.collection('${name}').insertOne({\n      _id: id,\n      ...input,\n    });\n`;
    } else {
      content += `    this.items.push({ id, ...input });\n`;
    }
    content += `    return { id, ...input };\n  }\n\n`;
  }

  if (crudActions.includes('findAll')) {
    content += `  async findAll(): Promise<${singularCapitalized}Response[]> {\n`;
    if (dbAdapter === 'postgres') {
      content += `    return this.db.query.${name}.select() as Promise<${singularCapitalized}Response[]>;\n`;
    } else if (dbAdapter === 'mongodb') {
      content += `    const docs = await this.db.collection('${name}').find().toArray();\n`;
      content += `    return docs.map(doc => ({ id: doc._id.toString(), name: doc.name })) as ${singularCapitalized}Response[];\n`;
    } else {
      content += `    return this.items;\n`;
    }
    content += `  }\n\n`;
  }

  if (crudActions.includes('findOne')) {
    content += `  async findOne(id: string): Promise<${singularCapitalized}Response | null> {\n`;
    if (dbAdapter === 'postgres') {
      content += `    const result = await this.db.query.${name}.select();\n`;
      content += `    return result.find((item: any) => item.id === id) || null;\n`;
    } else if (dbAdapter === 'mongodb') {
      const dbCollection = `    const doc = await this.db.collection('${name}').findOne({ _id: id });\n`;
      content += dbCollection;
      content += `    return doc ? { id: doc._id.toString(), name: doc.name } : null;\n`;
    } else {
      content += `    return this.items.find(item => item.id === id) || null;\n`;
    }
    content += `  }\n\n`;
  }

  if (crudActions.includes('update')) {
    content += `  async update(id: string, input: Partial<Create${singularCapitalized}Input>): Promise<${singularCapitalized}Response> {\n`;
    if (dbAdapter === 'postgres') {
      content += `    await this.db.query.${name}.update(input);\n`;
      content += `    return { id, name: input.name ?? '' };\n`;
    } else if (dbAdapter === 'mongodb') {
      content += `    await this.db.collection('${name}').updateOne({ _id: id }, { $set: input });\n`;
      content += `    return { id, name: input.name ?? '' };\n`;
    } else {
      content += `    const idx = this.items.findIndex(item => item.id === id);\n`;
      content += `    if (idx !== -1) {\n      this.items[idx] = { ...this.items[idx], ...input };\n      return this.items[idx];\n    }\n    throw new Error('Not found');\n`;
    }
    content += `  }\n\n`;
  }

  if (crudActions.includes('delete')) {
    content += `  async delete(id: string): Promise<{ success: boolean }> {\n`;
    if (dbAdapter === 'postgres') {
      content += `    await this.db.query.${name}.delete();\n`;
    } else if (dbAdapter === 'mongodb') {
      content += `    await this.db.collection('${name}').deleteOne({ _id: id });\n`;
    } else {
      content += `    this.items = this.items.filter(item => item.id !== id);\n`;
    }
    content += `    return { success: true };\n  }\n\n`;
  }

  content += `}\n`;
  return content;
};

export const getServiceTemplate = (name: string, options?: GeneratorOptions): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  const crudActions = options?.crudActions ?? ['create', 'findAll'];

  const needsInputType = crudActions.includes('create') || crudActions.includes('update');
  const importInput = needsInputType ? `, Create${singularCapitalized}Input` : '';

  let content = `import { Injectable } from '@kanjijs/core';\n`;
  content += `import { ${singularCapitalized}Repository } from './${singular}.repository.js';\n`;
  content += `import type { ${singularCapitalized}Response${importInput} } from './${singular}.contracts.js';\n\n`;

  content += `@Injectable()\nexport class ${singularCapitalized}Service {\n`;
  content += `  constructor(private readonly repository: ${singularCapitalized}Repository) {}\n\n`;

  if (crudActions.includes('create')) {
    content += `  async create(input: Create${singularCapitalized}Input): Promise<${singularCapitalized}Response> {\n`;
    content += `    return this.repository.create(input);\n  }\n\n`;
  }
  if (crudActions.includes('findAll')) {
    content += `  async findAll(): Promise<${singularCapitalized}Response[]> {\n`;
    content += `    return this.repository.findAll();\n  }\n\n`;
  }
  if (crudActions.includes('findOne')) {
    content += `  async findOne(id: string): Promise<${singularCapitalized}Response | null> {\n`;
    content += `    return this.repository.findOne(id);\n  }\n\n`;
  }
  if (crudActions.includes('update')) {
    content += `  async update(id: string, input: Partial<Create${singularCapitalized}Input>): Promise<${singularCapitalized}Response> {\n`;
    content += `    return this.repository.update(id, input);\n  }\n\n`;
  }
  if (crudActions.includes('delete')) {
    content += `  async delete(id: string): Promise<{ success: boolean }> {\n`;
    content += `    return this.repository.delete(id);\n  }\n\n`;
  }

  content += `}\n`;
  return content;
};

export const getControllerTemplate = (name: string, options?: GeneratorOptions): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  const crudActions = options?.crudActions ?? ['create', 'findAll'];
  const authModel = options?.authModel ?? 'none';

  const methodsUsed = new Set<string>();
  if (crudActions.includes('create')) methodsUsed.add('Post');
  if (crudActions.includes('findAll') || crudActions.includes('findOne')) methodsUsed.add('Get');
  if (crudActions.includes('update')) methodsUsed.add('Patch');
  if (crudActions.includes('delete')) methodsUsed.add('Delete');

  const methodsImport = Array.from(methodsUsed).join(', ');
  let content = `import { Controller, ${methodsImport || 'Get'} } from '@kanjijs/platform-hono';\n`;
  
  if (crudActions.length > 0) {
    content += `import { Contract } from '@kanjijs/contracts';\n`;
  }
  content += `import { type Context } from 'hono';\n`;
  content += `import { ${singularCapitalized}Service } from './${singular}.service.js';\n`;
  if (crudActions.length > 0) {
    content += `import { ${singularCapitalized}Contracts } from './${singular}.contracts.js';\n`;
  }
  
  if (authModel !== 'none') {
    content += `import { UseGuards } from '@kanjijs/auth';\n`;
  }

  content += `\n@Controller('/${name.toLowerCase()}')\n`;
  if (authModel === 'role-based') {
    content += `// @UseGuards(RolesGuard)\n`;
  } else if (authModel === 'owner-based') {
    content += `// @UseGuards(OwnerGuard)\n`;
  }
  
  content += `export class ${singularCapitalized}Controller {\n`;
  content += `  constructor(private readonly ${singular}Service: ${singularCapitalized}Service) {}\n\n`;

  if (crudActions.includes('create')) {
    content += `  @Post('/')\n  @Contract(${singularCapitalized}Contracts.create)\n`;
    content += `  async create(c: Context): Promise<Response> {\n`;
    content += `    const input = c.get('kanji.validated.body');\n`;
    content += `    const result = await this.${singular}Service.create(input);\n`;
    content += `    return c.json(result, 201);\n  }\n\n`;
  }

  if (crudActions.includes('findAll')) {
    content += `  @Get('/')\n  @Contract(${singularCapitalized}Contracts.findAll)\n`;
    content += `  async findAll(c: Context): Promise<Response> {\n`;
    content += `    const result = await this.${singular}Service.findAll();\n`;
    content += `    return c.json(result, 200);\n  }\n\n`;
  }

  if (crudActions.includes('findOne')) {
    content += `  @Get('/:id')\n  @Contract(${singularCapitalized}Contracts.findOne)\n`;
    content += `  async findOne(c: Context): Promise<Response> {\n`;
    content += `    const id = c.req.param('id');\n`;
    content += `    const result = await this.${singular}Service.findOne(id);\n`;
    content += `    if (!result) return c.json({ error: 'Not found' }, 404);\n`;
    content += `    return c.json(result, 200);\n  }\n\n`;
  }

  if (crudActions.includes('update')) {
    content += `  @Patch('/:id')\n  @Contract(${singularCapitalized}Contracts.update)\n`;
    content += `  async update(c: Context): Promise<Response> {\n`;
    content += `    const id = c.req.param('id');\n`;
    content += `    const input = c.get('kanji.validated.body');\n`;
    content += `    const result = await this.${singular}Service.update(id, input);\n`;
    content += `    return c.json(result, 200);\n  }\n\n`;
  }

  if (crudActions.includes('delete')) {
    content += `  @Delete('/:id')\n  @Contract(${singularCapitalized}Contracts.delete)\n`;
    content += `  async delete(c: Context): Promise<Response> {\n`;
    content += `    const id = c.req.param('id');\n`;
    content += `    const result = await this.${singular}Service.delete(id);\n`;
    content += `    return c.json(result, 200);\n  }\n\n`;
  }

  content += `}\n`;
  return content;
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
  return `export * from './${singular}.contracts';
export * from './${singular}.repository';
export * from './${singular}.service';
export * from './${singular}.controller';
export * from './${singular}.module';
`;
};

export const getTestTemplate = (name: string, options?: GeneratorOptions): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  const crudActions = options?.crudActions ?? ['create', 'findAll'];
  const dbAdapter = options?.dbAdapter ?? 'postgres';

  let content = `import { describe, it, expect, beforeEach } from 'bun:test';\n`;
  content += `import { Test } from '@kanjijs/testing';\n`;
  content += `import { ${singularCapitalized}Module } from '../${singular}.module.js';\n`;
  content += `import { ${singularCapitalized}Controller } from '../${singular}.controller.js';\n`;
  content += `import { ${singularCapitalized}Service } from '../${singular}.service.js';\n`;
  content += `import { ${singularCapitalized}Repository } from '../${singular}.repository.js';\n`;
  if (dbAdapter !== 'none') {
    content += `import { DATABASE_CLIENT } from '@kanjijs/store';\n`;
    content += `import { KanjijsModule } from '@kanjijs/core';\n`;
  }
  content += `\n`;

  content += `describe('${singularCapitalized}Controller', () => {\n`;
  content += `  let controller: ${singularCapitalized}Controller;\n`;
  content += `  let service: ${singularCapitalized}Service;\n`;
  content += `  let repository: ${singularCapitalized}Repository;\n\n`;

  content += `  beforeEach(async () => {\n`;
  if (dbAdapter !== 'none') {
    content += `    const mockDb = {\n      query: {\n        ${name}: {\n          insert: async () => {},\n          select: async () => [],\n        },\n      },\n      collection: () => ({ \n        insertOne: async () => {},\n        find: () => ({ toArray: async () => [] }),\n        findOne: async () => null,\n        updateOne: async () => {},\n        deleteOne: async () => {},\n      }),\n    };\n\n`;
    content += `    @KanjijsModule({\n      providers: [\n        { provide: DATABASE_CLIENT, useValue: mockDb }\n      ],\n      exports: [DATABASE_CLIENT],\n      global: true\n    })\n    class MockDatabaseModule {}\n\n`;
  }

  content += `    const module = await Test.createTestingModule({\n`;
  if (dbAdapter !== 'none') {
    content += `      imports: [MockDatabaseModule, ${singularCapitalized}Module],\n`;
  } else {
    content += `      imports: [${singularCapitalized}Module],\n`;
  }
  content += `    }).compile();\n\n`;

  content += `    controller = module.get(${singularCapitalized}Controller);\n    service = module.get(${singularCapitalized}Service);\n    repository = module.get(${singularCapitalized}Repository);\n  });\n\n`;

  if (crudActions.includes('create')) {
    content += `  describe('POST /', () => {\n    it('should create a ${singular}', async () => {\n      expect(controller).toBeDefined();\n      expect(service).toBeDefined();\n      expect(repository).toBeDefined();\n    });\n  });\n\n`;
  }
  if (crudActions.includes('findAll')) {
    content += `  describe('GET /', () => {\n    it('should return all ${name}', async () => {\n      expect(controller).toBeDefined();\n    });\n  });\n\n`;
  }

  content += `});\n`;
  return content;
};

// --- Comando: kanji g <type> <name> ---
program
  .command('g')
  .alias('generate')
  .argument('[type]', 'Type of artifact to generate (resource, module, controller, service, repository)')
  .argument('[name]', 'Name of the artifact')
  .option('--dry-run', 'Preview changes without writing to disk', false)
  .option('--force', 'Overwrite existing files', false)
  .action(async (type: string | undefined, name: string | undefined, options: { dryRun: boolean; force: boolean }) => {
    let artifactType = type ? type.toLowerCase().trim() : undefined;
    let normalizedName = name ? name.toLowerCase().trim() : undefined;

    // 1. Interactive prompts for type
    if (!artifactType) {
      const response = await prompts({
        type: 'select',
        name: 'type',
        message: 'What type of artifact do you want to generate?',
        choices: [
          { title: 'Resource (Full CRUD + Modules)', value: 'resource' },
          { title: 'Module (DI Module)', value: 'module' },
          { title: 'Controller (HTTP Handlers)', value: 'controller' },
          { title: 'Service (Business Logic)', value: 'service' },
          { title: 'Repository (Data Access)', value: 'repository' }
        ]
      });
      artifactType = response.type;
      if (!artifactType) process.exit(0);
    }

    const allowedTypes = ['resource', 'module', 'controller', 'service', 'repository'];
    if (!allowedTypes.includes(artifactType)) {
      console.error(pc.red(`Error: Generating type "${artifactType}" is not supported. Use: ${allowedTypes.join(', ')}.`));
      process.exit(1);
    }

    // 2. Interactive prompts for name
    if (!normalizedName) {
      const response = await prompts({
        type: 'text',
        name: 'name',
        message: `Enter the name for the ${artifactType}:`,
        validate: (val: string) => val.trim().length > 0 ? true : 'Name is required'
      });
      normalizedName = response.name.toLowerCase().trim();
      if (!normalizedName) process.exit(0);
    }

    const singular = toSingular(normalizedName);
    const targetDir = join(process.cwd(), 'src', normalizedName);

    // Default configuration (for direct CLI usage)
    let crudActions: ('create' | 'findAll' | 'findOne' | 'update' | 'delete')[] = ['create', 'findAll'];
    let authModel: 'none' | 'role-based' | 'owner-based' = 'none';
    let dbAdapter: 'postgres' | 'mongodb' | 'none' = 'postgres';
    let generateTests = true;

    const detectedDb = await detectDatabaseFromAppModule();
    if (detectedDb) {
      dbAdapter = detectedDb;
    }

    // 3. Wizard prompts for resource (interactive mode only)
    if (artifactType === 'resource' && (!type || !name)) {
      const hasCrud = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Do you want to generate CRUD endpoints?',
        initial: true
      });

      if (hasCrud.value) {
        const actions = await prompts({
          type: 'multiselect',
          name: 'value',
          message: 'Select CRUD actions to include:',
          choices: [
            { title: 'Create (POST /)', value: 'create', selected: true },
            { title: 'Find All (GET /)', value: 'findAll', selected: true },
            { title: 'Find One (GET /:id)', value: 'findOne', selected: false },
            { title: 'Update (PATCH /:id)', value: 'update', selected: false },
            { title: 'Delete (DELETE /:id)', value: 'delete', selected: false }
          ],
          min: 1
        });
        crudActions = actions.value;
        if (!crudActions) process.exit(0);
      } else {
        crudActions = [];
      }

      const auth = await prompts({
        type: 'select',
        name: 'value',
        message: 'Select authorization model for this resource:',
        choices: [
          { title: 'None (Public)', value: 'none' },
          { title: 'Role-based (RBAC)', value: 'role-based' },
          { title: 'Owner-based (ACL)', value: 'owner-based' }
        ]
      });
      authModel = auth.value;
      if (!authModel) process.exit(0);

      if (detectedDb) {
        console.log(pc.green(`✔ Detected database adapter: ${detectedDb === 'postgres' ? 'PostgreSQL (Drizzle ORM)' : 'MongoDB (Native adapter)'} (from app.module.ts) 💾`));
      } else {
        const db = await prompts({
          type: 'select',
          name: 'value',
          message: 'Select database adapter:',
          choices: [
            { title: 'PostgreSQL (Drizzle ORM)', value: 'postgres' },
            { title: 'MongoDB (Native adapter)', value: 'mongodb' },
            { title: 'None (Memory/Mock)', value: 'none' }
          ]
        });
        dbAdapter = db.value;
        if (!dbAdapter) process.exit(0);
      }

      const tests = await prompts({
        type: 'confirm',
        name: 'value',
        message: 'Do you want to generate integration test files?',
        initial: true
      });
      generateTests = tests.value;
    }

    const genOptions: GeneratorOptions = { crudActions, authModel, dbAdapter, generateTests };

    console.log(pc.cyan(`\nProcessing ${artifactType} "${normalizedName}"...`));

    let files: { path: string; content: string }[] = [];

    if (artifactType === 'resource') {
      files = [
        { path: `${singular}.contracts.ts`, content: getContractsTemplate(normalizedName, genOptions) },
        { path: `${singular}.repository.ts`, content: getRepositoryTemplate(normalizedName, genOptions) },
        { path: `${singular}.service.ts`, content: getServiceTemplate(normalizedName, genOptions) },
        { path: `${singular}.controller.ts`, content: getControllerTemplate(normalizedName, genOptions) },
        { path: `${singular}.module.ts`, content: getModuleTemplate(normalizedName) },
        { path: 'index.ts', content: getIndexTemplate(normalizedName) },
      ];
      if (generateTests) {
        files.push({ path: `__tests__/${singular}.controller.spec.ts`, content: getTestTemplate(normalizedName, genOptions) });
      }
    } else if (artifactType === 'module') {
      files = [
        { path: `${singular}.module.ts`, content: getStandaloneModuleTemplate(normalizedName) },
        { path: 'index.ts', content: `export * from './${singular}.module';\n` },
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
        const exportLine = `export * from './${singular}.${artifactType}';\n`;
        if (await fileExists(indexFilePath)) {
          const indexContent = await readFile(indexFilePath, 'utf-8');
          if (!indexContent.includes(`./${singular}.${artifactType}`)) {
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

export const getPolicyTemplate = (resourceName: string, actionRules: Record<string, { model: 'role-based' | 'owner-based'; roles?: string[] }>): string => {
  const singular = toSingular(resourceName);
  const singularCapitalized = capitalize(singular);
  
  let imports = `import { Injectable } from '@kanjijs/core';\n`;
  imports += `import type { ResourcePolicy } from '@kanjijs/auth';\n`;
  imports += `import type { Context } from 'hono';\n`;

  let body = `@Injectable()\nexport class ${singularCapitalized}Policy implements ResourcePolicy {\n`;

  const actions = ['read', 'create', 'update', 'delete'];
  for (const action of actions) {
    const rule = actionRules[action];
    const methodName = `can${capitalize(action)}`;

    body += `  ${methodName}(c: Context, resource: any, user: any): boolean {\n`;
    if (rule) {
      if (rule.model === 'role-based') {
        const rolesArray = JSON.stringify(rule.roles || ['admin']);
        body += `    const allowed = ${rolesArray};\n`;
        body += `    return user.roles.some((role: string) => allowed.includes(role));\n`;
      } else {
        body += `    return resource.userId === user.userId || user.roles.includes('admin');\n`;
      }
    } else {
      body += `    return true;\n`;
    }
    body += `  }\n\n`;
  }

  // Remove the trailing newline and comma, then close class
  body = body.trimEnd() + '\n}\n';
  return `${imports}\n${body}`;
};

program
  .command('auth-setup')
  .alias('g-auth')
  .description('Configure interactive security policies for existing modules')
  .option('--dry-run', 'Preview changes without writing to disk', false)
  .action(async (options: { dryRun: boolean }) => {
    console.log(pc.cyan('Scanning src/ directory for existing modules...'));
    const srcDir = join(process.cwd(), 'src');

    if (!(await fileExists(srcDir))) {
      console.error(pc.red('Error: "src/" folder not found. Run this command at the root of a Kanji application.'));
      process.exit(1);
    }

    const dirEntries = await readdir(srcDir, { withFileTypes: true });
    const resources: string[] = dirEntries
      .filter((entry) => entry.isDirectory() && !['auth', 'db', '__tests__', 'common'].includes(entry.name))
      .map((entry) => entry.name);

    if (resources.length === 0) {
      console.log(pc.yellow('No modules found in src/ folder to secure.'));
      process.exit(0);
    }

    const selection = await prompts({
      type: 'multiselect',
      name: 'value',
      message: 'Select modules to secure:',
      choices: resources.map((res: string) => ({ title: capitalize(res), value: res })),
      min: 1
    });

    const selectedResources = selection.value;
    if (!selectedResources) process.exit(0);

    for (const res of selectedResources) {
      const singular = toSingular(res);
      const singularCapitalized = capitalize(singular);
      const targetDir = join(srcDir, res);

      console.log(pc.cyan(`\nConfiguring security for "${res}"...`));

      const actionsPrompt = await prompts({
        type: 'multiselect',
        name: 'value',
        message: `Select CRUD actions to secure for ${res}:`,
        choices: [
          { title: 'Create (POST /)', value: 'create', selected: true },
          { title: 'Read (GET / & GET /:id)', value: 'read', selected: false },
          { title: 'Update (PATCH /:id)', value: 'update', selected: true },
          { title: 'Delete (DELETE /:id)', value: 'delete', selected: true }
        ],
        min: 0
      });

      const securedActions: string[] = actionsPrompt.value || [];
      const actionRules: Record<string, { model: 'role-based' | 'owner-based'; roles?: string[] }> = {};

      for (const action of securedActions) {
        const modelPrompt = await prompts({
          type: 'select',
          name: 'value',
          message: `Select protection model for ${action.toUpperCase()} action on ${res}:`,
          choices: [
            { title: 'Role-based Access Control (RBAC)', value: 'role-based' },
            { title: 'Owner-based Access Control (ACL)', value: 'owner-based' }
          ]
        });

        const model = modelPrompt.value;
        if (!model) continue;

        let roles: string[] = [];
        if (model === 'role-based') {
          const rolesPrompt = await prompts({
            type: 'list',
            name: 'value',
            message: `Enter allowed roles for ${action.toUpperCase()} (comma separated):`,
            initial: 'admin'
          });
          roles = rolesPrompt.value || [];
        }

        actionRules[action] = { model, roles };
      }

      const policyContent = getPolicyTemplate(res, actionRules);
      const policyFileName = `${singular}.policy.ts`;
      const policyPath = join(targetDir, policyFileName);

      if (options.dryRun) {
        console.log(pc.yellow(`[Dry Run] Would create policy file: src/${res}/${policyFileName}`));
        continue;
      }

      await writeFile(policyPath, policyContent, 'utf-8');
      console.log(pc.green(`  CREATED  src/${res}/${policyFileName}`));

      const modulePath = join(targetDir, `${singular}.module.ts`);
      if (await fileExists(modulePath)) {
        try {
          const content = await readFile(modulePath, 'utf-8');
          const className = `${singularCapitalized}Policy`;
          const importPath = `./${singular}.policy`;
          
          if (!content.includes(className)) {
            let updatedContent = updateLocalModule(content, className, importPath, 'providers');
            updatedContent = updateLocalModule(updatedContent, className, importPath, 'exports');
            await writeFile(modulePath, updatedContent, 'utf-8');
            console.log(pc.yellow(`  UPDATED  src/${res}/${singular}.module.ts`));
          }
        } catch (err) {
          console.warn(pc.yellow(`Warning: Could not register policy in module: ${err instanceof Error ? err.message : String(err)}`));
        }
      }

      console.log(pc.bold(pc.green(`Security setup completed for "${res}"! 🔐`)));
    }
  });

if (import.meta.main) {
  program.parse(process.argv);
}

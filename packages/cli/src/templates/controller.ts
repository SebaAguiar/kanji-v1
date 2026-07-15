import { capitalize, toSingular } from '../utils/inflection.js';
import type { GeneratorOptions } from '../types.js';

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

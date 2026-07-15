import { capitalize, toSingular } from '../utils/inflection.js';
import type { GeneratorOptions } from '../types.js';

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

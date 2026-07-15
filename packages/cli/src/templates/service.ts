import { capitalize, toSingular } from '../utils/inflection.js';
import type { GeneratorOptions } from '../types.js';

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

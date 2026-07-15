import { capitalize, toSingular } from '../utils/inflection.js';
import type { GeneratorOptions } from '../types.js';

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
      content += `    const [result] = await this.db.query.${name}.where({ id }).select();\n`;
      content += `    return result ?? null;\n`;
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

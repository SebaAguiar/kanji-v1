import { capitalize, toSingular } from '../utils/inflection.js';
import type { GeneratorOptions } from '../types.js';

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

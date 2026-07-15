import { capitalize, toSingular } from '../utils/inflection.js';

export const getStandaloneModuleTemplate = (name: string): string => {
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

export const getStandaloneControllerTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Controller } from '@kanjijs/platform-hono';

@Controller('/${name.toLowerCase()}')
export class ${singularCapitalized}Controller {
  // constructor() {}
}
`;
};

export const getStandaloneServiceTemplate = (name: string): string => {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  return `import { Injectable } from '@kanjijs/core';

@Injectable()
export class ${singularCapitalized}Service {
  // constructor() {}
}
`;
};

export const getStandaloneRepositoryTemplate = (name: string): string => {
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

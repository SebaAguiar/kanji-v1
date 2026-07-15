import { capitalize, toSingular } from '../utils/inflection.js';

export const getModuleTemplate = (name: string): string => {
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

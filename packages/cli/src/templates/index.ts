import { toSingular } from '../utils/inflection.js';

export const getIndexTemplate = (name: string): string => {
  const singular = toSingular(name);
  return `export * from './${singular}.contracts';
export * from './${singular}.repository';
export * from './${singular}.service';
export * from './${singular}.controller';
export * from './${singular}.module';
`;
};

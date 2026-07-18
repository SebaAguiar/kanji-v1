import { toSingular } from '../utils/inflection.js';

export const getIndexTemplate = (name: string): string => {
  const singular = toSingular(name);
  return `export * from './${singular}.contracts.js';
export * from './${singular}.repository.js';
export * from './${singular}.service.js';
export * from './${singular}.controller.js';
export * from './${singular}.module.js';
`;
};

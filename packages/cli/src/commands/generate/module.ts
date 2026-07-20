import { toSingular } from '../../utils/inflection.js';
import { getStandaloneModuleTemplate } from '../../templates/standalone.js';

export function handleGenerateModule(
  name: string,
): { path: string; content: string }[] {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

  return [
    { path: `${singular}.module.ts`, content: getStandaloneModuleTemplate(normalizedName) },
    { path: 'index.ts', content: `export * from './${singular}.module.js';\n` },
  ];
}

import { toSingular } from '../../utils/inflection.js';
import { getStandaloneRepositoryTemplate } from '../../templates/standalone.js';

export function handleGenerateRepository(
  name: string,
): { path: string; content: string }[] {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

  return [
    {
      path: `${singular}.repository.ts`,
      content: getStandaloneRepositoryTemplate(normalizedName),
    },
  ];
}

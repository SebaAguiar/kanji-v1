import { toSingular } from '../../utils/inflection.js';
import { getStandaloneServiceTemplate } from '../../templates/standalone.js';

export function handleGenerateService(
  name: string,
): { path: string; content: string }[] {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

  return [
    {
      path: `${singular}.service.ts`,
      content: getStandaloneServiceTemplate(normalizedName),
    },
  ];
}

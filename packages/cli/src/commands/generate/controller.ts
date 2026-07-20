import { toSingular } from '../../utils/inflection.js';
import { getStandaloneControllerTemplate } from '../../templates/standalone.js';

export function handleGenerateController(
  name: string,
): { path: string; content: string }[] {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

  return [
    {
      path: `${singular}.controller.ts`,
      content: getStandaloneControllerTemplate(normalizedName),
    },
  ];
}

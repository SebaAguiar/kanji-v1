import { join } from 'path';
import { toSingular } from '../../utils/inflection.js';
import { getGatewayTemplate } from '../../templates/gateway.js';
import { getStandaloneModuleTemplate } from '../../templates/standalone.js';
import { fileExists } from '../../utils/file-generator.js';

export async function handleGenerateGateway(
  name: string,
  targetDir: string,
): Promise<{ path: string; content: string }[]> {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

  const files = [
    {
      path: `${singular}.gateway.ts`,
      content: getGatewayTemplate(normalizedName),
    },
  ];

  const localModulePath = join(targetDir, `${singular}.module.ts`);
  if (!(await fileExists(localModulePath))) {
    files.push({
      path: `${singular}.module.ts`,
      content: getStandaloneModuleTemplate(normalizedName),
    });
  }

  return files;
}

import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { fileExists } from '../utils/file-generator.js';

export function registerSdkCommand(program: Command) {
  program
    .command('sdk:generate')
    .description('Generate TypeScript client SDK from OpenAPI spec')
    .option('--spec <spec>', 'Path to the OpenAPI JSON specification', 'openapi.json')
    .option('--output <output>', 'Path to write the generated TypeScript client', 'src/sdk.ts')
    .action(async (options: { spec: string; output: string }) => {
      const specPath = join(process.cwd(), options.spec);
      const outputPath = join(process.cwd(), options.output);

      console.log(pc.cyan(`Reading OpenAPI spec from ${options.spec}...`));

      try {
        if (!(await fileExists(specPath))) {
          console.error(pc.red(`Error: OpenAPI spec file not found at ${options.spec}`));
          console.error(pc.yellow('Generate it first with "kanji openapi:generate".'));
          process.exit(1);
        }

        const { readFileSync } = await import('fs');
        const specContent = readFileSync(specPath, 'utf-8');
        const spec = JSON.parse(specContent);

        const { SdkGenerator } = await import('@kanjijs/openapi');
        const sdkGenerator = new SdkGenerator();

        console.log(pc.cyan('Generating TypeScript client SDK...'));
        await sdkGenerator.generateToFile(spec, outputPath);

        console.log(
          pc.bold(
            pc.green(`\nTypeScript client SDK successfully generated at "${options.output}"! 🔌`),
          ),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`Error generating SDK: ${msg}`));
        process.exit(1);
      }
    });
}

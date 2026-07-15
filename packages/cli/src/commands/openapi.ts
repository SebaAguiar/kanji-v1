import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { fileExists } from '../utils/file-generator.js';

export function registerOpenApiCommand(program: Command) {
  program
    .command('openapi:generate')
    .description('Generate OpenAPI 3.0.0 specification from application routes')
    .option('--entry <entry>', 'Application entry file (e.g. src/main.ts or dist/main.js)', 'src/main.ts')
    .option('--output <output>', 'Path to write the generated JSON spec', 'openapi.json')
    .action(async (options: { entry: string; output: string }) => {
      const entryPath = join(process.cwd(), options.entry);
      const outputPath = join(process.cwd(), options.output);

      console.log(pc.cyan(`Bootstrapping application from ${options.entry} to scan routes...`));

      process.env.KANJI_GENERATE_ONLY = 'true';

      try {
        if (!(await fileExists(entryPath))) {
          console.error(pc.red(`Error: Entry file not found at ${options.entry}`));
          process.exit(1);
        }

        const pkgPath = join(process.cwd(), 'package.json');
        let pkg: any = {};
        try {
          if (await fileExists(pkgPath)) {
            pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
          }
        } catch {}

        const { OpenApiGenerator } = await import('@kanjijs/openapi');
        const generator = new OpenApiGenerator({
          title: pkg.name ?? 'Kanji API',
          version: pkg.version ?? '1.0.0',
        });

        console.log(pc.cyan('Generating OpenAPI specification...'));
        await generator.generateToFile(outputPath);

        console.log(pc.bold(pc.green(`\nOpenAPI specification successfully generated at "${options.output}"! 📄`)));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`Error generating OpenAPI spec: ${msg}`));
        process.exit(1);
      }
    });
}

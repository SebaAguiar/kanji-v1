import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { fileExists } from '../utils/file-generator.js';

export function registerOpenApiCommand(program: Command) {
  program
    .command('openapi:generate')
    .description('Generate OpenAPI 3.0.0 specification from application routes')
    .option(
      '--entry <entry>',
      'Application entry file (e.g. src/main.ts or dist/main.js)',
      'src/main.ts',
    )
    .option('--output <output>', 'Path to write the generated JSON spec', 'openapi.json')
    .option('--check', 'Validate generated OpenAPI specification against disk without writing', false)
    .action(async (options: { entry: string; output: string; check: boolean }) => {
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
        let pkg: { name?: string; version?: string } = {};
        try {
          if (await fileExists(pkgPath)) {
            pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
          }
        } catch {}

        // Load the application to register all decorators and routes in metadata storage
        await import(entryPath);

        const { OpenApiGenerator } = await import('@kanjijs/openapi');
        const generator = new OpenApiGenerator({
          title: pkg.name ?? 'Kanji API',
          version: pkg.version ?? '1.0.0',
        });

        if (options.check) {
          console.log(pc.cyan('Validating generated OpenAPI spec against disk...'));
          const spec = generator.generateSpec();
          if (!(await fileExists(outputPath))) {
            console.error(pc.red(`Error: OpenAPI spec file not found at ${options.output}`));
            process.exit(1);
          }
          const existingSpec = JSON.parse(await readFile(outputPath, 'utf-8'));
          if (JSON.stringify(spec) !== JSON.stringify(existingSpec)) {
            console.error(pc.red('Error: OpenAPI specification in disk is out of date.'));
            console.error(pc.yellow(`Please run "kanji openapi:generate" to update it.`));
            process.exit(1);
          }
          console.log(pc.bold(pc.green('OpenAPI spec is valid and matches disk content! ✔')));
          return;
        }

        console.log(pc.cyan('Generating OpenAPI specification...'));
        await generator.generateToFile(outputPath);

        console.log(
          pc.bold(
            pc.green(`\nOpenAPI specification successfully generated at "${options.output}"! 📄`),
          ),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`Error generating OpenAPI spec: ${msg}`));
        process.exit(1);
      }
    });
}

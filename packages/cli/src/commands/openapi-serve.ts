import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { readFileSync } from 'fs';
import { fileExists } from '../utils/file-generator.js';

export function registerOpenApiServeCommand(program: Command) {
  program
    .command('openapi:serve')
    .description('Serve Swagger UI for local OpenAPI spec development')
    .option('--port <port>', 'Port to run the Swagger UI server', '3001')
    .option('--spec <spec>', 'Path to the OpenAPI JSON specification', 'openapi.json')
    .action(async (options: { port: string; spec: string }) => {
      const port = parseInt(options.port, 10);
      const specPath = join(process.cwd(), options.spec);

      if (!(await fileExists(specPath))) {
        console.error(pc.red(`Error: OpenAPI spec file not found at ${options.spec}`));
        console.error(pc.yellow('Generate it first with "kanji openapi:generate".'));
        process.exit(1);
      }

      console.log(pc.cyan(`Reading OpenAPI spec from ${options.spec}...`));
      let specContent: string;
      let specObj: { info?: { title?: string } };
      try {
        specContent = readFileSync(specPath, 'utf-8');
        specObj = JSON.parse(specContent);
      } catch (err) {
        console.error(pc.red(`Error reading/parsing spec: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }

      const { buildSwaggerHtml } = await import('@kanjijs/openapi');
      const title = specObj.info?.title ?? 'Kanji API';
      const swaggerHtml = buildSwaggerHtml('/openapi.json', title);

      Bun.serve({
        port,
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/' || url.pathname === '/index.html') {
            return new Response(swaggerHtml, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
          if (url.pathname === '/openapi.json') {
            return new Response(specContent, {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response('Not Found', { status: 404 });
        },
      });

      console.log(pc.bold(pc.green(`\nSwagger UI server running at http://localhost:${port} 🚀`)));
      console.log(pc.gray(`Serving spec from: ${specPath}`));
    });
}

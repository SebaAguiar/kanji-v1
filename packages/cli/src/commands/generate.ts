import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { capitalize, toSingular } from '../utils/inflection.js';
import { fileExists, generateFiles } from '../utils/file-generator.js';
import { updateAppModule, updateLocalModule } from '../utils/module-updater.js';
import { isValidArtifactType } from '../utils/validators.js';
import { printNextSteps } from '../utils/next-steps.js';

// Import generation handlers
import { handleGenerateResource } from './generate/resource.js';
import { handleGenerateModule } from './generate/module.js';
import { handleGenerateController } from './generate/controller.js';
import { handleGenerateService } from './generate/service.js';
import { handleGenerateRepository } from './generate/repository.js';
import { handleGenerateGateway } from './generate/gateway.js';
import { handleGenerateAuth } from './generate/auth.js';
import { handleGenerateWebhook } from './generate/webhook.js';

interface CliGenerateOptions {
  dryRun: boolean;
  force: boolean;
  endpoints?: boolean;
}

export function registerGenerateCommand(program: Command) {
  program
    .command('g')
    .alias('generate')
    .argument(
      '[type]',
      'Type of artifact to generate (resource, module, controller, service, repository, auth, webhook, gateway)',
    )
    .argument('[name]', 'Name of the artifact')
    .option('--dry-run', 'Preview changes without writing to disk', false)
    .option('--force', 'Overwrite existing files', false)
    .option('-e, --endpoints', 'Generate login/refresh endpoints for Auth Module (only applicable to auth)', false)
    .action(
      async (
        type: string | undefined,
        name: string | undefined,
        options: CliGenerateOptions,
      ) => {
        let artifactType = type ? type.toLowerCase().trim() : undefined;
        let normalizedName = name ? name.toLowerCase().trim() : undefined;

        // 1. Interactive prompts for type
        if (!artifactType) {
          const response = await prompts({
            type: 'select',
            name: 'type',
            message: 'What type of artifact do you want to generate?',
            choices: [
              { title: 'Resource (Full CRUD + Modules)', value: 'resource' },
              { title: 'Module (DI Module)', value: 'module' },
              { title: 'Controller (HTTP Handlers)', value: 'controller' },
              { title: 'Service (Business Logic)', value: 'service' },
              { title: 'Repository (Data Access)', value: 'repository' },
              { title: 'Gateway (WebSocket Gateway)', value: 'gateway' },
              { title: 'Auth (Module/Policies)', value: 'auth' },
              { title: 'Webhook (Handler/Module)', value: 'webhook' },
            ],
          });
          artifactType = response.type;
          if (!artifactType) process.exit(0);
        }

        if (!isValidArtifactType(artifactType)) {
          const allowedTypes = ['resource', 'module', 'controller', 'service', 'repository', 'auth', 'webhook', 'gateway'];
          console.error(
            pc.red(
              `Error: Generating type "${artifactType}" is not supported. Use: ${allowedTypes.join(', ')}.`,
            ),
          );
          process.exit(1);
        }

        // Delegate specific handlers that manage their own files / flow
        if (artifactType === 'auth') {
          await handleGenerateAuth({
            force: options.force,
            dryRun: options.dryRun,
            endpoints: options.endpoints,
            type,
            name,
          });
          return;
        }

        if (artifactType === 'webhook') {
          await handleGenerateWebhook(normalizedName, {
            force: options.force,
            dryRun: options.dryRun,
            type,
            name,
          });
          return;
        }

        // 2. Interactive prompts for name (Traditional Flows)
        if (!normalizedName) {
          const response = await prompts({
            type: 'text',
            name: 'name',
            message: `Enter the name for the ${artifactType}:`,
            validate: (val: string) => (val.trim().length > 0 ? true : 'Name is required'),
          });
          normalizedName = response.name.toLowerCase().trim();
          if (!normalizedName) process.exit(0);
        }

        const singular = toSingular(normalizedName);
        const targetDir = join(process.cwd(), 'src', normalizedName);

        let files: { path: string; content: string }[] = [];
        let dbAdapter: 'postgres' | 'mongodb' | 'none' = 'postgres';

        if (artifactType === 'resource') {
          const res = await handleGenerateResource(normalizedName, {
            force: options.force,
            dryRun: options.dryRun,
            type,
            name,
          });
          files = res.files;
          dbAdapter = res.dbAdapter;
        } else if (artifactType === 'module') {
          files = handleGenerateModule(normalizedName);
        } else if (artifactType === 'controller') {
          files = handleGenerateController(normalizedName);
        } else if (artifactType === 'service') {
          files = handleGenerateService(normalizedName);
        } else if (artifactType === 'repository') {
          files = handleGenerateRepository(normalizedName);
        } else if (artifactType === 'gateway') {
          files = await handleGenerateGateway(normalizedName, targetDir);
        }

        if (options.dryRun) {
          console.log(pc.yellow('--- DRY RUN (No changes will be applied) ---'));
          for (const file of files) {
            console.log(pc.gray(`Would create: src/${normalizedName}/${file.path}`));
          }
          if (artifactType !== 'resource' && artifactType !== 'module') {
            console.log(
              pc.gray(`Would verify or create/update index: src/${normalizedName}/index.ts`),
            );
          }
          console.log(pc.bold(pc.green('Dry run completed! 🎉')));
          return;
        }

        try {
          await generateFiles(targetDir, files, { force: options.force });

          // Update local index.ts for standalone components
          if (artifactType !== 'resource' && artifactType !== 'module') {
            const indexFilePath = join(targetDir, 'index.ts');
            const exportLine = `export * from './${singular}.${artifactType}.js';\n`;
            if (await fileExists(indexFilePath)) {
              const indexContent = await readFile(indexFilePath, 'utf-8');
              if (!indexContent.includes(`./${singular}.${artifactType}`)) {
                await writeFile(indexFilePath, indexContent + exportLine, 'utf-8');
                console.log(
                  pc.yellow(
                    `  UPDATED  src/${normalizedName}/index.ts (exported ${capitalize(singular)}${capitalize(artifactType)})`,
                  ),
                );
              }
            } else {
              await writeFile(indexFilePath, exportLine, 'utf-8');
              console.log(pc.green(`  CREATED  src/${normalizedName}/index.ts`));
            }
          }

          // Auto-register in app.module.ts for resource and module
          const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
          if (await fileExists(appModulePath)) {
            if (artifactType === 'resource' || artifactType === 'module') {
              const moduleName = `${capitalize(singular)}Module`;
              const importPath = `./${normalizedName}/${singular}.module.js`;
              try {
                const content = await readFile(appModulePath, 'utf-8');
                if (!content.includes(moduleName)) {
                  const updatedContent = updateAppModule(content, moduleName, importPath);
                  await writeFile(appModulePath, updatedContent, 'utf-8');
                  console.log(pc.yellow(`  UPDATED  src/app.module.ts (registered ${moduleName})`));
                }
              } catch (err) {
                console.warn(
                  pc.yellow(
                    `Warning: Could not auto-register module in app.module.ts: ${err instanceof Error ? err.message : String(err)}`,
                  ),
                );
              }
            }
          }

          // Auto-register in local module for controller, service, repository, and gateway
          if (
            artifactType === 'controller' ||
            artifactType === 'service' ||
            artifactType === 'repository' ||
            artifactType === 'gateway'
          ) {
            const localModulePath = join(targetDir, `${singular}.module.ts`);
            if (await fileExists(localModulePath)) {
              const className = `${capitalize(singular)}${capitalize(artifactType)}`;
              const importPath = `./${singular}.${artifactType}.js`;

              let arrayName: 'controllers' | 'providers' | 'exports' | 'gateways' = 'providers';
              if (artifactType === 'controller') {
                arrayName = 'controllers';
              } else if (artifactType === 'gateway') {
                arrayName = 'gateways';
              }

              try {
                let content = await readFile(localModulePath, 'utf-8');
                let updated = false;

                if (!content.includes(className)) {
                  content = updateLocalModule(content, className, importPath, arrayName);
                  updated = true;

                  if (artifactType === 'service') {
                    content = updateLocalModule(content, className, importPath, 'exports');
                  }
                }

                if (updated) {
                  await writeFile(localModulePath, content, 'utf-8');
                  console.log(
                    pc.yellow(
                      `  UPDATED  src/${normalizedName}/${singular}.module.ts (registered ${className})`,
                    ),
                  );
                }
              } catch (err) {
                console.warn(
                  pc.yellow(
                    `Warning: Could not auto-register ${className} in ${singular}.module.ts: ${err instanceof Error ? err.message : String(err)}`,
                  ),
                );
              }
            }
          }

          console.log(
            pc.bold(
              pc.green(
                `\n${capitalize(artifactType)} "${normalizedName}" successfully generated! 🎉`,
              ),
            ),
          );
          printNextSteps('resource', normalizedName, {
            db: dbAdapter,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(pc.red(`Error generating ${artifactType}: ${msg}`));
          if (msg.includes('already exists')) {
            console.error(pc.yellow('Use the --force option to overwrite existing files.'));
          }
          process.exit(1);
        }
      },
    );
}

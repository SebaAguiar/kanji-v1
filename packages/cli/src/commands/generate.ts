import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { capitalize, toSingular } from '../utils/inflection.js';
import { fileExists, detectDatabaseFromAppModule, generateFiles } from '../utils/file-generator.js';
import { updateAppModule, updateLocalModule } from '../utils/module-updater.js';
import { isValidArtifactType } from '../utils/validators.js';
import type { GeneratorOptions, AuthProvider } from '../types.js';
import { getContractsTemplate } from '../templates/contracts.js';
import { getRepositoryTemplate } from '../templates/repository.js';
import { getServiceTemplate } from '../templates/service.js';
import { getControllerTemplate } from '../templates/controller.js';
import { getModuleTemplate } from '../templates/module.js';
import { getIndexTemplate } from '../templates/index.js';
import { getTestTemplate } from '../templates/test.js';
import {
  getStandaloneModuleTemplate,
  getStandaloneControllerTemplate,
  getStandaloneServiceTemplate,
  getStandaloneRepositoryTemplate,
} from '../templates/standalone.js';
import { getGatewayTemplate } from '../templates/gateway.js';
import { runAuthSetup } from './auth.js';
import { getAuthModuleTemplate } from '../templates/auth-endpoints.js';
import { getWebhookTemplate } from '../templates/webhook.js';
import { printNextSteps } from '../utils/next-steps.js';

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

        // --- Auth Artifact Generation ---
        if (artifactType === 'auth') {
          let mode: 'endpoints' | 'policies' | undefined;
          if (options.endpoints) {
            mode = 'endpoints';
          }

          if (!mode && (!type || !name)) {
            const res = await prompts({
              type: 'select',
              name: 'mode',
              message: 'What do you want to generate?',
              choices: [
                { title: 'Auth module (login/refresh endpoints)', value: 'endpoints' },
                { title: 'Resource policies (secure existing modules)', value: 'policies' },
              ],
            });
            mode = res.mode;
            if (!mode) process.exit(0);
          } else if (!mode) {
            // Default when running kanji g auth without interactiveness
            mode = 'policies';
          }

          if (mode === 'policies') {
            await runAuthSetup({ dryRun: options.dryRun });
            return;
          }

          // Generate endpoints
          let providers: AuthProvider[] = [];
          if (options.endpoints) {
            providers = ['jwt'];
          } else if (!type || !name) {
            const resProviders = await prompts({
              type: 'multiselect',
              name: 'providers',
              message: 'Select auth providers to configure:',
              choices: [
                { title: 'JWT (Local login/refresh)', value: 'jwt', selected: true },
                { title: 'Google (OAuth)', value: 'google' },
                { title: 'GitHub (OAuth)', value: 'github' },
                { title: 'Microsoft (OAuth)', value: 'microsoft' },
              ],
            });
            providers = resProviders.providers || [];
          } else {
            providers = ['jwt'];
          }

          const authTemplates = getAuthModuleTemplate(providers);
          const authDir = join(process.cwd(), 'src', 'auth');

          const authFiles = [
            { path: 'auth.module.ts', content: authTemplates.module },
            { path: 'auth.controller.ts', content: authTemplates.controller },
          ];

          if (options.dryRun) {
            console.log(pc.yellow('--- DRY RUN (No changes will be applied) ---'));
            console.log(pc.gray(`Would create: src/auth/auth.module.ts`));
            console.log(pc.gray(`Would create: src/auth/auth.controller.ts`));
            console.log(pc.bold(pc.green('Dry run completed! 🎉')));
            return;
          }

          await generateFiles(authDir, authFiles, { force: options.force });

          // Register in app.module.ts
          const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
          if (await fileExists(appModulePath)) {
            try {
              const content = await readFile(appModulePath, 'utf-8');
              if (!content.includes('AuthModule')) {
                const updatedContent = updateAppModule(content, 'AuthModule', './auth/auth.module.js');
                await writeFile(appModulePath, updatedContent, 'utf-8');
                console.log(pc.yellow(`  UPDATED  src/app.module.ts (registered AuthModule)`));
              }
            } catch (err) {
              console.warn(
                pc.yellow(
                  `Warning: Could not auto-register AuthModule in app.module.ts: ${err instanceof Error ? err.message : String(err)}`,
                ),
              );
            }
          }

          console.log(pc.bold(pc.green('\nAuth module successfully generated! 🎉')));
          printNextSteps('auth', 'auth');
          return;
        }

        // --- Webhook Artifact Generation ---
        if (artifactType === 'webhook') {
          let webhookName = normalizedName;
          if (!webhookName) {
            const res = await prompts({
              type: 'text',
              name: 'name',
              message: 'Webhook name:',
              initial: 'stripe',
              validate: (val: string) => (val.trim().length > 0 ? true : 'Webhook name is required'),
            });
            webhookName = res.name.toLowerCase().trim();
            if (!webhookName) process.exit(0);
          }

          let events: string[] = [];
          let authType: 'none' | 'secret' | 'signature' = 'none';
          let retry = false;

          if (!type || !name) {
            const resEvents = await prompts({
              type: 'text',
              name: 'events',
              message: 'Event types (comma separated):',
              initial: 'invoice.paid, customer.subscription.updated',
            });
            events = resEvents.events
              ? resEvents.events
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)
              : [];

            const resAuth = await prompts({
              type: 'select',
              name: 'auth',
              message: 'Select auth type:',
              choices: [
                { title: 'None', value: 'none' },
                { title: 'Secret header', value: 'secret' },
                { title: 'Signature verification', value: 'signature' },
              ],
            });
            authType = resAuth.auth || 'none';

            const resRetry = await prompts({
              type: 'confirm',
              name: 'retry',
              message: 'Enable retry queue?',
              initial: false,
            });
            retry = resRetry.retry;
          } else {
            events = ['webhook.event'];
            authType = 'none';
            retry = false;
          }

          const webhookTemplates = getWebhookTemplate(webhookName, {
            name: webhookName,
            events,
            auth: authType,
            retry,
          });

          const webhookDir = join(process.cwd(), 'src', 'webhooks', webhookName);
          const webhookFiles = [
            { path: `${webhookName}.webhook.ts`, content: webhookTemplates.webhook },
            { path: `${webhookName}.webhook.module.ts`, content: webhookTemplates.module },
            { path: 'events.ts', content: webhookTemplates.events },
          ];

          if (options.dryRun) {
            console.log(pc.yellow('--- DRY RUN (No changes will be applied) ---'));
            console.log(pc.gray(`Would create: src/webhooks/${webhookName}/${webhookName}.webhook.ts`));
            console.log(pc.gray(`Would create: src/webhooks/${webhookName}/${webhookName}.webhook.module.ts`));
            console.log(pc.gray(`Would create: src/webhooks/${webhookName}/events.ts`));
            console.log(pc.bold(pc.green('Dry run completed! 🎉')));
            return;
          }

          await generateFiles(webhookDir, webhookFiles, { force: options.force });

          // Register in app.module.ts
          const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
          if (await fileExists(appModulePath)) {
            const moduleClassName = `${capitalize(webhookName)}WebhookModule`;
            const importPath = `./webhooks/${webhookName}/${webhookName}.webhook.module.js`;
            try {
              const content = await readFile(appModulePath, 'utf-8');
              if (!content.includes(moduleClassName)) {
                const updatedContent = updateAppModule(content, moduleClassName, importPath);
                await writeFile(appModulePath, updatedContent, 'utf-8');
                console.log(pc.yellow(`  UPDATED  src/app.module.ts (registered ${moduleClassName})`));
              }
            } catch (err) {
              console.warn(
                pc.yellow(
                  `Warning: Could not auto-register ${moduleClassName} in app.module.ts: ${err instanceof Error ? err.message : String(err)}`,
                ),
              );
            }
          }

          console.log(pc.bold(pc.green(`\nWebhook "${webhookName}" successfully generated! 🎉`)));
          printNextSteps('webhook', webhookName, {
            webhookAuth: authType,
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

        // Default configuration (for direct CLI usage)
        let crudActions: ('create' | 'findAll' | 'findOne' | 'update' | 'delete')[] = [
          'create',
          'findAll',
        ];
        let authModel: 'none' | 'role-based' | 'owner-based' = 'none';
        let dbAdapter: 'postgres' | 'mongodb' | 'none' = 'postgres';
        let generateTests = true;

        const detectedDb = await detectDatabaseFromAppModule();
        if (detectedDb) {
          dbAdapter = detectedDb;
        }

        // 3. Wizard prompts for resource (interactive mode only)
        if (artifactType === 'resource' && (!type || !name)) {
          const hasCrud = await prompts({
            type: 'confirm',
            name: 'value',
            message: 'Do you want to generate CRUD endpoints?',
            initial: true,
          });

          if (hasCrud.value) {
            const actions = await prompts({
              type: 'multiselect',
              name: 'value',
              message: 'Select CRUD actions to include:',
              choices: [
                { title: 'Create (POST /)', value: 'create', selected: true },
                { title: 'Find All (GET /)', value: 'findAll', selected: true },
                { title: 'Find One (GET /:id)', value: 'findOne', selected: false },
                { title: 'Update (PATCH /:id)', value: 'update', selected: false },
                { title: 'Delete (DELETE /:id)', value: 'delete', selected: false },
              ],
              min: 1,
            });
            crudActions = actions.value;
            if (!crudActions) process.exit(0);
          } else {
            crudActions = [];
          }

          const auth = await prompts({
            type: 'select',
            name: 'value',
            message: 'Select authorization model for this resource:',
            choices: [
              { title: 'None (Public)', value: 'none' },
              { title: 'Role-based (RBAC)', value: 'role-based' },
              { title: 'Owner-based (ACL)', value: 'owner-based' },
            ],
          });
          authModel = auth.value;
          if (!authModel) process.exit(0);

          if (detectedDb) {
            console.log(
              pc.green(
                `✔ Detected database adapter: ${
                  detectedDb === 'postgres'
                    ? 'PostgreSQL (Drizzle ORM)'
                    : 'MongoDB (Native adapter)'
                } (from app.module.ts) 💾`,
              ),
            );
          } else {
            const db = await prompts({
              type: 'select',
              name: 'value',
              message: 'Select database adapter:',
              choices: [
                { title: 'PostgreSQL (Drizzle ORM)', value: 'postgres' },
                { title: 'MongoDB (Native adapter)', value: 'mongodb' },
                { title: 'None (Memory/Mock)', value: 'none' },
              ],
            });
            dbAdapter = db.value;
            if (!dbAdapter) process.exit(0);
          }

          const testsOption = await prompts({
            type: 'confirm',
            name: 'value',
            message: 'Do you want to generate integration test files?',
            initial: true,
          });
          generateTests = testsOption.value;
        }

        const genOptions: GeneratorOptions = { crudActions, authModel, dbAdapter, generateTests };

        console.log(pc.cyan(`\nProcessing ${artifactType} "${normalizedName}"...`));

        let files: { path: string; content: string }[] = [];

        if (artifactType === 'resource') {
          files = [
            {
              path: `${singular}.contracts.ts`,
              content: getContractsTemplate(normalizedName, genOptions),
            },
            {
              path: `${singular}.repository.ts`,
              content: getRepositoryTemplate(normalizedName, genOptions),
            },
            {
              path: `${singular}.service.ts`,
              content: getServiceTemplate(normalizedName, genOptions),
            },
            {
              path: `${singular}.controller.ts`,
              content: getControllerTemplate(normalizedName, genOptions),
            },
            { path: `${singular}.module.ts`, content: getModuleTemplate(normalizedName) },
            { path: 'index.ts', content: getIndexTemplate(normalizedName) },
          ];
          if (generateTests) {
            files.push({
              path: `__tests__/${singular}.controller.spec.ts`,
              content: getTestTemplate(normalizedName, genOptions),
            });
          }
        } else if (artifactType === 'module') {
          files = [
            { path: `${singular}.module.ts`, content: getStandaloneModuleTemplate(normalizedName) },
            { path: 'index.ts', content: `export * from './${singular}.module.js';\n` },
          ];
        } else if (artifactType === 'controller') {
          files = [
            {
              path: `${singular}.controller.ts`,
              content: getStandaloneControllerTemplate(normalizedName),
            },
          ];
        } else if (artifactType === 'service') {
          files = [
            {
              path: `${singular}.service.ts`,
              content: getStandaloneServiceTemplate(normalizedName),
            },
          ];
        } else if (artifactType === 'repository') {
          files = [
            {
              path: `${singular}.repository.ts`,
              content: getStandaloneRepositoryTemplate(normalizedName),
            },
          ];
        } else if (artifactType === 'gateway') {
          files = [
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

import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { capitalize } from '../../utils/inflection.js';
import { fileExists, generateFiles } from '../../utils/file-generator.js';
import { updateAppModule } from '../../utils/module-updater.js';
import { getWebhookTemplate } from '../../templates/webhook.js';
import { printNextSteps } from '../../utils/next-steps.js';

export async function handleGenerateWebhook(
  nameArg: string | undefined,
  options: { force: boolean; dryRun: boolean; type?: string; name?: string },
): Promise<{ handled: boolean }> {
  let webhookName = nameArg?.toLowerCase().trim();
  const isInteractive = !options.type || !options.name;

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

  if (isInteractive) {
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
    return { handled: true };
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

  return { handled: true };
}

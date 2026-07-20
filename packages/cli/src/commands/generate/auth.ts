import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { fileExists, generateFiles } from '../../utils/file-generator.js';
import { updateAppModule } from '../../utils/module-updater.js';
import { getAuthModuleTemplate } from '../../templates/auth-endpoints.js';
import { runAuthSetup } from '../auth.js';
import { printNextSteps } from '../../utils/next-steps.js';
import type { AuthProvider } from '../../types.js';

export async function handleGenerateAuth(
  options: { force: boolean; dryRun: boolean; type?: string; name?: string; endpoints?: boolean },
): Promise<{ handled: boolean }> {
  let mode: 'endpoints' | 'policies' | undefined;
  if (options.endpoints) {
    mode = 'endpoints';
  }

  const isInteractive = !options.type || !options.name;

  if (!mode && isInteractive) {
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
    mode = 'policies';
  }

  if (mode === 'policies') {
    await runAuthSetup({ dryRun: options.dryRun });
    return { handled: true };
  }

  // Generate endpoints
  let providers: AuthProvider[] = [];
  if (options.endpoints) {
    providers = ['jwt'];
  } else if (isInteractive) {
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
    return { handled: true };
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

  return { handled: true };
}

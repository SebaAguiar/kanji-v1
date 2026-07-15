import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { readdir, writeFile, readFile } from 'fs/promises';
import { capitalize, toSingular } from '../utils/inflection.js';
import { fileExists } from '../utils/file-generator.js';
import { updateLocalModule } from '../utils/module-updater.js';
import { getPolicyTemplate } from '../templates/policy.js';

export function registerAuthCommand(program: Command) {
  program
    .command('auth-setup')
    .alias('g-auth')
    .description('Configure interactive security policies for existing modules')
    .option('--dry-run', 'Preview changes without writing to disk', false)
    .action(async (options: { dryRun: boolean }) => {
      console.log(pc.cyan('Scanning src/ directory for existing modules...'));
      const srcDir = join(process.cwd(), 'src');

      if (!(await fileExists(srcDir))) {
        console.error(pc.red('Error: "src/" folder not found. Run this command at the root of a Kanji application.'));
        process.exit(1);
      }

      const dirEntries = await readdir(srcDir, { withFileTypes: true });
      const resources: string[] = dirEntries
        .filter((entry) => entry.isDirectory() && !['auth', 'db', '__tests__', 'common'].includes(entry.name))
        .map((entry) => entry.name);

      if (resources.length === 0) {
        console.log(pc.yellow('No modules found in src/ folder to secure.'));
        process.exit(0);
      }

      const selection = await prompts({
        type: 'multiselect',
        name: 'value',
        message: 'Select modules to secure:',
        choices: resources.map((res: string) => ({ title: capitalize(res), value: res })),
        min: 1,
      });

      const selectedResources = selection.value;
      if (!selectedResources) process.exit(0);

      for (const res of selectedResources) {
        const singular = toSingular(res);
        const singularCapitalized = capitalize(singular);
        const targetDir = join(srcDir, res);

        console.log(pc.cyan(`\nConfiguring security for "${res}"...`));

        const actionsPrompt = await prompts({
          type: 'multiselect',
          name: 'value',
          message: `Select CRUD actions to secure for ${res}:`,
          choices: [
            { title: 'Create (POST /)', value: 'create', selected: true },
            { title: 'Read (GET / & GET /:id)', value: 'read', selected: false },
            { title: 'Update (PATCH /:id)', value: 'update', selected: true },
            { title: 'Delete (DELETE /:id)', value: 'delete', selected: true },
          ],
          min: 0,
        });

        const securedActions: string[] = actionsPrompt.value || [];
        const actionRules: Record<string, { model: 'role-based' | 'owner-based'; roles?: string[] }> = {};

        for (const action of securedActions) {
          const modelPrompt = await prompts({
            type: 'select',
            name: 'value',
            message: `Select protection model for ${action.toUpperCase()} action on ${res}:`,
            choices: [
              { title: 'Role-based Access Control (RBAC)', value: 'role-based' },
              { title: 'Owner-based Access Control (ACL)', value: 'owner-based' },
            ],
          });

          const model = modelPrompt.value;
          if (!model) continue;

          let roles: string[] = [];
          if (model === 'role-based') {
            const rolesPrompt = await prompts({
              type: 'list',
              name: 'value',
              message: `Enter allowed roles for ${action.toUpperCase()} (comma separated):`,
              initial: 'admin',
            });
            roles = rolesPrompt.value || [];
          }

          actionRules[action] = { model, roles };
        }

        const policyContent = getPolicyTemplate(res, actionRules);
        const policyFileName = `${singular}.policy.ts`;
        const policyPath = join(targetDir, policyFileName);

        if (options.dryRun) {
          console.log(pc.yellow(`[Dry Run] Would create policy file: src/${res}/${policyFileName}`));
          continue;
        }

        await writeFile(policyPath, policyContent, 'utf-8');
        console.log(pc.green(`  CREATED  src/${res}/${policyFileName}`));

        const modulePath = join(targetDir, `${singular}.module.ts`);
        if (await fileExists(modulePath)) {
          try {
            const content = await readFile(modulePath, 'utf-8');
            const className = `${singularCapitalized}Policy`;
            const importPath = `./${singular}.policy`;

            if (!content.includes(className)) {
              let updatedContent = updateLocalModule(content, className, importPath, 'providers');
              updatedContent = updateLocalModule(updatedContent, className, importPath, 'exports');
              await writeFile(modulePath, updatedContent, 'utf-8');
              console.log(pc.yellow(`  UPDATED  src/${res}/${singular}.module.ts`));
            }
          } catch (err) {
            console.warn(
              pc.yellow(`Warning: Could not register policy in module: ${err instanceof Error ? err.message : String(err)}`)
            );
          }
        }

        console.log(pc.bold(pc.green(`Security setup completed for "${res}"! 🔐`)));
      }
    });
}

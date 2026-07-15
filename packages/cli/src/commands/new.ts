import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import {
  getPackageJsonTemplate,
  getTsConfigTemplate,
  getMainTsTemplate,
  getAppModuleTemplate,
  getAppControllerTemplate,
} from '../templates/project.js';

export function registerNewCommand(program: Command) {
  program
    .command('new')
    .argument('<app-name>', 'Name of the new application')
    .action(async (appName: string) => {
      const targetDir = join(process.cwd(), appName);
      console.log(pc.cyan(`Creating a new Kanji project in ${targetDir}...`));

      try {
        await mkdir(join(targetDir, 'src'), { recursive: true });

        const packageJson = getPackageJsonTemplate(appName);
        const tsconfigJson = getTsConfigTemplate();
        const mainTs = getMainTsTemplate();
        const appModuleTs = getAppModuleTemplate();
        const appControllerTs = getAppControllerTemplate();

        await writeFile(join(targetDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
        await writeFile(join(targetDir, 'tsconfig.json'), JSON.stringify(tsconfigJson, null, 2), 'utf-8');
        await writeFile(join(targetDir, 'src', 'main.ts'), mainTs, 'utf-8');
        await writeFile(join(targetDir, 'src', 'app.module.ts'), appModuleTs, 'utf-8');
        await writeFile(join(targetDir, 'src', 'app.controller.ts'), appControllerTs, 'utf-8');
        await writeFile(join(targetDir, '.env.example'), 'PORT=3000\nJWT_SECRET=super-secret-key-change-me\n', 'utf-8');

        console.log(pc.bold(pc.green(`\nKanji project "${appName}" successfully created! 🚀`)));
        console.log(pc.yellow(`Next steps:\n  cd ${appName}\n  bun install\n  bun dev`));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`Error creating project: ${msg}`));
        process.exit(1);
      }
    });
}

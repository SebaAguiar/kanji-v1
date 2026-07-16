import { Command } from 'commander';
import prompts from 'prompts';
import pc from 'picocolors';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { fileExists } from '../utils/file-generator.js';
import { getGitHubActionsTemplate } from '../templates/ci/github-actions.js';
import { getGitLabCITemplate } from '../templates/ci/gitlab-ci.js';
import { printNextSteps } from '../utils/next-steps.js';
import { ProjectOptions, CiPlatform } from '../types.js';

interface CliInitCiOptions {
  test: boolean;
  lint: boolean;
  build: boolean;
}

export function registerInitCiCommand(program: Command) {
  program
    .command('init:ci')
    .argument('[platform]', 'CI platform to initialize (github, gitlab)')
    .option('--no-test', 'Do not run tests in CI')
    .option('--no-lint', 'Do not run lint in CI')
    .option('--no-build', 'Do not build the project in CI')
    .action(async (platformArg: string | undefined, options: CliInitCiOptions) => {
      let platform = platformArg as CiPlatform | undefined;
      let tests = options.test;
      let lint = options.lint;
      let build = options.build;

      const isInteractive = !platformArg;

      if (isInteractive) {
        console.log(pc.cyan('🔍 Initializing CI/CD configuration...\n'));

        const resPlatform = await prompts({
          type: 'select',
          name: 'platform',
          message: 'Select CI platform:',
          choices: [
            { title: 'GitHub Actions', value: 'github' },
            { title: 'GitLab CI', value: 'gitlab' },
          ],
        });
        platform = resPlatform.platform;
        if (!platform) process.exit(0);

        const resSteps = await prompts([
          {
            type: 'confirm',
            name: 'tests',
            message: 'Run tests in pipeline?',
            initial: true,
          },
          {
            type: 'confirm',
            name: 'lint',
            message: 'Run lint in pipeline?',
            initial: true,
          },
          {
            type: 'confirm',
            name: 'build',
            message: 'Run build in pipeline?',
            initial: true,
          },
        ]);

        tests = resSteps.tests;
        lint = resSteps.lint;
        build = resSteps.build;
      } else {
        platform = platformArg?.toLowerCase() as CiPlatform;
        if (platform !== 'github' && platform !== 'gitlab') {
          console.error(pc.red(`Error: Unsupported platform "${platformArg}". Use "github" or "gitlab".`));
          process.exit(1);
        }
      }

      const pm = (await fileExists(join(process.cwd(), 'pnpm-lock.yaml')))
        ? 'pnpm'
        : (await fileExists(join(process.cwd(), 'package-lock.json')))
        ? 'npm'
        : 'bun';

      const projOpts: ProjectOptions = {
        appName: 'my-app',
        pm,
        tests,
        lint,
        build,
        ci: platform,
      };

      try {
        if (platform === 'github') {
          const ciTemplate = getGitHubActionsTemplate(projOpts);
          const ciDir = join(process.cwd(), '.github', 'workflows');
          await mkdir(ciDir, { recursive: true });
          const ciFilePath = join(ciDir, 'ci.yml');
          await writeFile(ciFilePath, ciTemplate, 'utf-8');
          console.log(pc.green(`  CREATED  .github/workflows/ci.yml`));
        } else if (platform === 'gitlab') {
          const ciTemplate = getGitLabCITemplate(projOpts);
          const ciFilePath = join(process.cwd(), '.gitlab-ci.yml');
          await writeFile(ciFilePath, ciTemplate, 'utf-8');
          console.log(pc.green(`  CREATED  .gitlab-ci.yml`));
        }

        console.log(pc.bold(pc.green(`\nCI/CD pipeline for "${platform}" successfully initialized! 🚀`)));
        printNextSteps('ci', platform, {
          ciPlatform: platform as 'github' | 'gitlab',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(pc.red(`Error generating CI config: ${msg}`));
        process.exit(1);
      }
    });
}

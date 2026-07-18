import { Command } from 'commander';
import pc from 'picocolors';
import { join, resolve } from 'path';
import { mkdir, writeFile, readdir, readFile, stat } from 'fs/promises';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { printNextSteps } from '../utils/next-steps.js';
import { DatabaseType, AuthProvider, CiPlatform, PackageManager, ProjectOptions } from '../types.js';
import {
  getPackageJsonTemplate,
  getTsConfigTemplate,
  getMainTsTemplate,
  getAppModuleTemplate,
  getAppControllerTemplate,
  getGitIgnoreTemplate,
  getReadmeTemplate,
  getAppE2ETestTemplate,
  getDbSchemaTemplate,
  getDbSeedTemplate,
} from '../templates/project.js';
import { getDockerComposeTemplate } from '../templates/docker-compose.js';
import { getDrizzleConfigTemplate } from '../templates/drizzle-config.js';
import { getGitHubActionsTemplate } from '../templates/ci/github-actions.js';
import { getGitLabCITemplate } from '../templates/ci/gitlab-ci.js';
import { getAuthModuleTemplate } from '../templates/auth-endpoints.js';

interface CliNewOptions {
  minimal: boolean;
  db?: string;
  auth?: string;
  openapi?: boolean;
  docker?: boolean;
  ci?: string;
  tests?: boolean;
  pm?: string;
  install: boolean;
  template?: string;
}

async function copyTemplate(srcDir: string, destDir: string, version: string) {
  const entries = await readdir(srcDir);

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.env') {
      continue;
    }

    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const s = await stat(srcPath);

    if (s.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, version);
    } else {
      if (entry === 'package.json') {
        const content = await readFile(srcPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Rename package to match target app name
        pkg.name = destDir.split('/').pop() || pkg.name;

        const updateDeps = (deps?: Record<string, string>) => {
          if (!deps) return;
          for (const key of Object.keys(deps)) {
            if (key.startsWith('@kanjijs/') && deps[key] === 'workspace:*') {
              deps[key] = `^${version}`;
            }
          }
        };

        updateDeps(pkg.dependencies);
        updateDeps(pkg.devDependencies);
        updateDeps(pkg.peerDependencies);

        await writeFile(destPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      } else if (entry === 'tsconfig.json') {
        const tsconfig = getTsConfigTemplate();
        await writeFile(destPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
      } else if (entry === '.env.example') {
        const content = await readFile(srcPath, 'utf-8');
        await writeFile(destPath, content, 'utf-8');
        // Also write active .env
        await writeFile(join(destDir, '.env'), content, 'utf-8');
      } else {
        const content = await readFile(srcPath);
        await writeFile(destPath, content);
      }
    }
  }
}

export function registerNewCommand(program: Command) {
  program
    .command('new')
    .argument('[app-name]', 'Name of the new application')
    .option('-m, --minimal', 'Create a minimal scaffold without prompts', false)
    .option('-d, --db <type>', 'Database adapter (postgres, mongodb, none)')
    .option('-a, --auth <providers>', 'Comma-separated auth providers (jwt, google, github, microsoft)')
    .option('--openapi', 'Enable OpenAPI documentation')
    .option('--docker', 'Generate Docker Compose file')
    .option('--ci <platform>', 'CI pipeline config (github, gitlab, none)')
    .option('--tests', 'Generate test suite')
    .option('--pm <manager>', 'Package manager to use (bun, npm, pnpm)')
    .option('--no-install', 'Do not run package manager install automatically')
    .option('-t, --template <name>', 'Template to initialize (starter, basic, saas-starter)')
    .action(async (nameArg: string | undefined, options: CliNewOptions) => {
      const isInteractive =
        !options.minimal &&
        !options.db &&
        !options.auth &&
        options.openapi === undefined &&
        options.docker === undefined &&
        !options.ci &&
        options.tests === undefined &&
        !options.pm &&
        !options.template;

      let appName = nameArg;
      let pm = options.pm as PackageManager | undefined;
      let db = options.db as DatabaseType | undefined;
      let auth: AuthProvider[] = [];
      let openapi = options.openapi;
      let docker = options.docker;
      let ci = options.ci as CiPlatform | undefined;
      let tests = options.tests;
      let template: string | undefined = options.template;

      if (isInteractive) {
        console.log(pc.cyan('Welcome to the Kanji Framework installer! 🚀\n'));

        const resUseTemplate = await prompts({
          type: 'select',
          name: 'useTemplate',
          message: 'Initialize project from a template?',
          choices: [
            { title: 'None (Scaffold custom project)', value: 'none' },
            { title: 'Starter (Minimal blank API)', value: 'starter' },
            { title: 'Basic (CRUD with PostgreSQL & Drizzle)', value: 'basic' },
            { title: 'SaaS Starter (Multi-tenant with auth, teams, policies & E2E tests)', value: 'saas-starter' },
          ],
        });

        if (resUseTemplate.useTemplate === undefined) process.exit(0);

        if (resUseTemplate.useTemplate !== 'none') {
          template = resUseTemplate.useTemplate;
        }

        if (!appName) {
          const res = await prompts({
            type: 'text',
            name: 'appName',
            message: 'Application name:',
            initial: 'my-api',
            validate: (val: string) => (val.trim().length > 0 ? true : 'App name is required'),
          });
          appName = res.appName;
          if (!appName) process.exit(0);
        }

        const resPm = await prompts({
          type: 'select',
          name: 'pm',
          message: 'Package manager:',
          choices: [
            { title: 'bun', value: 'bun' },
            { title: 'npm', value: 'npm' },
            { title: 'pnpm', value: 'pnpm' },
          ],
        });
        pm = resPm.pm;
        if (!pm) process.exit(0);

        if (!template) {
          const resDb = await prompts({
            type: 'select',
            name: 'db',
            message: 'Database:',
            choices: [
              { title: 'PostgreSQL (Drizzle ORM)', value: 'postgres' },
              { title: 'MongoDB (Native adapter)', value: 'mongodb' },
              { title: 'None', value: 'none' },
            ],
          });
          db = resDb.db;
          if (!db) process.exit(0);

          const resAuth = await prompts({
            type: 'multiselect',
            name: 'auth',
            message: 'Auth providers:',
            choices: [
              { title: 'JWT (Local login/refresh)', value: 'jwt' },
              { title: 'Google (OAuth)', value: 'google' },
              { title: 'GitHub (OAuth)', value: 'github' },
              { title: 'Microsoft (OAuth)', value: 'microsoft' },
            ],
          });
          auth = resAuth.auth || [];

          const resOpenapi = await prompts({
            type: 'confirm',
            name: 'openapi',
            message: 'Enable OpenAPI documentation?',
            initial: true,
          });
          openapi = resOpenapi.openapi;

          const resDocker = await prompts({
            type: 'confirm',
            name: 'docker',
            message: 'Generate Docker Compose file?',
            initial: true,
          });
          docker = resDocker.docker;

          const resCi = await prompts({
            type: 'select',
            name: 'ci',
            message: 'CI/CD pipeline:',
            choices: [
              { title: 'GitHub Actions', value: 'github' },
              { title: 'GitLab CI', value: 'gitlab' },
              { title: 'None', value: 'none' },
            ],
          });
          ci = resCi.ci;
          if (!ci) process.exit(0);

          const resTests = await prompts({
            type: 'confirm',
            name: 'tests',
            message: 'Generate example tests?',
            initial: true,
          });
          tests = resTests.tests;
        }
      } else {
        appName = nameArg || 'my-api';
        pm = (options.pm || 'bun') as PackageManager;
        db = (options.db || 'none') as DatabaseType;
        auth = options.auth
          ? (options.auth.split(',').map((s) => s.trim()) as AuthProvider[])
          : [];
        openapi = options.openapi ?? false;
        docker = options.docker ?? false;
        ci = (options.ci || 'none') as CiPlatform;
        tests = options.tests ?? false;
      }

      const targetDir = join(process.cwd(), appName);

      // Handle template creation
      if (template) {
        if (template !== 'starter' && template !== 'basic' && template !== 'saas-starter') {
          console.error(pc.red(`Error: Invalid template name "${template}". Valid values are: starter, basic, saas-starter.`));
          process.exit(1);
        }

        console.log(pc.cyan(`\nCreating a new Kanji project from template "${template}" in ${targetDir}...`));

        try {
          // Resolve examples path: templates/examples/ is bundled inside the CLI package
          const examplesDir = resolve(import.meta.dirname, '..', '..', 'templates', 'examples');
          const templateSrcDir = join(examplesDir, template);

          // Get version from the CLI's own package.json (always in sync with other packages)
          const cliPkgPath = resolve(import.meta.dirname, '..', '..', 'package.json');
          let version = '1.0.0-alpha.1';
          try {
            const cliPkg = JSON.parse(await readFile(cliPkgPath, 'utf-8'));
            version = cliPkg.version;
          } catch {
            // fallback
          }

          await mkdir(targetDir, { recursive: true });
          await copyTemplate(templateSrcDir, targetDir, version);

          console.log(pc.bold(pc.green(`\nKanji project "${appName}" successfully created from template! 🚀`)));

          // Git init & Install dependencies
          if (options.install !== false) {
            try {
              console.log(pc.cyan('\nInitializing Git repository...'));
              execSync('git init', { cwd: targetDir, stdio: 'ignore' });
            } catch {
              console.warn(pc.yellow('Warning: Could not initialize git repository automatically.'));
            }

            try {
              const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;
              console.log(pc.cyan(`Running ${installCmd} in project root...`));
              execSync(installCmd, { cwd: targetDir, stdio: 'inherit' });
            } catch {
              console.warn(pc.yellow('Warning: Could not install dependencies automatically.'));
            }
          }

          printNextSteps('project', appName, {
            pm,
            db: template === 'starter' ? 'none' : 'postgres',
          });

          return;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(pc.red(`Error creating project from template: ${msg}`));
          process.exit(1);
        }
      }

      // Handle custom scaffolding (original code)
      // Read the CLI's own version for generated package.json
      const cliPkgPath = resolve(import.meta.dirname, '..', '..', 'package.json');
      let cliVersion: string | undefined;
      try {
        const cliPkg = JSON.parse(await readFile(cliPkgPath, 'utf-8'));
        cliVersion = cliPkg.version;
      } catch {
        // fallback — version is undefined
      }

      const projOpts: ProjectOptions = {
        appName,
        db,
        auth,
        openapi,
        docker,
        ci,
        tests,
        pm,
        version: cliVersion,
      };

      console.log(pc.cyan(`\nCreating a new Kanji project in ${targetDir}...`));

      try {
        await mkdir(join(targetDir, 'src'), { recursive: true });

        const packageJson = getPackageJsonTemplate(appName, projOpts);
        const tsconfigJson = getTsConfigTemplate();
        const mainTs = getMainTsTemplate();
        const appModuleTs = getAppModuleTemplate(projOpts);
        const appControllerTs = getAppControllerTemplate();
        const gitignore = getGitIgnoreTemplate();
        const readme = getReadmeTemplate(appName, projOpts);

        await writeFile(
          join(targetDir, 'package.json'),
          JSON.stringify(packageJson, null, 2),
          'utf-8',
        );
        await writeFile(
          join(targetDir, 'tsconfig.json'),
          JSON.stringify(tsconfigJson, null, 2),
          'utf-8',
        );
        await writeFile(join(targetDir, 'src', 'main.ts'), mainTs, 'utf-8');
        await writeFile(join(targetDir, 'src', 'app.module.ts'), appModuleTs, 'utf-8');
        await writeFile(join(targetDir, 'src', 'app.controller.ts'), appControllerTs, 'utf-8');
        await writeFile(join(targetDir, '.gitignore'), gitignore, 'utf-8');
        await writeFile(join(targetDir, 'README.md'), readme, 'utf-8');

        // Conditionally generate .env.example
        let envContent = 'PORT=3000\n';
        if (auth.length > 0) {
          envContent += 'JWT_SECRET=super-secret-key-change-me\n';
        }
        if (db === 'postgres') {
          envContent += 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/kanji_db\n';
        } else if (db === 'mongodb') {
          envContent += 'DATABASE_URL=mongodb://root:password@localhost:27017/kanji_db?authSource=admin\n';
        }
        await writeFile(join(targetDir, '.env.example'), envContent, 'utf-8');
        await writeFile(join(targetDir, '.env'), envContent, 'utf-8'); // Generate default active .env

        // Conditionally generate docker-compose
        if (docker || db !== 'none') {
          const dockerComposeContent = getDockerComposeTemplate(db || 'none');
          if (dockerComposeContent) {
            await writeFile(join(targetDir, 'docker-compose.yml'), dockerComposeContent, 'utf-8');
          }
        }

        // Conditionally generate Drizzle configurations
        if (db === 'postgres') {
          const drizzleConfig = getDrizzleConfigTemplate();
          await writeFile(join(targetDir, 'drizzle.config.ts'), drizzleConfig, 'utf-8');

          await mkdir(join(targetDir, 'src', 'database', 'schema'), { recursive: true });
          await writeFile(join(targetDir, 'src', 'database', 'schema', 'index.ts'), getDbSchemaTemplate(), 'utf-8');
          await writeFile(join(targetDir, 'src', 'database', 'seed.ts'), getDbSeedTemplate(), 'utf-8');
        }

        // Conditionally generate Auth
        if (auth.length > 0) {
          const authTemplates = getAuthModuleTemplate(auth);
          await mkdir(join(targetDir, 'src', 'auth'), { recursive: true });
          await writeFile(join(targetDir, 'src', 'auth', 'auth.module.ts'), authTemplates.module, 'utf-8');
          await writeFile(join(targetDir, 'src', 'auth', 'auth.controller.ts'), authTemplates.controller, 'utf-8');
        }

        // Conditionally generate CI pipeline
        if (ci === 'github') {
          const ciTemplate = getGitHubActionsTemplate(projOpts);
          await mkdir(join(targetDir, '.github', 'workflows'), { recursive: true });
          await writeFile(join(targetDir, '.github', 'workflows', 'ci.yml'), ciTemplate, 'utf-8');
        } else if (ci === 'gitlab') {
          const ciTemplate = getGitLabCITemplate(projOpts);
          await writeFile(join(targetDir, '.gitlab-ci.yml'), ciTemplate, 'utf-8');
        }

        // Conditionally generate Tests
        if (tests) {
          await mkdir(join(targetDir, 'src', '__tests__'), { recursive: true });
          await writeFile(join(targetDir, 'src', '__tests__', 'app.e2e.spec.ts'), getAppE2ETestTemplate(), 'utf-8');
        }

        console.log(pc.bold(pc.green(`\nKanji project "${appName}" successfully created! 🚀`)));

        // Git init & Install dependencies
        if (options.install !== false) {
          try {
            console.log(pc.cyan('\nInitializing Git repository...'));
            execSync('git init', { cwd: targetDir, stdio: 'ignore' });
          } catch {
            console.warn(pc.yellow('Warning: Could not initialize git repository automatically.'));
          }

          try {
            const installCmd = pm === 'bun' ? 'bun install' : `${pm} install`;
            console.log(pc.cyan(`Running ${installCmd} in project root...`));
            execSync(installCmd, { cwd: targetDir, stdio: 'inherit' });
          } catch {
            console.warn(pc.yellow('Warning: Could not install dependencies automatically.'));
          }
        }

        printNextSteps('project', appName, {
          pm,
          db,
        });

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`Error creating project: ${msg}`));
        process.exit(1);
      }
    });
}

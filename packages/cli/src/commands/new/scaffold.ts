import prompts from 'prompts';
import pc from 'picocolors';
import { DatabaseType, AuthProvider, CiPlatform, PackageManager } from '../../types.js';

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

export async function promptProjectOptions(
  nameArg: string | undefined,
  options: CliNewOptions,
): Promise<{
  appName: string;
  pm: PackageManager;
  db: DatabaseType;
  auth: AuthProvider[];
  openapi: boolean;
  docker: boolean;
  ci: CiPlatform;
  tests: boolean;
  template?: string;
}> {
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

  return {
    appName,
    pm: pm || 'bun',
    db: db || 'none',
    auth,
    openapi: openapi ?? false,
    docker: docker ?? false,
    ci: ci || 'none',
    tests: tests ?? false,
    template,
  };
}

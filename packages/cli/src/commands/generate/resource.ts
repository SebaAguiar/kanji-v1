import prompts from 'prompts';
import pc from 'picocolors';
import { toSingular } from '../../utils/inflection.js';
import { detectDatabaseFromAppModule } from '../../utils/file-generator.js';
import type { GeneratorOptions } from '../../types.js';
import { getContractsTemplate } from '../../templates/contracts.js';
import { getRepositoryTemplate } from '../../templates/repository.js';
import { getServiceTemplate } from '../../templates/service.js';
import { getControllerTemplate } from '../../templates/controller.js';
import { getModuleTemplate } from '../../templates/module.js';
import { getIndexTemplate } from '../../templates/index.js';
import { getTestTemplate } from '../../templates/test.js';

export async function handleGenerateResource(
  name: string,
  options: { force: boolean; dryRun: boolean; type?: string; name?: string },
): Promise<{ files: { path: string; content: string }[]; dbAdapter: 'postgres' | 'mongodb' | 'none' }> {
  const normalizedName = name.toLowerCase().trim();
  const singular = toSingular(normalizedName);

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

  const isInteractive = !options.type || !options.name;

  if (isInteractive) {
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

  const files = [
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

  return { files, dbAdapter };
}

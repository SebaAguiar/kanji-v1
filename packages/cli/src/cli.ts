#!/usr/bin/env node
import { Command } from 'commander';
import { registerNewCommand } from './commands/new.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerMigrateCommands } from './commands/migrate.js';
import { registerSeedCommand } from './commands/seed.js';
import { registerDbPushCommand } from './commands/db-push.js';
import { registerDbStudioCommand } from './commands/db-studio.js';
import { registerDevCommand } from './commands/dev.js';
import { registerBuildCommand } from './commands/build.js';
import { registerStartCommand } from './commands/start.js';
import { registerOpenApiCommand } from './commands/openapi.js';
import { registerSdkCommand } from './commands/sdk.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerEnvCommand } from './commands/env.js';
import { registerCheckCommand } from './commands/check.js';
import { registerInitCiCommand } from './commands/init-ci.js';

const program = new Command();

program
  .name('kanji')
  .description('Kanji Framework CLI for rapid backend development')
  .version('1.0.0-alpha.8');

registerNewCommand(program);
registerGenerateCommand(program);
registerMigrateCommands(program);
registerSeedCommand(program);
registerDbPushCommand(program);
registerDbStudioCommand(program);
registerDevCommand(program);
registerBuildCommand(program);
registerStartCommand(program);
registerOpenApiCommand(program);
registerSdkCommand(program);
registerAuthCommand(program);
registerEnvCommand(program);
registerCheckCommand(program);
registerInitCiCommand(program);

if (import.meta.main) {
  program.parse(process.argv);
}
export { program };

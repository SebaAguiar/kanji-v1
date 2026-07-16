#!/usr/bin/env node
import { Command } from 'commander';
import { registerNewCommand } from './commands/new.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerMigrateCommands } from './commands/migrate.js';
import { registerSeedCommand } from './commands/seed.js';
import { registerDbStudioCommand } from './commands/db-studio.js';
import { registerDevCommand } from './commands/dev.js';
import { registerBuildCommand } from './commands/build.js';
import { registerOpenApiCommand } from './commands/openapi.js';
import { registerSdkCommand } from './commands/sdk.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerEnvCommand } from './commands/env.js';

const program = new Command();

program
  .name('kanji')
  .description('Kanji Framework CLI for rapid backend development')
  .version('1.0.0-alpha.1');

registerNewCommand(program);
registerGenerateCommand(program);
registerMigrateCommands(program);
registerSeedCommand(program);
registerDbStudioCommand(program);
registerDevCommand(program);
registerBuildCommand(program);
registerOpenApiCommand(program);
registerSdkCommand(program);
registerAuthCommand(program);
registerEnvCommand(program);

if (import.meta.main) {
  program.parse(process.argv);
}
export { program };

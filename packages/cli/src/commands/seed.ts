import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerSeedCommand(program: Command) {
  program
    .command('seed:run')
    .description('Run the database seed script')
    .action(() => {
      console.log(pc.cyan('Running seed file...'));
      runDelegateCommand('bun src/db/seed.ts');
    });
}

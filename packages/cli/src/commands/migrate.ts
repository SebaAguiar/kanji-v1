import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerMigrateCommands(program: Command) {
  program
    .command('migrate')
    .description('Run database migrations')
    .action(() => {
      console.log(pc.cyan('Running migrations...'));
      runDelegateCommand('bunx drizzle-kit migrate');
    });

  program
    .command('migrate:create')
    .description('Create a new database migration')
    .action(() => {
      console.log(pc.cyan('Generating new migration files...'));
      runDelegateCommand('bunx drizzle-kit generate');
    });
}

import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerDbPushCommand(program: Command) {
  program
    .command('db:push')
    .description('Push database schema changes (drizzle-kit push)')
    .action(() => {
      console.log(pc.cyan('Pushing database schema...'));
      runDelegateCommand('bunx drizzle-kit push');
    });
}

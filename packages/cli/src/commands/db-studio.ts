import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerDbStudioCommand(program: Command) {
  program
    .command('db:studio')
    .description('Open Drizzle Studio dashboard')
    .action(() => {
      console.log(pc.cyan('Opening Drizzle Studio...'));
      runDelegateCommand('bunx drizzle-kit studio');
    });
}

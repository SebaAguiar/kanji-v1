import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerDevCommand(program: Command) {
  program
    .command('dev')
    .description('Start the application in development mode with HMR/Watch')
    .action(() => {
      console.log(pc.cyan('Starting development server...'));
      runDelegateCommand('bun --watch src/main.ts');
    });
}

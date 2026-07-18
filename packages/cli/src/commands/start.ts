import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the application in production mode')
    .action(() => {
      console.log(pc.cyan('Starting production server...'));
      runDelegateCommand('bun src/main.ts');
    });
}

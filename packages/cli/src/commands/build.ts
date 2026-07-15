import { Command } from 'commander';
import pc from 'picocolors';
import { runDelegateCommand } from '../utils/executor.js';

export function registerBuildCommand(program: Command) {
  program
    .command('build')
    .description('Build the application for production')
    .action(() => {
      console.log(pc.cyan('Building application...'));
      runDelegateCommand('tsc');
    });
}

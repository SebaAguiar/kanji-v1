import { execSync } from 'child_process';

export function runDelegateCommand(cmd: string) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    // child_process handles error output directly when using 'inherit'
    process.exit(1);
  }
}

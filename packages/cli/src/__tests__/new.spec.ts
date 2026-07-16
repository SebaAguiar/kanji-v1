import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtemp, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI New Command', () => {
  const isDist = __dirname.includes('dist');
  const cliPath = join(__dirname, isDist ? '../cli.js' : '../cli.ts');

  it('should scaffold a minimal project correctly', async () => {
    const tmpProjectDir = await mkdtemp(join(tmpdir(), 'kanji-new-minimal-'));

    execSync(`bun ${cliPath} new my-app --minimal --no-install`, {
      cwd: tmpProjectDir,
      stdio: 'pipe',
    });

    const projectPath = join(tmpProjectDir, 'my-app');
    const files = await readdir(projectPath);

    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
    expect(files).toContain('.gitignore');
    expect(files).toContain('README.md');
    expect(files).toContain('src');

    const srcFiles = await readdir(join(projectPath, 'src'));
    expect(srcFiles).toContain('main.ts');
    expect(srcFiles).toContain('app.module.ts');
    expect(srcFiles).toContain('app.controller.ts');

    await rm(tmpProjectDir, { recursive: true, force: true });
  });

  it('should scaffold a customized project with database, auth, openapi, docker, and tests options', async () => {
    const tmpProjectDir = await mkdtemp(join(tmpdir(), 'kanji-new-custom-'));

    execSync(
      `bun ${cliPath} new custom-api --db postgres --auth jwt --openapi --docker --ci github --tests --no-install`,
      {
        cwd: tmpProjectDir,
        stdio: 'pipe',
      },
    );

    const projectPath = join(tmpProjectDir, 'custom-api');
    const files = await readdir(projectPath);

    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
    expect(files).toContain('docker-compose.yml');
    expect(files).toContain('drizzle.config.ts');
    expect(files).toContain('.github');

    const srcFiles = await readdir(join(projectPath, 'src'));
    expect(srcFiles).toContain('main.ts');
    expect(srcFiles).toContain('app.module.ts');
    expect(srcFiles).toContain('app.controller.ts');
    expect(srcFiles).toContain('db');
    expect(srcFiles).toContain('auth');
    expect(srcFiles).toContain('__tests__');

    const authFiles = await readdir(join(projectPath, 'src', 'auth'));
    expect(authFiles).toContain('auth.module.ts');
    expect(authFiles).toContain('auth.controller.ts');

    const workflowFiles = await readdir(join(projectPath, '.github', 'workflows'));
    expect(workflowFiles).toContain('ci.yml');

    await rm(tmpProjectDir, { recursive: true, force: true });
  });
});

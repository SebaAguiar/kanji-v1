import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI Check Command', () => {
  const isDist = __dirname.includes('dist');
  const cliPath = join(__dirname, isDist ? '../cli.js' : '../cli.ts');

  it('should pass on a valid minimalist project structure', async () => {
    const tmpCheckDir = await mkdtemp(join(tmpdir(), 'kanji-cli-check-ok-'));
    await mkdir(join(tmpCheckDir, 'src'), { recursive: true });

    await writeFile(
      join(tmpCheckDir, 'src', 'app.module.ts'),
      `import { KanjijsModule } from '@kanjijs/core';\n@KanjijsModule({})\nexport class AppModule {}\n`,
      'utf-8',
    );

    let success = true;
    try {
      execSync(`bun ${cliPath} check`, { cwd: tmpCheckDir, stdio: 'pipe' });
    } catch {
      success = false;
    }
    expect(success).toBe(true);

    await rm(tmpCheckDir, { recursive: true, force: true });
  });

  it('should fail on modules without decorators and fix env vars/drizzle with --fix', async () => {
    const tmpCheckDir = await mkdtemp(join(tmpdir(), 'kanji-cli-check-fail-'));
    await mkdir(join(tmpCheckDir, 'src'), { recursive: true });

    // Missing KanjijsModule decorator
    await writeFile(
      join(tmpCheckDir, 'src', 'app.module.ts'),
      `export class AppModule {}\n`,
      'utf-8',
    );

    // Call process.env.SOME_VAL but missing in .env
    await writeFile(
      join(tmpCheckDir, 'src', 'test.service.ts'),
      `import { Injectable } from '@kanjijs/platform-hono';
@Injectable()
export class TestService {
  val = process.env.SOME_API_KEY;
}
`,
      'utf-8',
    );

    let success = true;
    let output = '';
    try {
      output = execSync(`bun ${cliPath} check`, { cwd: tmpCheckDir, stdio: 'pipe' }).toString();
    } catch (err: any) {
      success = false;
      output = err.stdout?.toString() || err.stderr?.toString() || '';
    }

    expect(success).toBe(false);
    expect(output).toContain('is missing the @KanjijsModule decorator');
    expect(output).toContain('Environment variable "SOME_API_KEY" is missing in .env');

    // Run with --fix (it should fix the .env but app.module.ts decorator error is not auto-fixable)
    let successFix = true;
    let outputFix = '';
    try {
      outputFix = execSync(`bun ${cliPath} check --fix`, { cwd: tmpCheckDir, stdio: 'pipe' }).toString();
    } catch (err: any) {
      successFix = false;
      outputFix = err.stdout?.toString() || err.stderr?.toString() || '';
    }

    expect(successFix).toBe(false); // still fails due to missing @KanjijsModule decorator
    expect(outputFix).toContain('was missing in .env and has been auto-fixed!');

    // Check .env is created and contains variable
    const envExists = await Bun.file(join(tmpCheckDir, '.env')).exists();
    expect(envExists).toBe(true);
    const envContent = await Bun.file(join(tmpCheckDir, '.env')).text();
    expect(envContent).toContain('SOME_API_KEY=');

    await rm(tmpCheckDir, { recursive: true, force: true });
  });
});

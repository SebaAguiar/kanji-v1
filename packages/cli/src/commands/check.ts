import { Command } from 'commander';
import pc from 'picocolors';
import { join } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { fileExists, detectDatabaseFromAppModule } from '../utils/file-generator.js';
import { getDrizzleConfigTemplate } from '../templates/drizzle-config.js';
import { CheckResult } from '../types.js';

async function getFilesRecursively(dir: string): Promise<string[]> {
  if (!(await fileExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const res = join(dir, entry.name);
      return entry.isDirectory() ? getFilesRecursively(res) : [res];
    }),
  );
  return files.flat();
}

export function registerCheckCommand(program: Command) {
  program
    .command('check')
    .description('Validate project architecture and code conventions')
    .option('--fix', 'Automatically repair fixable violations', false)
    .action(async (options: { fix: boolean }) => {
      console.log(pc.cyan('🔍 Running Kanji project validation checks...\n'));

      const srcDir = join(process.cwd(), 'src');
      if (!(await fileExists(srcDir))) {
        console.error(pc.red('Error: "src/" directory not found. Please run this command from the root of a Kanji project.'));
        process.exit(1);
      }

      const results: CheckResult[] = [];
      const allFiles = await getFilesRecursively(srcDir);
      const tsFiles = allFiles.filter((f) => f.endsWith('.ts'));

      // Rule 1-4: Class Decorators Validation
      for (const file of tsFiles) {
        const relativePath = file.substring(process.cwd().length + 1);
        try {
          const content = await readFile(file, 'utf-8');

          if (file.endsWith('.module.ts')) {
            if (!/@KanjijsModule\s*\(/s.test(content)) {
              results.push({
                status: 'fail',
                category: 'Architecture',
                message: `Module file "${relativePath}" is missing the @KanjijsModule decorator`,
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Architecture',
                message: `Module "${relativePath}" has @KanjijsModule decorator`,
              });
            }
          }

          if (file.endsWith('.controller.ts')) {
            if (!/@Controller\s*\(/s.test(content)) {
              results.push({
                status: 'fail',
                category: 'Architecture',
                message: `Controller file "${relativePath}" is missing the @Controller decorator`,
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Architecture',
                message: `Controller "${relativePath}" has @Controller decorator`,
              });
            }
          }

          if (file.endsWith('.service.ts')) {
            if (!/@Injectable\s*\(/s.test(content)) {
              results.push({
                status: 'fail',
                category: 'Architecture',
                message: `Service file "${relativePath}" is missing the @Injectable decorator`,
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Architecture',
                message: `Service "${relativePath}" has @Injectable decorator`,
              });
            }
          }

          if (file.endsWith('.repository.ts')) {
            if (!/@Repository\s*\(/s.test(content)) {
              results.push({
                status: 'fail',
                category: 'Architecture',
                message: `Repository file "${relativePath}" is missing the @Repository decorator`,
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Architecture',
                message: `Repository "${relativePath}" has @Repository decorator`,
              });
            }
          }
        } catch {
          // Ignore read errors
        }
      }

      // Rule 5: Providers match classes in modules
      for (const file of tsFiles) {
        if (file.endsWith('.module.ts')) {
          const relativePath = file.substring(process.cwd().length + 1);
          try {
            const content = await readFile(file, 'utf-8');
            const providersMatch = content.match(/providers\s*:\s*\[([\s\S]*?)\]/);
            if (providersMatch) {
              const providersRaw = providersMatch[1];
              const providers = providersRaw
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p.length > 0 && !p.startsWith('//') && !p.startsWith('/*'));

              for (const provider of providers) {
                // simple check: see if the provider class name is imported or declared in the module file
                const classRegex = new RegExp(`\\b(class|import)\\b.*\\b${provider}\\b`, 's');
                if (!classRegex.test(content)) {
                  results.push({
                    status: 'fail',
                    category: 'DI Container',
                    message: `Module "${relativePath}" lists provider "${provider}" but it is not imported or declared in the file`,
                  });
                } else {
                  results.push({
                    status: 'pass',
                    category: 'DI Container',
                    message: `Provider "${provider}" is resolved in "${relativePath}"`,
                  });
                }
              }
            }
          } catch {
            // Ignore module read errors
          }
        }
      }

      // Rule 6 & 7: StoreModule and AuthModule configuration in app.module.ts
      const appModulePath = join(srcDir, 'app.module.ts');
      let appModuleContent = '';
      if (await fileExists(appModulePath)) {
        try {
          appModuleContent = await readFile(appModulePath, 'utf-8');

          if (appModuleContent.includes('StoreModule.forRoot(')) {
            // simple validation that forRoot receives type and connectionString
            const hasType = /type\s*:/s.test(appModuleContent);
            const hasConn = /connectionString\s*:/s.test(appModuleContent);
            if (!hasType || !hasConn) {
              results.push({
                status: 'warn',
                category: 'Configuration',
                message: 'StoreModule.forRoot() might be missing "type" or "connectionString" parameters',
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Configuration',
                message: 'StoreModule.forRoot() configuration check passed',
              });
            }
          }

          if (appModuleContent.includes('AuthModule.forRoot(')) {
            const hasJwt = /jwtSecret\s*:/s.test(appModuleContent);
            if (!hasJwt) {
              results.push({
                status: 'fail',
                category: 'Configuration',
                message: 'AuthModule.forRoot() is missing "jwtSecret" configuration parameter',
              });
            } else {
              results.push({
                status: 'pass',
                category: 'Configuration',
                message: 'AuthModule.forRoot() configuration check passed',
              });
            }
          }
        } catch {
          // Ignore
        }
      }

      // Rule 8: If DB=postgres, check drizzle.config.ts
      const detectedDb = await detectDatabaseFromAppModule();
      if (detectedDb === 'postgres') {
        const drizzleConfigPath = join(process.cwd(), 'drizzle.config.ts');
        if (!(await fileExists(drizzleConfigPath))) {
          if (options.fix) {
            try {
              await writeFile(drizzleConfigPath, getDrizzleConfigTemplate(), 'utf-8');
              results.push({
                status: 'pass',
                category: 'Database',
                message: 'drizzle.config.ts was missing and has been auto-fixed! 🛠️',
              });
            } catch (err) {
              results.push({
                status: 'fail',
                category: 'Database',
                message: `drizzle.config.ts is missing and auto-fix failed: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          } else {
            results.push({
              status: 'fail',
              category: 'Database',
              message: 'drizzle.config.ts is missing for PostgreSQL adapter (fixable)',
              fixable: true,
            });
          }
        } else {
          results.push({
            status: 'pass',
            category: 'Database',
            message: 'drizzle.config.ts is present',
          });
        }
      }

      // Rule 9: If auth active, exists src/auth/
      if (appModuleContent.includes('AuthModule')) {
        const authDir = join(srcDir, 'auth');
        if (!(await fileExists(authDir))) {
          results.push({
            status: 'warn',
            category: 'Architecture',
            message: 'AuthModule is imported in app.module.ts but the "src/auth" folder does not exist',
          });
        } else {
          results.push({
            status: 'pass',
            category: 'Architecture',
            message: 'AuthModule directory is present',
          });
        }
      }

      // Rule 10: env('KEY') has entry in .env
      const envVariables = new Set<string>();
      for (const file of tsFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const envMatches = content.matchAll(/\bprocess\.env\.([A-Za-z0-9_]+)\b/g);
          for (const match of envMatches) {
            envVariables.add(match[1]);
          }
        } catch {
          // Ignore
        }
      }

      if (envVariables.size > 0) {
        const envPath = join(process.cwd(), '.env');
        let envContent = '';
        if (await fileExists(envPath)) {
          try {
            envContent = await readFile(envPath, 'utf-8');
          } catch {
            // Ignore
          }
        }

        const parsedEnvKeys = new Set<string>();
        const lines = envContent.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
          if (match) {
            parsedEnvKeys.add(match[1]);
          }
        }

        let envUpdated = false;
        let activeEnvContent = envContent;

        for (const variable of envVariables) {
          if (!parsedEnvKeys.has(variable)) {
            if (options.fix) {
              try {
                activeEnvContent += `\n${variable}=`;
                envUpdated = true;
                results.push({
                  status: 'pass',
                  category: 'Environment',
                  message: `Environment variable "${variable}" was missing in .env and has been auto-fixed! 🛠️`,
                });
              } catch {
                results.push({
                  status: 'fail',
                  category: 'Environment',
                  message: `Environment variable "${variable}" is missing in .env`,
                });
              }
            } else {
              results.push({
                status: 'fail',
                category: 'Environment',
                message: `Environment variable "${variable}" is missing in .env (fixable)`,
                fixable: true,
              });
            }
          } else {
            results.push({
              status: 'pass',
              category: 'Environment',
              message: `Environment variable "${variable}" is defined in .env`,
            });
          }
        }

        if (envUpdated) {
          try {
            await writeFile(envPath, activeEnvContent, 'utf-8');
          } catch (err) {
            console.error(pc.red(`Failed to write to .env file: ${err instanceof Error ? err.message : String(err)}`));
          }
        }
      }

      // Output Results
      let passedCount = 0;
      let warnCount = 0;
      let failCount = 0;
      let fixableCount = 0;

      for (const res of results) {
        if (res.status === 'pass') {
          passedCount++;
          console.log(`${pc.green('[PASS]')} ${pc.bold(res.category)}: ${res.message}`);
        } else if (res.status === 'warn') {
          warnCount++;
          console.log(`${pc.yellow('[WARN]')} ${pc.bold(res.category)}: ${res.message}`);
        } else {
          failCount++;
          if (res.fixable) fixableCount++;
          console.log(`${pc.red('[FAIL]')} ${pc.bold(res.category)}: ${res.message}`);
        }
      }

      console.log(pc.bold('\nSummary:'));
      console.log(pc.green(`  - Passed: ${passedCount}`));
      console.log(pc.yellow(`  - Warnings: ${warnCount}`));
      console.log(pc.red(`  - Failures: ${failCount} (${fixableCount} fixable)`));

      if (failCount > 0) {
        if (fixableCount > 0 && !options.fix) {
          console.log(pc.yellow(`\nRun "kanji check --fix" to automatically repair fixable issues.`));
        }
        process.exit(1);
      } else {
        console.log(pc.bold(pc.green('\nAll architecture checks passed successfully! 🎉')));
        process.exit(0);
      }
    });
}

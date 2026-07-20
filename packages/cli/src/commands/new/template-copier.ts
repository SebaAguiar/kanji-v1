import { join } from 'path';
import { mkdir, writeFile, readdir, readFile, stat } from 'fs/promises';
import { getTsConfigTemplate } from '../../templates/project.js';

export async function copyTemplate(srcDir: string, destDir: string, version: string): Promise<void> {
  const entries = await readdir(srcDir);

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.env') {
      continue;
    }

    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const s = await stat(srcPath);

    if (s.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, version);
    } else {
      if (entry === 'package.json') {
        const content = await readFile(srcPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Rename package to match target app name
        pkg.name = destDir.split('/').pop() || pkg.name;

        const updateDeps = (deps?: Record<string, string>) => {
          if (!deps) return;
          for (const key of Object.keys(deps)) {
            if (key.startsWith('@kanjijs/') && deps[key] === 'workspace:*') {
              deps[key] = `^${version}`;
            }
          }
        };

        updateDeps(pkg.dependencies);
        updateDeps(pkg.devDependencies);
        updateDeps(pkg.peerDependencies);

        await writeFile(destPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      } else if (entry === 'tsconfig.json') {
        const tsconfig = getTsConfigTemplate();
        await writeFile(destPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
      } else if (entry === '.env.example') {
        const content = await readFile(srcPath, 'utf-8');
        await writeFile(destPath, content, 'utf-8');
        // Also write active .env
        await writeFile(join(destDir, '.env'), content, 'utf-8');
      } else {
        const content = await readFile(srcPath);
        await writeFile(destPath, content);
      }
    }
  }
}

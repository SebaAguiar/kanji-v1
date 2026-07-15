import { stat, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import pc from 'picocolors';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectDatabaseFromAppModule(): Promise<'postgres' | 'mongodb' | null> {
  const appModulePath = join(process.cwd(), 'src', 'app.module.ts');
  if (await fileExists(appModulePath)) {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(appModulePath, 'utf-8');
      if (content.includes("type: 'postgres'") || content.includes('type: "postgres"')) {
        return 'postgres';
      }
      if (content.includes("type: 'mongodb'") || content.includes('type: "mongodb"')) {
        return 'mongodb';
      }
    } catch {
      // Ignore read errors
    }
  }
  return null;
}

export async function generateFiles(
  targetDir: string,
  files: { path: string; content: string }[],
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force) {
    for (const file of files) {
      const filePath = join(targetDir, file.path);
      if (await fileExists(filePath)) {
        const relativePart = targetDir.includes('/src/') 
          ? targetDir.split('/src/').pop() 
          : targetDir.split('/').pop();
        throw new Error(`File already exists: src/${relativePart}/${file.path}.`);
      }
    }
  }

  await mkdir(targetDir, { recursive: true });
  for (const file of files) {
    const filePath = join(targetDir, file.path);
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash !== -1) {
      const fileDir = filePath.substring(0, lastSlash);
      await mkdir(fileDir, { recursive: true });
    }
    await writeFile(filePath, file.content, 'utf-8');
    const relativePart = targetDir.includes('/src/') 
      ? targetDir.split('/src/').pop() 
      : targetDir.split('/').pop();
    console.log(pc.green(`  CREATED  src/${relativePart}/${file.path}`));
  }
}

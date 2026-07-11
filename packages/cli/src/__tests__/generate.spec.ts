import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtemp, rm, readdir, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI Generate Command', () => {
  let tmpProjectDir: string;
  const cliPath = join(__dirname, '../cli.ts');

  beforeAll(async () => {
    // Create a temporary project workspace in system temp folder
    tmpProjectDir = await mkdtemp(join(tmpdir(), 'kanji-cli-test-'));
  });

  afterAll(async () => {
    // Cleanup generated files
    await rm(tmpProjectDir, { recursive: true, force: true });
  });

  it('should scaffold a complete resource structure inside src/ folder', async () => {
    // Run "bun run <cliPath> g resource products" inside our temporary workspace directory
    execSync(`bun ${cliPath} g resource products`, {
      cwd: tmpProjectDir,
      stdio: 'pipe',
    });

    const targetDir = join(tmpProjectDir, 'src', 'products');
    const files = await readdir(targetDir);

    expect(files).toContain('product.contracts.ts');
    expect(files).toContain('product.repository.ts');
    expect(files).toContain('product.service.ts');
    expect(files).toContain('product.controller.ts');
    expect(files).toContain('product.module.ts');
    expect(files).toContain('index.ts');

    // Verify __tests__ directory exists and contains spec
    const testFiles = await readdir(join(targetDir, '__tests__'));
    expect(testFiles).toContain('product.controller.spec.ts');

    // Read generated files to verify Repository pattern content
    const repositoryContent = await Bun.file(join(targetDir, 'product.repository.ts')).text();
    expect(repositoryContent).toContain('@Repository()');
    expect(repositoryContent).toContain('class ProductRepository');
    expect(repositoryContent).toContain('DATABASE_CLIENT');

    const serviceContent = await Bun.file(join(targetDir, 'product.service.ts')).text();
    expect(serviceContent).toContain('ProductRepository');
    expect(serviceContent).not.toContain('DATABASE_CLIENT');

    // Verify it fails if we try to generate it again without --force flag
    expect(() => {
      execSync(`bun ${cliPath} g resource products`, {
        cwd: tmpProjectDir,
        stdio: 'pipe',
      });
    }).toThrow();

    // Verify it succeeds if we generate with --force flag
    const res = execSync(`bun ${cliPath} g resource products --force`, {
      cwd: tmpProjectDir,
      stdio: 'pipe',
    }).toString();
    expect(res).toContain('Resource "products" successfully generated');
  });

  it('should only log changes without writing to disk during a dry run', async () => {
    const dryRunWorkspace = await mkdtemp(join(tmpdir(), 'kanji-cli-dryrun-'));
    
    const output = execSync(`bun ${cliPath} g resource users --dry-run`, {
      cwd: dryRunWorkspace,
      stdio: 'pipe',
    }).toString();

    expect(output).toContain('DRY RUN');
    expect(output).toContain('Would create: src/users/user.contracts.ts');

    // Verify src directory was not actually created
    let srcFolderExists = true;
    try {
      await stat(join(dryRunWorkspace, 'src'));
    } catch {
      srcFolderExists = false;
    }

    expect(srcFolderExists).toBe(false);

    await rm(dryRunWorkspace, { recursive: true, force: true });
  });

  it('should auto-register a standalone module in app.module.ts', async () => {
    const moduleWorkspace = await mkdtemp(join(tmpdir(), 'kanji-cli-mod-'));
    await mkdir(join(moduleWorkspace, 'src'), { recursive: true });
    
    const initialAppModule = `import { KanjijsModule } from '@kanjijs/core';
import { StoreModule } from '@kanjijs/store';

@KanjijsModule({
  imports: [
    StoreModule.forRoot({
      type: 'postgres',
    }),
  ],
})
export class AppModule {}
`;
    const appModulePath = join(moduleWorkspace, 'src', 'app.module.ts');
    await Bun.write(appModulePath, initialAppModule);

    execSync(`bun ${cliPath} g module categories`, {
      cwd: moduleWorkspace,
      stdio: 'pipe',
    });

    const updatedAppModule = await Bun.file(appModulePath).text();
    expect(updatedAppModule).toContain("import { CategoryModule } from './categories/category.module.js';");
    expect(updatedAppModule).toContain("CategoryModule");

    await rm(moduleWorkspace, { recursive: true, force: true });
  });

  it('should auto-register a standalone controller in an existing local module', async () => {
    const controllerWorkspace = await mkdtemp(join(tmpdir(), 'kanji-cli-ctrl-'));
    await mkdir(join(controllerWorkspace, 'src'), { recursive: true });
    
    execSync(`bun ${cliPath} g module orders`, {
      cwd: controllerWorkspace,
      stdio: 'pipe',
    });

    execSync(`bun ${cliPath} g controller orders`, {
      cwd: controllerWorkspace,
      stdio: 'pipe',
    });

    const localModulePath = join(controllerWorkspace, 'src', 'orders', 'order.module.ts');
    const localModuleContent = await Bun.file(localModulePath).text();

    expect(localModuleContent).toContain("import { OrderController } from './order.controller.js';");
    expect(localModuleContent).toContain("OrderController");

    const indexContent = await Bun.file(join(controllerWorkspace, 'src', 'orders', 'index.ts')).text();
    expect(indexContent).toContain("export * from './order.controller.js';");

    await rm(controllerWorkspace, { recursive: true, force: true });
  });

  it('should auto-register a standalone service in an existing local module and export it', async () => {
    const serviceWorkspace = await mkdtemp(join(tmpdir(), 'kanji-cli-svc-'));
    await mkdir(join(serviceWorkspace, 'src'), { recursive: true });

    execSync(`bun ${cliPath} g module inventory`, {
      cwd: serviceWorkspace,
      stdio: 'pipe',
    });

    execSync(`bun ${cliPath} g service inventory`, {
      cwd: serviceWorkspace,
      stdio: 'pipe',
    });

    const localModulePath = join(serviceWorkspace, 'src', 'inventory', 'inventory.module.ts');
    const localModuleContent = await Bun.file(localModulePath).text();

    expect(localModuleContent).toContain("import { InventoryService } from './inventory.service.js';");
    expect(localModuleContent).toContain("InventoryService");

    await rm(serviceWorkspace, { recursive: true, force: true });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI env:check Command', () => {
  let tmpProjectDir: string;
  const isDist = __dirname.includes('dist');
  const cliPath = join(__dirname, isDist ? '../cli.js' : '../cli.ts');

  beforeAll(async () => {
    // Crear directorio temporal para el proyecto de prueba
    tmpProjectDir = await mkdtemp(join(tmpdir(), 'kanji-env-test-'));

    // Crear la carpeta node_modules y node_modules/@kanjijs
    const targetNodeModules = join(tmpProjectDir, 'node_modules');
    await mkdir(targetNodeModules, { recursive: true });

    const targetKanjijsDir = join(targetNodeModules, '@kanjijs');
    await mkdir(targetKanjijsDir, { recursive: true });

    // Linkear zod para resolver la dependencia del test
    await symlink(
      join(process.cwd(), 'node_modules', 'zod'),
      join(targetNodeModules, 'zod'),
      'dir',
    );

    // Linkear @kanjijs/common de forma absoluta para evitar rutas relativas de pnpm rotas
    await symlink(
      join(process.cwd(), 'packages', 'common'),
      join(targetKanjijsDir, 'common'),
      'dir',
    );

    // Crear la estructura de directorios básica
    await mkdir(join(tmpProjectDir, 'src'), { recursive: true });
  });

  afterAll(async () => {
    // Limpiar archivos temporales
    await rm(tmpProjectDir, { recursive: true, force: true });
  });

  it('should generate .env.example with correct variables and defaults', async () => {
    const mainContent = `
      import { env } from '@kanjijs/common';
      import { z } from 'zod';

      env('PORT', z.coerce.number().default(3000).describe('Puerto de escucha de la app'));
      env('JWT_SECRET', z.string().min(32).describe('Clave secreta para firmar tokens JWT'));
      env('OPTIONAL_VAR', z.string().optional());
    `;

    await writeFile(join(tmpProjectDir, 'src', 'main.ts'), mainContent, 'utf-8');

    // Ejecutar el comando para generar el archivo .env.example
    execSync(`bun ${cliPath} env:check --example`, {
      cwd: tmpProjectDir,
      stdio: 'pipe',
    });

    const examplePath = join(tmpProjectDir, '.env.example');
    const exampleContent = await Bun.file(examplePath).text();

    expect(exampleContent).toContain('PORT=3000');
    expect(exampleContent).toContain('Puerto de escucha de la app');
    expect(exampleContent).toContain('JWT_SECRET=');
    expect(exampleContent).toContain('Clave secreta para firmar tokens JWT');
    expect(exampleContent).toContain('OPTIONAL_VAR=');
  });

  it('should validate environment variables and report correct status', async () => {
    const mainContent = `
      import { env } from '@kanjijs/common';
      import { z } from 'zod';

      env('PORT', z.coerce.number().default(3000).describe('Puerto de escucha de la app'));
      env('JWT_SECRET', z.string().min(32).describe('Clave secreta para firmar tokens JWT'));
      env('OPTIONAL_VAR', z.string().optional());
    `;

    await writeFile(join(tmpProjectDir, 'src', 'main.ts'), mainContent, 'utf-8');

    // Probar validación fallida debido a que falta la variable requerida JWT_SECRET
    try {
      const testEnv = { ...process.env, PORT: '8080' } as Record<string, string | undefined>;
      delete testEnv.JWT_SECRET;

      execSync(`bun ${cliPath} env:check`, {
        cwd: tmpProjectDir,
        env: testEnv,
        stdio: 'pipe',
      });
      // No debería llegar aquí
      expect(true).toBe(false);
    } catch (error: any) {
      const output =
        String(error.stdout || '') + String(error.stderr || '') + String(error.message || '');
      expect(output).toContain('❌ JWT_SECRET (requerido - ausente)');
      expect(output).toContain('⚠️ OPTIONAL_VAR (opcional - ausente)');
      expect(output).toContain('✅ PORT');
      expect(error.status).toBe(1);
    }

    // Probar validación fallida debido a valor inválido (JWT_SECRET muy corto, menor a 32 chars)
    try {
      execSync(`bun ${cliPath} env:check`, {
        cwd: tmpProjectDir,
        env: {
          ...process.env,
          PORT: '8080',
          JWT_SECRET: 'short-secret',
        },
        stdio: 'pipe',
      });
      // No debería llegar aquí
      expect(true).toBe(false);
    } catch (error: any) {
      const output =
        String(error.stdout || '') + String(error.stderr || '') + String(error.message || '');
      expect(output).toContain('❌ JWT_SECRET: Valor inválido');
      expect(error.status).toBe(1);
    }

    // Probar validación exitosa con todos los valores correctos
    const successRes = execSync(`bun ${cliPath} env:check`, {
      cwd: tmpProjectDir,
      env: {
        ...process.env,
        PORT: '3000',
        JWT_SECRET: 'super-secret-key-that-is-at-least-32-characters-long',
      },
      stdio: 'pipe',
    });

    const successOutput = successRes.toString();
    expect(successOutput).toContain('✅ PORT');
    expect(successOutput).toContain('✅ JWT_SECRET');
    expect(successOutput).toContain('Validación exitosa');
  });

  it('should audit raw process.env accesses and fail if found', async () => {
    // Escribir un archivo src/insecure.ts que acceda directamente a process.env
    const insecureContent = `
      // Comentario permitido process.env.COMMENT
      const key = process.env.INSECURE_SECRET;
    `;
    const insecureFile = join(tmpProjectDir, 'src', 'insecure.ts');
    await writeFile(insecureFile, insecureContent, 'utf-8');

    try {
      execSync(`bun ${cliPath} env:check --audit`, {
        cwd: tmpProjectDir,
        stdio: 'pipe',
      });
      // No debería llegar aquí
      expect(true).toBe(false);
    } catch (error: any) {
      const output =
        String(error.stdout || '') + String(error.stderr || '') + String(error.message || '');
      expect(output).toContain('❌ Acceso inseguro directo detectado');
      expect(output).toContain('process.env.INSECURE_SECRET');
      expect(error.status).toBe(1);
    }

    // Eliminar el archivo inseguro
    await rm(insecureFile, { force: true });

    // La auditoría debería pasar ahora
    const auditRes = execSync(`bun ${cliPath} env:check --audit`, {
      cwd: tmpProjectDir,
      stdio: 'pipe',
    });
    expect(auditRes.toString()).toContain('Auditoría exitosa');
  });
});

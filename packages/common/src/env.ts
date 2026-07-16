import { z } from 'zod';

type EnvValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, string | number | boolean | null | undefined>;

const cache = new Map<string, EnvValue>();

const schemas = new Map<string, z.ZodTypeAny>();
const errors: string[] = [];

export function env<T extends z.ZodTypeAny>(key: string, schema: T): z.infer<T> {
  // Register schema for .env.example autogeneration
  schemas.set(key, schema);

  if (cache.has(key)) {
    return cache.get(key) as z.infer<T>;
  }

  const result = schema.safeParse(process.env[key]);
  if (!result.success) {
    errors.push(`${key}: ${result.error.issues.map((i) => i.message).join(', ')}`);
    return undefined as z.infer<T>;
  }

  cache.set(key, result.data as EnvValue);
  return result.data;
}

export function assertEnvValid(): void {
  if (errors.length > 0) {
    throw new Error(`❌ Invalid environment:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

// Expose schemas map for CLI or developer tools
export function getRegisteredEnvs(): Map<string, z.ZodTypeAny> {
  return schemas;
}

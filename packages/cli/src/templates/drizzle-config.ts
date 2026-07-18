export function getDrizzleConfigTemplate(): string {
  return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kanji_db',
  },
  verbose: true,
  strict: true,
});
`;
}

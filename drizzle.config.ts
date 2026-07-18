import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './examples/basic/src/users/users.schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kanji_dev',
  },
  verbose: true,
  strict: true,
});

# Kanji SaaS Starter Example

This is a complete, production-ready SaaS starter project built with **Kanji Framework**. It demonstrates:
- Multi-Database / PostgreSQL Integration with Drizzle ORM.
- JWT Authentication & User Session Management.
- Multi-Tenancy Isolation via Organization context.
- Fine-grained Access Control (ACL) using Resource Policies.
- OpenAPI specification generation & TypeScript SDK auto-generation.
- E2E testing using Bun Test and `@kanjijs/testing`.

## Setup

1. Install dependencies from the project root:
   ```bash
   pnpm install
   ```

2. Start the database containers:
   ```bash
   cd examples/saas-starter
   docker compose up -d
   ```

3. Run development server:
   ```bash
   bun run dev
   ```

4. Run tests:
   ```bash
   bun test
   ```

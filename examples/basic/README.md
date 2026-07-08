# Kanji Example Sandbox (basic)

This is a sandbox integration application verifying the **Kanji Framework active development version** (`workspace:*`).

## Target Features Under Test
- **Modular DI system**: Compiles modules, binds providers, resolves constructor parameters.
- **Contract-first request validation**: Enforces Zod validations using Hono middleware.
- **Hono framework routing**: Maps controllers and routing annotations dynamically.
- **Unified database adapter**: Resolves transactions and operations on `PostgresDatabase` mapping configurations.

## Setup & Running

1. **Compile all packages** in the monorepo root:
   ```bash
   pnpm -r build
   ```

2. **Configure Database**:
   Make sure you have Docker installed and run:
   ```bash
   docker compose up -d
   ```
   This will spin up a PostgreSQL instance on port `5432` with username `postgres`, password `postgres`, and database `kanji_test`.

3. **Set environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server**:
   ```bash
   bun run dev
   ```

5. **Verify Endpoints**:
   - `GET http://localhost:3000/users` - Fetches all users.
   - `POST http://localhost:3000/users` - Creates a new user.
     - Payload:
       ```json
       {
         "name": "Alice",
         "email": "alice@gmail.com"
       }
       ```

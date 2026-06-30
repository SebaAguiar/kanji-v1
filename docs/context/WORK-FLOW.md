# Work Flow Reference

This document outlines the workflow for implementing changes, the Definition of Done (DoD) checklist, and building/deploying Kanji Framework.

---

## 1. Steps to Implement a Change

1. **Verify Sandbox Status:** Run `git status` and `git diff` before editing to ensure there are no uncommitted or unexpected modifications.

2. **Define Contracts First:** If adding a new API endpoint, write the Zod contract schemas first. Contracts define the request (body, query, params) and response (status codes + shapes). Types flow from contracts → validation → OpenAPI → SDK.

3. **Module Wiring:**
   - Add the new module to the appropriate package or example app.
   - Declare `controllers`, `providers`, and `exports` explicitly.
   - Import any dependent modules.

4. **Service Implementation:**
   - Add business logic in a service class decorated with `@Injectable()`.
   - Inject dependencies via constructor.
   - Keep controllers thin — they only parse input, call services, return responses.

5. **Controller & Routes:**
   - Add a controller decorated with `@Controller('/path')`.
   - Use `@Get()`, `@Post()`, `@Put()`, `@Delete()` for route handlers.
   - Apply `@Contract()` for validation and `@UseGuards()` for auth.

6. **Database Migrations (if applicable):**
   - Generate a migration with `drizzle-kit generate`.
   - Review the generated SQL before applying.
   - Run `kanji migrate` to apply.

7. **Tests:** Run the test suite:
   ```bash
   # All tests
   bun test

   # Specific package
   bun test --filter @kanjijs/core

   # With coverage
   bun test --coverage
   ```

8. **Local Verification:** Run the example app and test the endpoint:
   ```bash
   cd examples/basic
   bun run dev
   curl http://localhost:3000/health
   ```

9. **Regenerate OpenAPI & SDK (if contracts changed):**
   ```bash
   kanji openapi:generate
   kanji sdk:generate --output ../frontend/src/api.ts
   ```

---

## 2. Definition of Done (DoD) Checklist

- [ ] Contracts are defined with Zod schemas (request body, query, params, response).
- [ ] All inputs are validated through the contract middleware (no manual validation in handlers).
- [ ] Auth middleware is applied to protected routes (`@UseGuards(AuthGuard)`).
- [ ] No `any` types in source files — all types are explicit.
- [ ] Services are injectable and tested in isolation.
- [ ] Database migrations are generated (if schema changed).
- [ ] Tests pass for the affected package (`bun test`).
- [ ] App compiles without TypeScript errors (`bun run check` or `tsc --noEmit`).
- [ ] Commit message is written in English following Conventional Commits (e.g., `feat(core): add dynamic module support`).

---

## 3. Build / Publish Phase

### 3.1 Building Packages

```bash
# Build all packages
bun run build

# Build specific package
bun run build --filter @kanjijs/core

# Watch mode (development)
bun run dev
```

### 3.2 Publishing to npm

```bash
# 1. Update version
bun run version patch  # or minor, major

# 2. Update CHANGELOG.md
# Document all changes since last release

# 3. Commit and tag
git add .
git commit -m "chore: release v1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0"

# 4. Push
git push origin main --tags

# 5. Publish
npm publish --workspaces
# Or with pnpm:
pnpm publish --filter "@kanjijs/*"
```

### 3.3 Release Checklist

- [ ] All tests pass (`bun test`)
- [ ] All packages build successfully (`bun run build`)
- [ ] Changelog is updated
- [ ] Version is bumped in all `package.json` files
- [ ] Tags are pushed to GitHub
- [ ] Packages are published to npm
- [ ] GitHub Release is created

# Contributing to Kanji Framework

First off, thanks for taking the time to contribute. Kanji is a community-driven
project and every contribution — bug report, feature request, PR, or docs
improvement — is welcome.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

Be respectful, constructive, and assume good faith. Harassment, trolling, and
personal attacks are not tolerated.

---

## Getting Started

```bash
# 1. Fork the repository
# 2. Clone your fork
git clone https://github.com/your-username/kanji.git
cd kanji

# 3. Install dependencies
npm install -g pnpm
pnpm install

# 4. Run tests to verify everything works
pnpm test
```

---

## Development Workflow

### Branch naming

```
feature/   → New feature   (feature/openapi-generator)
bugfix/    → Bug fix       (bugfix/auth-middleware-crash)
docs/      → Documentation (docs/architecture)
chore/     → Maintenance   (chore/update-dependencies)
refactor/  → Refactoring   (refactor/di-container)
```

### 1. Create a branch

```bash
git checkout -b feature/my-feature
```

### 2. Make changes

Work on the relevant package:

```bash
cd packages/core
```

### 3. Run package-level tests

```bash
bun test          # Run tests
bun run build     # Type-check
```

### 4. Run the full test suite

```bash
cd ../..
pnpm test         # All packages + examples
```

### 5. Commit and push

```bash
git add .
git commit -m "feat(core): add dynamic module forRoot pattern"
git push origin feature/my-feature
```

---

## Code Standards

### TypeScript

- **Strict mode required.** `tsconfig.json` has `strict: true`. No exceptions.
- **No `any` or `unknown`.** Use concrete types everywhere. `any` breaks
  the end-to-end type guarantee that Kanji provides from contract to SDK.
- **Decorators allowed.** `experimentalDecorators` and `emitDecoratorMetadata`
  are enabled. Use `@Injectable()`, `@Controller()`, etc.
- **ESM only.** All imports/exports use the `.js` extension for NodeNext
  module resolution: `import { X } from './file.js'`.

### Project structure

```
packages/<name>/
├── src/
│   ├── index.ts           # Barrel export
│   ├── *.ts               # Implementation
│   ├── decorators/        # Decorators (if applicable)
│   ├── middleware/         # Middleware (if applicable)
│   └── __tests__/         # Tests
├── package.json
└── tsconfig.json
```

### Tests

- Use `bun test` (not Jest, not Vitest).
- Test files go in `src/__tests__/` with `.spec.ts` extension.
- Prefer integration tests over unit tests for HTTP/DI/DB code.
- Keep test files close to the source they test.

### Imports

```typescript
// ✅ Good
import { Injectable } from '@kanjijs/core';
import { KANJI_CTX } from '@kanjijs/platform-hono';
import { createMockDatabase } from '@kanjijs/testing';
import { z } from 'zod';

// ✅ Good — relative with .js extension
import { Container } from './container.js';
import { type User } from './types.js';
```

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UsersController` |
| Functions | camelCase | `getUserById()` |
| Constants | UPPER_SNAKE_CASE | `DATABASE_CLIENT` |
| Files | kebab-case | `users.controller.ts` |
| Directories | lowercase | `users/` |

---

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <imperative description, no period>

[optional body: explain why, not what]

[optional footer]
```

### Types

| Type     | When to use                   |
|----------|-------------------------------|
| `feat`   | New feature                   |
| `fix`    | Bug fix                       |
| `perf`   | Performance improvement       |
| `refactor` | Internal change, no behavior change |
| `test`   | Adding/modifying tests        |
| `docs`   | Documentation only            |
| `chore`  | Maintenance                   |
| `build`  | Build system or dependencies  |

### Scopes

| Scope           | Package               |
|-----------------|-----------------------|
| `core`          | `@kanjijs/core`       |
| `platform-hono` | `@kanjijs/platform-hono` |
| `contracts`     | `@kanjijs/contracts`  |
| `openapi`       | `@kanjijs/openapi`    |
| `store`         | `@kanjijs/store`      |
| `auth`          | `@kanjijs/auth`       |
| `testing`       | `@kanjijs/testing`    |
| `cli`           | `@kanjijs/cli`        |
| `common`        | `@kanjijs/common`     |
| `offline`       | `@kanjijs/offline`    |

### Examples

```
feat(core): implement dynamic module forRoot pattern
fix(auth): handle expired JWT tokens gracefully
docs: add authentication guide
test(openapi): add controller spec for /api/openapi.json
```

---

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Run `pnpm test` — all tests must pass.
3. Run `pnpm lint` — no lint errors.
4. Fill out the PR template with:
   - **Description** — what does this PR do?
   - **Changes** — bullet list of changes.
   - **Tests** — check what was added/modified.
   - **Type of change** — mark what applies.
5. Request review from a maintainer.
6. Address any feedback.

---

## Reporting Bugs

Open an issue using the **Bug Report** template. Include:

- Kanji version and Bun version (`bun --version`)
- Expected behavior
- Actual behavior
- Minimal reproduction (code snippet or repo)
- Error message and stack trace

---

## Feature Requests

Open an issue using the **Feature Request** template. Include:

- What problem does this solve?
- How would the API look? (pseudocode helps)
- Is this a breaking change?

---

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.

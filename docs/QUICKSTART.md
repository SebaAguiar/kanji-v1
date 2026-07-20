# Kanji Quickstart Guide

Get up and running with Kanji Framework in less than 5 minutes.

---

## 1. Installation

Create a new Kanji project from scratch using Bun and our interactive CLI:

```bash
bunx create-kanji@latest my-app
```

Or install the Kanji CLI globally to use the binary directly:

```bash
bun add -g @kanjijs/cli
kanji new my-app
```

---

## 2. Project Directory Structure

A default Kanji project contains a structured monorepo or modular design:

```
my-app/
├── src/
│   ├── database/
│   │   └── schema.ts          # Drizzle tables
│   ├── users/
│   │   ├── users.contracts.ts # API validation schemas
│   │   ├── users.controller.ts# Route endpoints
│   │   ├── users.service.ts   # Business logic
│   │   └── users.module.ts    # Dependency declarations
│   ├── app.module.ts          # Application root module
│   └── main.ts                # Application entrypoint
├── bunfig.toml
├── package.json
└── tsconfig.json
```

---

## 3. Running in Development

Boot up the live reload developer server using Bun:

```bash
cd my-app
kanji dev
```

The application starts listening on `http://localhost:3000`. You can verify it works by calling the health endpoint:

```bash
curl http://localhost:3000/health
```

---

## 4. Scaffolding New Resources

Use the interactive generator wizard to add new modules, controllers, services, repositories, or full CRUD resources:

```bash
kanji generate resource products
```

This command automatically:
1. Creates contracts, controllers, services, and repository files.
2. Updates `app.module.ts` using AST parser to register the new module imports.
3. Sets up standard validated endpoints for list, findById, create, update, and delete.

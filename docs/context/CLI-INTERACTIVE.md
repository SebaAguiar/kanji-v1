# Interactive CLI Generator for Kanji

This document registers the specification, design decisions, scope, and roadmap for the interactive CLI scaffolding generator in Kanji Framework.

---

## 1. Objective
To significantly improve the developer experience (DX) by providing an **interactive setup wizard** that guides developers step-by-step through resource creation, module configurations, and authorization policies without needing to memorize complex command flags.

---

## 2. Rationale
Currently, developers generate resources using extensive flags:
```bash
kanji g resource users --crud --auth owner-based --db postgres --tests
```
It is easy to make typos, forget flags, or get confused about authorization types. 

By offering a simple interactive prompt:
```bash
kanji g resource
```
The CLI will display a user-friendly wizard using dropdowns, checkboxes, and autocomplete options, while maintaining full backward compatibility with traditional flags.

---

## 3. Scope & Features

### 3.1. Interactive Resource Generator (`kanji g resource`)
A conversational wizard asking for:
*   Resource name.
*   Whether to generate CRUD endpoints (Yes/No).
*   Which specific CRUD endpoints/actions to include.
*   Authorization model selection.
*   Database driver selection (Postgres/MongoDB).
*   Scaffold tests (Yes/No).
*   Scaffold API documentation (Yes/No).

#### Generated Artifacts
*   `src/{name}/{name}.module.ts`: Module with structured imports and providers.
*   `src/{name}/{name}.controller.ts`: Controller with endpoints and `@Authorize` decorators.
*   `src/{name}/{name}.service.ts`: Database transaction and business logic service.
*   `src/{name}/{name}.contracts.ts`: Zod schema contracts for input and output validation.
*   `src/{name}/{name}.policy.ts`: Authorization policies mapping specific roles/owners.
*   `tests/{name}/{name}.controller.spec.ts`: Controller integration and mock test suite.

---

### 3.2. Interactive Authorization Setup (`kanji g auth`)
Wizard to construct or expand the central security modules:
*   Define active authorization policies (Owner-based, Multi-tenant, Role-based, etc.).
*   Select existing resources from `src/` to protect.
*   Configure action permissions for each selected resource.
*   Opt-in for audit logging on denied access events.
*   Generate mock policy tests.

#### Generated Artifacts
*   `src/auth/policies/{resource}.policy.ts`: Prebuilt boilerplate policies.
*   `src/auth/auth.module.ts`: Registration list of active policies in the DI container.
*   `src/auth/auth.config.ts`: Configuration file (JWT secrets, session storage, caching settings).
*   `tests/auth/policies/{resource}.policy.spec.ts`: Spec file verifying policy rules.

---

### 3.3. Interactive Module Setup (`kanji g module`)
Scaffold custom utility or third-party client modules:
*   Define local dependency modules to import (scans directories automatically).
*   Select external service integrations (e.g., Stripe, PayPal, SendGrid).
*   Generate webhooks routes and handlers automatically.
*   Configure boilerplate error boundaries.

---

## 4. Implementation Specifications

### 4.1. CLI Tooling
*   **Prompt Library**: Use `prompts` or `enquirer` (lightweight, ~100KB footprint).
*   **Colors & UI**: Styled console outputs via `chalk`.
*   **Templates**: Leverage Handlebars templates inside `packages/cli/templates/` with enhanced logic gates for:
    *   Conditional `@Authorize` decorators in controllers.
    *   Dynamic code blocks in generated policies depending on the `authModel` (e.g., `owner`, `tenant`, etc.).

---

## 5. Roadmap

### Phase 1: MVP (v1.0)
- [ ] Add `prompts` package dependency to `packages/cli`.
- [ ] Implement interactive `kanji g resource` flow.
- [ ] Refactor Handlebars templates to support conditional authorization policy generation.
- [ ] Add post-generation help logs with "next steps".
- [ ] Write CLI integration tests verifying outputs.

### Phase 2: Authorization Modules (v1.1)
- [ ] Implement interactive `kanji g auth` flow.
- [ ] Build automatic resource scanning from directories under `src/`.
- [ ] Add central `auth.module.ts` generation.

### Phase 3: Module & Webhook Generators (v1.2)
- [ ] Implement interactive `kanji g module`.
- [ ] Add automated dependency resolution templates.
- [ ] Implement Stripe/SendGrid webhook templates.

---

## 6. Matrix of Decisions & Configuration

To control validation and output rules, a project configuration option will be supported in `kanji.config.ts`:

```typescript
// Example configuration format
export default {
  validation: {
    contractCompleteness: 'warn',
    contractConsistency: 'error',
  },
};
```

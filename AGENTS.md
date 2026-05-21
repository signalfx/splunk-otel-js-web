# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turbo monorepo for Splunk browser telemetry packages. Main code lives in `packages/web`, session replay code in `packages/session-recorder`, and build utilities in `packages/build-plugins`. Playwright e2e tests, pages, servers, and helpers live in `packages/integration-tests`. Shared helpers are in `tests`; consumers are in `examples`; docs, fixtures, and maintenance scripts are in `docs`, `html`, and `scripts`.

Do not edit generated outputs such as `dist`, `.turbo`, `playwright-report`, `test-results`, or `node_modules`.

## Build, Test, and Development Commands

Use `pnpm` from the repository root.

- `pnpm install`: install workspace dependencies.
- `pnpm run build`: build packages and run the root typecheck.
- `pnpm run dev`: start development tasks in watch mode.
- `pnpm run lint`: run ESLint, Prettier, and markdownlint checks.
- `pnpm run lint:fix`: apply automatic lint and formatting fixes.
- `pnpm run test:unit`: run Vitest unit tests once.
- `pnpm run test:e2e`: run Playwright integration tests.
- `pnpm run test`: run unit and e2e tasks.
- `pnpm run size-limit`: check bundle size limits.

For focused e2e work, run `cd packages/integration-tests && pnpm run test`.

## Coding Style & Naming Conventions

Code is TypeScript-first. Follow `eslint.config.mjs` and `.prettierrc.cjs`.

- Use tabs, single quotes, no semicolons, trailing commas, and a 120-character print width.
- Keep imports, exports, named imports, and object keys sorted.
- Use uppercase enum members.
- Preserve the Splunk Apache license header on source files where lint requires it.
- Prefer nearby package patterns over new abstractions.

## Testing Guidelines

Vitest is used for unit tests. Name unit tests `*.test.ts` and keep them near code under `src` or package `tests`. Playwright specs live under `packages/integration-tests/src/tests` and use `*.spec.ts`.

Run the smallest relevant test first, then `pnpm run test:unit` or `pnpm run test:e2e` before opening a PR.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits, for example `feat: enable otlp by default`, `chore(deps): bump next from 16.2.3 to 16.2.6`, and `chore(release): v3.0.0`.

PRs should target the latest `main`, describe the change and verification, link related issues, and stay easy to review. Add tests for behavior changes. Avoid sensitive data, internal identifiers, and unrelated formatting churn. Discuss large work in an issue first.

## Security & Configuration Tips

Follow `SECURITY.md` for vulnerability reporting. Do not commit secrets, customer data, local logs, reports, or machine-specific configuration. For releases, use the existing version and tag scripts instead of editing package versions by hand.

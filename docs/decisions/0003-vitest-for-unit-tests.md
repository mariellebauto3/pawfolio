# 0003. Vitest for frontend unit tests

- **Status:** accepted
- **Date:** 2026-10-01

## Context
FE-04 (API client and session) must have its error mapping unit-tested, and `frontend/` had no test runner.
`frontend-guidelines.md` §9 asks for the choice to be recorded here.

## Decision
Use **Vitest 4** (dev dependency) for `frontend/tests/unit/` and component-free `tests/integration/` tests.

- Runs TypeScript and the `@/` alias with no extra build setup (`vitest.config.mts`).
- Node environment by default; a test stubs the browser API it needs instead of loading a DOM for every test.
- Commands: `npm test` (once) and `npm run test:watch`.
- Vitest 5 needs `@types/node` 22+, while the app pins `@types/node` 20, so we stay on Vitest 4 until Node types are
  upgraded.

## Consequences
- Pure logic (error mapping, redirects, env parsing, mock router) is cheap to test; keep it in plain functions.
- Testing React components later needs `jsdom` (or `happy-dom`) and Testing Library. Add them with the first component
  test and update this record.
- End-to-end tests (`tests/e2e/`) still need their own tool (e.g. Playwright) and record.

# Architecture Decision Records

Short records of decisions that shape the project. File name: `NNNN-short-title.md` (next free number).

## Template

```markdown
# NNNN. Title

- **Status:** proposed | accepted | superseded by NNNN
- **Date:** YYYY-MM-DD

## Context
What problem or choice we faced.

## Decision
What we chose.

## Consequences
What becomes easier or harder; follow-up work.
```

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-tech-stack.md) | Next.js frontend + Laravel API backend | accepted |
| [0002](0002-project-structure.md) | Monorepo with module-based folders | accepted |
| [0003](0003-vitest-for-unit-tests.md) | Vitest for frontend unit tests | accepted |
| [0004](0004-api-client-session-and-mocks.md) | One API client, session from `/auth/me`, and mock mode | accepted |
| [0005](0005-page-shells-and-server-seeded-session.md) | Page shells per route group, with the session loaded on the server | accepted |
| — | Production database engine (MySQL vs PostgreSQL) | open |
| — | Hosting (frontend, backend, database, file storage) | open |

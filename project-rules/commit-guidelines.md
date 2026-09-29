# Commit Guidelines

Pawfolio uses **Conventional Commits**.

## Format

```
<type>(<scope>): <summary>

[optional body: what and why, wrapped at 72 characters]

[optional footer: Refs FR24, RQ-03 · Closes #12 · BREAKING CHANGE: …]
```

- **summary:** imperative mood, lowercase start, no period, ≤ 72 characters — "add approve request dialog", not "Added dialog."
- **body:** explain *why* when it isn't obvious. Mention rules or requirements affected.
- **footer:** reference requirement and screen IDs (`Refs FR10, RQ-12`) and issues (`Closes #34`).

## Types

| Type | Use for |
| --- | --- |
| `feat` | A new feature or screen |
| `fix` | A bug fix |
| `docs` | Documentation or project rules only |
| `style` | Formatting only (no behaviour change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or fixing tests |
| `chore` | Tooling, config, dependencies, scaffolding |
| `perf` | Performance improvement |
| `build` / `ci` | Build system or CI pipeline changes |

## Scopes

Module scopes: `auth`, `profiles`, `discovery`, `matching`, `bookmarks`, `requests`, `meet`, `adoption`, `notifications`,
`feed`, `reports`, `accounts`, `analytics`, `logs`.
Cross-cutting scopes: `ui` (shared components, navigation), `api` (API client or routing), `db` (migrations, seeders),
`frontend` / `backend` (app-wide config), `rules` (project-rules), `docs`, `security` (security fixes and hardening —
see `security-guidelines.md` §10.4).

## Examples

```
feat(requests): add approve and decline dialogs for new requests

Refs FR10, RQ-12, RQ-13
```
```
fix(meet): send the 1-hour reminder in the user's timezone
```
```
chore(backend): scaffold module folders for controllers, actions and services
```
```
docs(rules): add toast placement rule for phone layouts
```

## Rules

- One logical change per commit; the app should build at every commit.
- Don't mix formatting-only changes with behaviour changes.
- Never commit secrets, `.env` files or real personal data. If it happens, rotate the secret immediately and tell the team.

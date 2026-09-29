# Git Guidelines

## 1. Repository

- **One repository for the whole project** (monorepo) at the `Pawfolio/` root: `frontend/`, `backend/`, `docs/`, `project-rules/`, `lofi-prototype/`.
- One-time setup note: `create-next-app` created a nested repo in `frontend/.git`. Remove it before initializing the root repo
  (after confirming it has no commits you need), so the frontend is tracked by the root repository.
- Each app keeps its own `.gitignore`; the root `.gitignore` covers OS/editor files. Never commit `node_modules/`, `vendor/`,
  `.next/`, `.env`, `database/*.sqlite`, uploaded files or build output.

## 2. Branches

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Stable, demo-ready code | Protected. Changes only through reviewed PRs from `develop` (or `hotfix/*`). Tag releases `v0.1.0`… |
| `develop` | Integration branch | Protected. Feature branches merge here through PRs. |
| `feature/<scope>-<short-desc>` | New work | Branch from `develop`. Example: `feature/requests-approve-dialog` |
| `fix/<scope>-<short-desc>` | Bug fixes | Example: `fix/meet-reminder-timezone`. Security fixes: `fix/security-<short-desc>` (see `security-guidelines.md` §10.4) |
| `docs/<short-desc>` | Documentation / rules only | Example: `docs/erd-v1` |
| `chore/<short-desc>` | Tooling, config, dependencies | Example: `chore/add-pint` |
| `hotfix/<short-desc>` | Urgent fix on `main` | Merge into `main` **and** `develop` |

- `<scope>` is a module scope from `general-development-guidelines.md` (`auth`, `profiles`, `requests`, `meet`, …) or `ui`, `api`, `db`.
- Branch names: lowercase, `kebab-case`, no spaces, ≤ 50 characters. Include the LoFi ID when useful: `feature/requests-rq11-review-screen`.
- One branch = one task. Delete the branch after it is merged.

## 3. Daily workflow

1. `git switch develop && git pull` before starting.
2. `git switch -c feature/<scope>-<desc>`.
3. Commit small, working steps (see `commit-guidelines.md`).
4. Keep up to date: `git pull --rebase origin develop` (rebase your own unpushed/unshared work; merge if the branch is shared).
5. `git push -u origin <branch>` and open a PR into `develop` (see `pull-request-guidelines.md`).

## 4. Pushing and history

- Never force-push to `main` or `develop`. On your own feature branch, use `--force-with-lease` only.
- Never commit directly to `main` or `develop`.
- Don't commit generated files, secrets or large binaries. Design PDFs in `docs/design/` are the exception (they are deliverables).
- Resolve conflicts locally, run the app and tests, then push.

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

## 3. One branch per pull request

Code always moves in this order, and every step is a reviewed pull request:

```
<type>/<scope>-<short-desc>  ──PR──▶  develop  ──release PR──▶  main
```

- **Every PR gets its own new branch.** Before opening a PR, create a new branch from the latest `develop`. Never open a PR from
  `develop` or `main` directly, and never reuse a merged branch for new work.
- **Branch name format:** `<type>/<scope>-<short-desc>`
  - `<type>`: `feature`, `fix`, `docs`, `chore` or `hotfix`. Use the matching commit type: `feature` → `feat`, the rest have the same name.
  - `<scope>`: a scope from §2. Required for `feature` and `fix`; optional for `docs`, `chore` and `hotfix`.
  - `<short-desc>`: 2–5 words in `kebab-case`, e.g. `feature/requests-approve-dialog`, `docs/rules-branch-per-pr`.
- **The PR compares your branch with `develop`.** Base = `develop`, compare = your branch. This is where review happens.
- **No stacked PRs.** Never set a PR's base to another feature branch, even when the work builds on a PR that is still
  open. A PR merges into its base, so a stacked PR lands on the branch below it instead of `develop`. FE-02 (#11, #12)
  and FE-05 (#19, #20) were stranded this way and needed catch-up PRs (#13, #21).
- **Splitting a big task:** make each part a PR that works on its own and targets `develop`. Open the next part only
  after the previous one is merged, from a new branch off the updated `develop`. If the parts only make sense together,
  send one PR with small commits and say why it's over the size guideline.
- **`develop` goes to `main` later**, through a release PR (`develop` → `main`) opened when `develop` is stable and
  demo-ready. After it merges, tag the release on `main` (`v0.1.0`…).
- **Only exception:** `hotfix/*` branches come from `main`, go into `main` by PR, and are then merged back into `develop`.

## 4. Daily workflow

1. `git switch develop && git pull` before starting.
2. `git switch -c <type>/<scope>-<short-desc>` (see §3).
3. Commit small, working steps (see `commit-guidelines.md`).
4. Keep up to date: `git pull --rebase origin develop` (rebase your own unpushed/unshared work; merge if the branch is shared).
5. `git push -u origin <branch>` and open a PR into `develop` (see `pull-request-guidelines.md`).

## 5. Pushing and history

- Never force-push to `main` or `develop`. On your own feature branch, use `--force-with-lease` only.
- Never commit directly to `main` or `develop`.
- Don't commit generated files, secrets or large binaries. Design PDFs in `docs/design/` are the exception (they are deliverables).
- Resolve conflicts locally, run the app and tests, then push.

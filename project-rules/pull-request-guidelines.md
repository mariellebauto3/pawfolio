# Pull Request Guidelines

## Title

Same format as a commit: `<type>(<scope>): <summary>` — e.g. `feat(requests): request detail screen for humans (RQ-11)`.

## Size

- Aim for **under ~400 changed lines** (excluding lock files and generated files). Split large features into several PRs
  (e.g. backend endpoint → frontend screen → dialogs).
- One PR = one task. Don't include unrelated fixes or refactors.

## Description template

```markdown
## What
Short summary of the change.

## Why
Link to the requirement or problem. Refs: FR__, NFR__, LoFi IDs (e.g. RQ-11, RQ-12).

## How
Key decisions and anything a reviewer should look at first.

## Screenshots
Desktop (1440 px) and phone (390 px) for any UI change.

## Testing
- [ ] How you tested it (steps, accounts used)
- [ ] Automated tests added/updated

## Checklist
- [ ] Follows project-rules (UI, frontend/backend, database, naming)
- [ ] Security checklist from `security-guidelines.md` §10.1 completed (paste it below for features touching data, auth or files)
- [ ] Business rules enforced on the backend (not only hidden in the UI)
- [ ] Loading, empty and error states handled
- [ ] Lint, type check, tests and builds pass
- [ ] No secrets, `.env` or real personal data committed
- [ ] Docs / project-rules updated if behaviour or conventions changed
```

## Review

- At least **one approval** from another team member before merging. The author doesn't approve their own PR.
- Reviewers check: correctness against the LoFi and requirements, rule enforcement on the server, security and privacy
  (cite rule IDs like `SEC-AUTHZ-02` in comments), naming and structure, tests.
- Security vulnerabilities found during review are handled per `security-guidelines.md` §10.4 — don't describe exploit details in public comments.
- Comment kindly and specifically; mark blocking comments clearly ("blocking:" vs "nit:").
- The author resolves every comment (fix or reply) before merging.

## Merging

- Target branch: `develop` (or `main` only for release and hotfix PRs).
- Use **squash merge** so each PR becomes one Conventional Commit on `develop`.
- Delete the branch after merging.

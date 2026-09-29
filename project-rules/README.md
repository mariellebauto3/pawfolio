# Pawfolio Project Rules

This folder is the **single source of truth** for how Pawfolio is designed, built, named, committed and reviewed.
Every contributor — human or AI assistant — reads these files before doing development work.

## Files

| File | Covers |
| --- | --- |
| [security-guidelines.md](security-guidelines.md) | **Authoritative security standard** (based on the Senior Security Claude Skill): threat model, auth, authorization, input, APIs, privacy, files, crypto, secrets, dependencies, deployment, vulnerability handling |
| [general-development-guidelines.md](general-development-guidelines.md) | Principles, repository layout, naming conventions, definition of done |
| [ui-guidelines.md](ui-guidelines.md) | UI/UX rules taken from the approved LoFi designs: layouts, components, dialogs, copy, accessibility |
| [frontend-guidelines.md](frontend-guidelines.md) | Next.js (`frontend/`) architecture, folders, routing, data fetching, TypeScript, styling |
| [backend-guidelines.md](backend-guidelines.md) | Laravel (`backend/`) architecture, API design, validation, authorization, status rules |
| [database-guidelines.md](database-guidelines.md) | Tables, columns, migrations, statuses, privacy of stored data |
| [git-guidelines.md](git-guidelines.md) | Repository setup, branches, pushing, merging |
| [commit-guidelines.md](commit-guidelines.md) | Commit message format and scopes |
| [pull-request-guidelines.md](pull-request-guidelines.md) | PR titles, description template, review and merge rules |

## How to use these rules

1. **Before starting any task**, read the files that apply to it. `general-development-guidelines.md` and
   `security-guidelines.md` always apply; any new feature or module also completes the security checklist in
   `security-guidelines.md` §10.1.
2. **Requirements come from `docs/`.** The rules say *how* to build; `docs/proposal/` and `docs/design/lofi/` say *what* to build.
3. **If a rule and a request conflict**, follow the rule and raise the conflict. Either the request changes or the rule is updated.
4. **When a new project-wide rule is agreed**, add it to the matching file in the same pull request as the work that needed it —
   don't rely on repeating it in chat or prompts. Larger decisions (new library, new service, change of architecture) also get a
   short record in `docs/decisions/`.
5. **Keep rules short and testable.** Write "do X" / "never Y" with a one-line reason, not essays.

## Order of precedence

1. Security and privacy rules — `security-guidelines.md` is the authority; security notes in other files point to it
2. System requirements in `docs/proposal/` (Section 5 status rules, Section 7–8 requirements)
3. These project rules
4. Framework defaults (Next.js, Laravel)
5. Personal preference

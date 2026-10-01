# General Development Guidelines

## 1. Principles

- **Build what the documents say.** Every screen maps to a LoFi ID (e.g. `RQ-11`) and every behaviour to a requirement (`FR24`, `NFR3`).
  If something isn't in `docs/`, ask before building it; if it's needed, document it first.
- **The server is the source of truth.** Business rules (proposal Section 5) are enforced in the backend. The frontend only hides
  actions that aren't allowed; it never *decides* them (NFR2, NFR3).
- **Nobody sets a status by hand.** Account, pet and request statuses change only through system actions (FR27). The only manual
  override is the admin "Resolve adoption issue" flow, with a required reason, logged (FR37, NFR9).
- **Privacy by default.** ID documents are admin-only; exact addresses and phone numbers are shared only after a Meet & Greet is
  confirmed; Home Profiles show only the city and a household summary (NFR4).
- **Simple first.** No new library, service or abstraction without a clear need. Record significant choices in `docs/decisions/`.
- **Leave it tidier.** Remove dead code, stray files and `.gitkeep` files once a folder has real content.

## 2. Repository layout

```
Pawfolio/
├── project-rules/     Project-wide rules (this folder)
├── docs/              Proposal, requirements, designs, architecture, database, API, decisions
├── frontend/          Next.js app (TypeScript, Tailwind) — see frontend-guidelines.md
├── backend/           Laravel API — see backend-guidelines.md
└── lofi-prototype/    Clickable LoFi prototype and the PDF generator (reference only, not production code)
```

- Production code lives only in `frontend/` and `backend/`.
- `lofi-prototype/` is a design artifact. Don't import from it; copy ideas, not code.
- Documentation lives in `docs/`, never scattered in code folders (feature `README.md` files are the exception).

## 3. Module names (use the same names everywhere)

| # | Module | Screen prefix | Frontend folder | Backend folder | Commit/branch scope |
| --- | --- | --- | --- | --- | --- |
| 1 | Authentication & Verification | AU | `auth` | `Auth` | `auth` |
| 2 | Profile Management | PR | `profiles` | `Profiles` | `profiles` |
| 3 | Discovery & Search | DS | `discovery` | `Discovery` | `discovery` |
| 4 | Matching & Suggestions | MT | `matching` | `Matching` | `matching` |
| 5 | Bookmarks | BM | `bookmarks` | `Bookmarks` | `bookmarks` |
| 6 | Adoption Requests | RQ | `adoption-requests` | `AdoptionRequests` | `requests` |
| 7 | Meet & Greet | MG | `meet-and-greet` | `MeetAndGreet` | `meet` |
| 8 | Adoption & Alumni | AL | `adoption` | `Adoption` | `adoption` |
| 9 | Notifications | NT | `notifications` | `Notifications` | `notifications` |
| 10 | Community Feed & Stories | FD | `community-feed` | `CommunityFeed` | `feed` |
| 11 | Reports & Moderation | RP | `reports` | `Reports` | `reports` |
| 12 | Account Administration | AC | `accounts` | `Accounts` | `accounts` |
| 13 | Analytics | AN | `analytics` | `Analytics` | `analytics` |
| 14 | Activity Logs | LG | `activity-logs` | `ActivityLogs` | `logs` |
| — | Navigation & global | GN | `components/navigation` | — | `ui` |

A new module gets a new row here first, then folders in both apps.

## 4. Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Frontend folders and files | `kebab-case` | `match-card.tsx`, `adoption-requests/` |
| React components (exported name) | `PascalCase` | `MatchCard` |
| Hooks | `use` + `camelCase`, file `use-*.ts` | `useRequestStatus` in `use-request-status.ts` |
| TypeScript types / interfaces | `PascalCase`, no `I` prefix | `AdoptionRequest`, `PetStatus` |
| Variables and functions | `camelCase` | `openSlots`, `approveRequest()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_OPEN_REQUESTS = 3` |
| URL paths (routes) | `kebab-case`, plural nouns for collections | `/home-profile/edit`, `/pets/[petId]` |
| API endpoints | `/api/v1/` + `kebab-case` plural nouns | `/api/v1/adoption-requests/{id}/approve` |
| PHP classes | `PascalCase`, suffix by role | `AdoptionRequestController`, `ApproveAdoptionRequest` (action) |
| PHP methods and variables | `camelCase` | `approve()`, `$openRequests` |
| Database tables | `snake_case`, plural | `adoption_requests` |
| Database columns | `snake_case` | `approved_at`, `home_profile_id` |
| Enum cases (statuses) | PHP `PascalCase` case, stored value `snake_case` | `RequestStatus::MeetScheduled` → `meet_scheduled` |
| Environment variables | `UPPER_SNAKE_CASE`, public ones prefixed `NEXT_PUBLIC_` | `NEXT_PUBLIC_API_URL` |
| Git branches | `type/scope-short-description` | `feature/requests-approve-dialog` |

Use the **domain words from the proposal** exactly: *Pet, Human, Admin, Furparent, résumé, Home Profile, Open to Adopt,
Looking for a Home, In Process, Hired, alumni, adoption request, Invite to Apply, Meet & Greet*. Don't invent synonyms
(e.g. never "owner", "listing" or "application" for these).

## 5. Definition of done

A task is done when:

- [ ] It matches the LoFi screen(s) and requirement(s) it references (IDs written in the PR).
- [ ] Business rules are enforced on the backend, with a test for each rule touched.
- [ ] It works on desktop (1440 px) **and** phone (390 px) layouts.
- [ ] Loading, empty and error states exist where the LoFi shows them.
- [ ] Lint, type checks and tests pass (`npm run lint`, `npm test`, `php artisan test`, builds succeed).
- [ ] The security checklist (`security-guidelines.md` §10.1) is complete.
- [ ] No secrets, personal data or debug output are committed.
- [ ] Docs or rules are updated if behaviour or conventions changed.

## 6. Security

All security rules live in **[security-guidelines.md](security-guidelines.md)** — the project's authoritative security
standard, based on the Senior Security Claude Skill. It always applies. Every new feature or module completes its
§10.1 security checklist, and the checklist is copied into the PR.

## 7. Dependencies

- Add a package only if it saves real work and is actively maintained. Mention it in the PR description.
- Libraries that shape the architecture (state management, form library, UI kit, ORM add-ons) need a `docs/decisions/` record.
- Keep lock files (`package-lock.json`, `composer.lock`) committed and in sync.

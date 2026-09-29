# Pawfolio

A LinkedIn-style platform where stray and shelter pets build a résumé, apply for a home, and get “Hired” by their future
Furparent. School project — see `docs/proposal/Pawfolio_System_Proposal.pdf`.

**Status:** scaffolding phase — folder structure and project rules only; no application code yet.

## Repository structure

```
Pawfolio/
├── CLAUDE.md                 AI-assistant entry point: loads everything in project-rules/
├── README.md                 This file
├── project-rules/            Project-wide rules (single source of truth); security-guidelines.md is the security authority
├── docs/
│   ├── proposal/             Approved system proposal (PDF)
│   ├── requirements/         module-map.md: modules ↔ LoFi IDs ↔ FRs ↔ folders
│   ├── design/lofi/          Approved LoFi designs: desktop + mobile PDFs
│   ├── design/hifi/          High-fidelity designs (next phase)
│   ├── architecture/         System and deployment diagrams
│   ├── database/             ERD and data model
│   ├── api/                  API endpoint reference
│   └── decisions/            Architecture Decision Records (ADRs)
├── frontend/                 Next.js 16 + TypeScript + Tailwind
│   ├── public/               icons/, images/{brand,illustrations,placeholders}
│   ├── src/app/              Routes only: (public)/ (account-status)/ (member)/ admin/
│   ├── src/features/         14 modules, each with components/ dialogs/ forms/ hooks/ api/ schemas/ types/ + README
│   ├── src/components/       Shared UI: ui/ forms/ overlays/ feedback/ data-display/ layout/ navigation/
│   ├── src/lib/              api/ auth/ utils/
│   ├── src/{hooks,types,constants,config,providers,styles}/
│   └── tests/                unit/ integration/ e2e/
├── backend/                  Laravel 12 REST API
│   ├── app/Http/Controllers/Api/V1/<Module>/   app/Http/Requests/<Module>/   app/Http/Resources/<Module>/
│   ├── app/Actions/<Module>/  app/Services/<Module>/  app/Enums/  app/Policies/  app/Events/  app/Listeners/
│   ├── app/Notifications/  app/Jobs/  app/Observers/  app/Http/Middleware/  app/Support/
│   ├── routes/api/v1/        One route file per module
│   └── tests/Feature/<Module>/  tests/Unit/<Module>/
└── lofi-prototype/           Clickable LoFi prototype + PDF generator (design reference, not production code)
```

`<Module>` = Auth, Profiles, Discovery, Matching, Bookmarks, AdoptionRequests, MeetAndGreet, Adoption, Notifications,
CommunityFeed, Reports, Accounts, Analytics, ActivityLogs (frontend uses the kebab-case versions).

## What each area is for

| Area | Purpose | Files that belong there | Maps to |
| --- | --- | --- | --- |
| `project-rules/` | Conventions everyone follows | Markdown rule files | All work |
| `docs/proposal/` | What the system must do | Proposal PDF | Sections 1–10 |
| `docs/requirements/` | Requirements in developer form | Module map, user stories | FR1–FR41, NFR1–NFR9 |
| `docs/design/` | What it must look like | LoFi PDFs, HiFi designs | All 143 LoFi screens/dialogs/states |
| `frontend/src/app/` | URLs and page shells | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` | LoFi screens (routes) |
| `frontend/src/features/<module>/` | Everything for one module | Components, dialogs, forms, hooks, API calls, schemas, types | Modules 1–14 |
| `frontend/src/components/` | Shared UI kit | Buttons, fields, modals, toasts, nav bars, shells | LoFi UI kit + navigation (GN) |
| `backend/app/.../<Module>/` | API for one module | Controllers, Form Requests, Resources, Actions, Services | Modules 1–14 |
| `backend/app/Enums`, `Policies`, `Jobs`… | Cross-cutting backend rules | Statuses, authorization, scheduled jobs, events, logs | Proposal §5 status rules, NFR2/3/9 |
| `backend/database/` | Data model | Migrations, factories, seeders | database-guidelines.md |

Each module's screens, dialogs, states, planned routes and requirements are listed in
`frontend/src/features/<module>/README.md` and summarized in `docs/requirements/module-map.md`.

## Running locally

| App | Command | URL |
| --- | --- | --- |
| Frontend | `cd frontend && npm install && npm run dev` | http://localhost:3000 |
| Backend | `cd backend && composer install && php artisan serve` | http://127.0.0.1:8000 |
| LoFi prototype | `cd lofi-prototype && npm install && npm run dev` | http://localhost:5173 |

## Contributing

Read `project-rules/` first — especially `general-development-guidelines.md`, `git-guidelines.md` and
`commit-guidelines.md`.

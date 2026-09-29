# 0002. Monorepo with module-based folders

- **Status:** accepted
- **Date:** 2026-09-28

## Context
The proposal defines 14 modules and the LoFi defines 143 screens, dialogs and states with IDs. The team needs to find
where each screen and rule lives, and to add features without restructuring.

## Decision
- One repository with `frontend/`, `backend/`, `docs/`, `project-rules/` and `lofi-prototype/`.
- Frontend: routes in `src/app/` (route groups per shell), feature code in `src/features/<module>/`, shared UI in `src/components/`.
- Backend: Laravel's standard layers, with a `<Module>/` subfolder inside each layer (Controllers, Requests, Resources, Actions,
  Services, tests).
- The same module names are used everywhere (see `project-rules/general-development-guidelines.md`).
- Each frontend feature has a `README.md` listing its LoFi screens and requirements, generated from the LoFi spec.

## Consequences
- A new module = a new row in the module table + folders in both apps.
- Cross-feature imports are not allowed; shared code moves to `components/`, `lib/`, `hooks/` or `types/`.

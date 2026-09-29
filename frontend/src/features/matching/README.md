# Feature: Matching & Suggestions (Module 4)

One compatibility score (0–100) used in both directions: Pets for You and Homes for You. Every match explains itself with its top reasons.

- **LoFi screen IDs:** `MT-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Matching/`
- **Who does what (proposal §9):** Human — Pets for You · Pet — Homes for You · Admin — —

## Folders

| Folder | Holds |
| --- | --- |
| `components/` | Feature-specific UI pieces used by this module's screens (cards, panels, lists). |
| `dialogs/` | Modals, drawers, confirmation dialogs and dropdown menus owned by this module. |
| `forms/` | Form and multi-step wizard components for this module. |
| `hooks/` | React hooks for this module (data loading, UI state). |
| `api/` | Functions that call the Laravel API endpoints for this module. |
| `schemas/` | Client-side validation schemas mirroring the backend Form Requests. |
| `types/` | TypeScript types specific to this module. |

## Screens, dialogs and states to build

| ID | Name | Type | Role | Route (planned) |
| --- | --- | --- | --- | --- |
| MT-01 | Pets for You | Screen | Human | `/matches` |
| MT-02 | Homes for You | Screen | Pet | `/matches` |
| MT-03 | Match breakdown dialog | Dialog | Human | `/matches` |
| MT-04 | Pets for You · quiz not finished | Empty state | Human | `/matches` |
| MT-05 | Homes for You · résumé in Draft | Empty state | Pet | `/matches` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR3** — Complete and edit a Home Profile and lifestyle quiz.
- **FR5** — View a ranked Pets for You feed with match scores and reasons.
- **FR20** — Create and edit the résumé: photos, bio, temperament, skills, compatibility, health.
- **FR21** — View a ranked Homes for You list of humans who are Open to Adopt.

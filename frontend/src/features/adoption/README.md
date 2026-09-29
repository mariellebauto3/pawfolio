# Feature: Adoption & Alumni (Module 8)

The job offer. Choosing Adopt makes the pet “Hired”, turns its profile into an alumni profile linked to the human, and gives the human the Furparent label.

- **LoFi screen IDs:** `AL-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Adoption/`
- **Who does what (proposal §9):** Human — Adopt, become Furparent · Pet — Becomes alumni (Hired) · Admin — Resolve issues

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
| AL-01 | Adopt confirmation dialog | Dialog | Human | `/requests/[requestId]` |
| AL-02 | You’re a Furparent | Dialog | Human | `/requests/[requestId]` |
| AL-03 | You got Hired | Dialog | Pet | `/requests/[requestId]` |
| AL-04 | Adopted request record | Screen | Human | `/requests/[requestId]` |
| AL-05 | Alumni profile (Furparent view) | Screen | Human | `/pets/[petId]` |
| AL-06 | Adoption details dialog | Dialog | Human | `/pets/[petId]` |
| AL-07 | Admin · Resolve adoption issue | Screen | Admin | `/admin/resolve` |
| AL-08 | Admin · Confirm status change | Dialog | Admin | `/admin/resolve` |
| AL-09 | Admin · Alumni profiles | Screen | Admin | `/admin/accounts` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR13** — Automatically receive the Furparent label; adopted pets shown on the profile.
- **FR14** — Furparent views the alumni profile and adoption details, and posts adoption stories.
- **FR28** — On adoption: alumni profile with Hired badge linked to the Furparent; other requests close.
- **FR29** — Post updates to the community feed, including after adoption.
- **FR37** — Resolve adoption issues with a required, logged reason.
- **FR38** — Manage and monitor alumni profiles.

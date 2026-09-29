# Feature: Reports & Moderation (Module 11)

Anyone active can report a profile, post, comment or account. Admins review and act, always with a reason.

- **LoFi screen IDs:** `RP-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Reports/`
- **Who does what (proposal §9):** Human — Report · Pet — Report · Admin — Review & act

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
| RP-01 | Report dialog | Dialog | Pet | `/homes/[homeId]` |
| RP-02 | Report sent (toast) | Toast | Pet | `/homes/[homeId]` |
| RP-03 | Admin · Reports queue | Screen | Admin | `/admin/reports` |
| RP-04 | Admin · Review report | Screen | Admin | `/admin/reports/[reportId]` |
| RP-05 | Admin · Take action dialog | Dialog | Admin | `/admin/reports/[reportId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR16** — Report a profile, post, comment or account.
- **FR32** — Report a profile, post, comment or account.
- **FR34** — Suspend, reactivate or deactivate any account.
- **FR35** — Review reports; remove, restore or dismiss content or accounts.

# Feature: Account Administration (Module 12)

Owners manage their own account settings. Admins suspend, reactivate or deactivate any account.

- **LoFi screen IDs:** `AC-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Accounts/`
- **Who does what (proposal §9):** Human — Own account · Pet — Own account · Admin — All accounts

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
| AC-01 | Settings (pet) | Screen | Pet | `/settings` |
| AC-02 | Settings (human) | Screen | Human | `/settings` |
| AC-03 | Request a change dialog | Dialog | Pet | `/settings` |
| AC-04 | Change password dialog | Dialog | Human | `/settings` |
| AC-05 | Deactivate account dialog | Dialog | Human | `/settings` |
| AC-06 | Admin · Accounts | Screen | Admin | `/admin/accounts` |
| AC-07 | Admin · Account detail | Screen | Admin | `/admin/accounts/[accountId]` |
| AC-08 | Admin · Suspend account dialog | Dialog | Admin | `/admin/accounts/[accountId]` |
| AC-09 | Admin · Reactivate account dialog | Dialog | Admin | `/admin/accounts/[accountId]` |
| AC-10 | Admin · Deactivate account dialog | Dialog | Admin | `/admin/accounts/[accountId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR34** — Suspend, reactivate or deactivate any account.

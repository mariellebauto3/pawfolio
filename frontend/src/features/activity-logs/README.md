# Feature: Activity Logs (Module 14)

Who did what, when and why. Owners see their own activity; admins see the full, read-only log.

- **LoFi screen IDs:** `LG-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/ActivityLogs/`
- **Who does what (proposal §9):** Human — Own activity · Pet — Own activity · Admin — Full logs

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
| LG-01 | My activity (pet) | Screen | Pet | `/activity` |
| LG-02 | My activity (human) | Screen | Human | `/activity` |
| LG-03 | Admin · Activity logs | Screen | Admin | `/admin/activity-logs` |
| LG-04 | Admin · Log entry detail | Drawer | Admin | `/admin/activity-logs` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR41** — View activity logs of important actions.

# Feature: Analytics (Module 13)

Stats for each role: the pet’s views and requests, the human’s match and request history, and the admin’s platform dashboard.

- **LoFi screen IDs:** `AN-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Analytics/`
- **Who does what (proposal §9):** Human — Match results, request history · Pet — Views, bookmarks, request stats · Admin — Platform dashboard

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
| AN-01 | My stats (pet) | Screen | Pet | `/stats` |
| AN-02 | Match & request history (human) | Screen | Human | `/stats` |
| AN-03 | Admin · Platform dashboard | Screen | Admin | `/admin` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR5** — View a ranked Pets for You feed with match scores and reasons.
- **FR10** — Review adoption requests and approve or decline them with an optional message.
- **FR30** — View stats: profile views, bookmarks and request history.
- **FR40** — View the platform analytics dashboard.

# Feature: Bookmarks (Module 5)

Save pets or homes for later, like saving a job posting.

- **LoFi screen IDs:** `BM-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Bookmarks/`
- **Who does what (proposal §9):** Human — Save pets · Pet — Save homes · Admin — —

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
| BM-01 | Bookmarks (human) | Screen | Human | `/bookmarks` |
| BM-02 | Bookmarks (pet) | Screen | Pet | `/bookmarks` |
| BM-03 | Saved to Bookmarks (toast) | Toast | Human | `/pets/[petId]` |
| BM-04 | Bookmarks · empty | Empty state | Pet | `/bookmarks` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR8** — Bookmark pet profiles.
- **FR23** — Bookmark Home Profiles.

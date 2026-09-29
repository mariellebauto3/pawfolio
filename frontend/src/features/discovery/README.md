# Feature: Discovery & Search (Module 3)

Browsing, filtering and searching. Humans find pets; pets find homes. Home Profiles show only public details — the city and a household summary.

- **LoFi screen IDs:** `DS-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Discovery/`
- **Who does what (proposal §9):** Human — Browse pets · Pet — Browse homes · Admin — View all

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
| DS-01 | Browse pets | Screen | Human | `/browse` |
| DS-02 | Browse homes | Screen | Pet | `/browse` |
| DS-03 | Search results | Screen | Human | `/search` |
| DS-04 | Search · no results | Empty state | Human | `/search` |
| DS-05 | Pet résumé (human view) | Screen | Human | `/pets/[petId]` |
| DS-06 | Photo viewer | Dialog | Human | `/pets/[petId]` |
| DS-07 | Home Profile (pet view) | Screen | Pet | `/homes/[homeId]` |
| DS-08 | Alumni profile (public view) | Screen | Pet | `/pets/[petId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR6** — Browse and search pets by species, age, size, temperament and compatibility.
- **FR7** — View a pet’s full résumé.
- **FR8** — Bookmark pet profiles.
- **FR9** — Send an Invite to Apply to a pet.
- **FR22** — Browse and search Home Profiles (public details only).
- **FR23** — Bookmark Home Profiles.
- **FR24** — Send an adoption request with a cover letter and track its status.
- **FR28** — On adoption: alumni profile with Hired badge linked to the Furparent; other requests close.

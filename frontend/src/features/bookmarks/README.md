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
| BM-03 | Saved to Bookmarks (toast) | Toast | Human, Pet | `/pets/[petId]`, `/homes/[homeId]`, `/matches` |
| BM-04 | Bookmarks · empty | Empty state | Pet | `/bookmarks` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built so far

- **BM-01, BM-02 (FE-14):** `/bookmarks` shows a human the pets they saved and a pet the homes it saved, newest
  save first, on the shared pet and home cards with the match on each (`components/saved-list.tsx`). Remove sits in
  the card's footer: the card leaves at once, a toast says "Removed from Bookmarks.", focus moves to the count and
  the page is read again, so the next page's cards move up. The page number lives in the URL (`?page=2`).
- **BM-03:** `components/bookmark-button.tsx`, with `hooks/use-bookmark.ts` behind it. On a resume and a Home
  Profile it is a button whose word changes ("Bookmark", "Bookmarked"); on a match card it is the mark alone, with
  `aria-pressed`. It saves on one press and removes on the next, each confirmed by a toast. The state follows the
  API's answer, and a refusal (an adopted pet) is shown in the API's words. The pages pass the button into the
  Discovery and Matching components, which don't import this module.
- **BM-04:** `components/no-bookmarks.tsx`, with the way to the matches and to Browse.
- **Who saves what:** a human saves pets, a pet saves homes, an admin nothing (`/bookmarks` sends an admin home).
  The API enforces it and decides which profiles may be saved (SEC-FE-05).
- API contract: `docs/api/bookmarks-and-invites.md`. Tests: `tests/unit/features/bookmarks/`. Mock mode answers
  these screens from memory (`docs/architecture/frontend-data-layer.md`).
- **Not built here:** Bookmark on the Browse and search cards (the LoFi has it on match cards only), and an undo
  on the "Removed" toast.

## Requirements covered

- **FR8** — Bookmark pet profiles.
- **FR23** — Bookmark Home Profiles.

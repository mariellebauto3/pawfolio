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
| DS-05 | Pet resume (human view) | Screen | Human | `/pets/[petId]` |
| DS-06 | Photo viewer | Dialog | Human | `/pets/[petId]` |
| DS-07 | Home Profile (pet view) | Screen | Pet | `/homes/[homeId]` |
| DS-08 | Alumni profile (public view) | Screen | Pet | `/pets/[petId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built so far

- **DS-01, DS-02 (FE-12):** `/browse` shows pets to a human and homes to a pet (`forms/browse-form.tsx` around
  `components/browse-results.tsx`). The search, the filters, the sort and the page live in the URL
  (`?species=dog,cat&age=adult&sort=newest&page=2`); the page reads them on the server, so every view can be linked
  and the back button undoes a filter. The filter panel is a drawer below `lg` (`dialogs/filter-drawer.tsx`). The
  rules for reading and writing that URL are pure functions in `schemas/browse-filters.ts`.
- **DS-03, DS-04:** `/search?q=…&type=pets&page=2` (`components/search-results.tsx`), fed by the top-bar search.
  "All" shows the first five of each kind with "See all"; a kind's own tab lists all of them a page at a time. The
  tab counts are the API's totals. Only the open tab's results are loaded.
- **DS-05, DS-08:** `/pets/[petId]` on the shared `@/components/data-display/pet-resume`, with "Your match"
  (`components/match-summary.tsx`) and Similar pets for a human. A Hired pet gets the badge and the "Hired by …"
  banner and no actions. A pet opening its own id goes to `/me`.
- **DS-06:** the photo viewer is shared (`@/components/overlays/photo-viewer`), opened by the resume's photo
  grid (`@/components/data-display/photo-gallery`), so a pet's own `/me` has it too.
- **DS-07:** `/homes/[homeId]` on the shared `@/components/data-display/home-profile-view`. Apply is the
  Adoption Requests module's button (FE-15), put on the page beside Bookmark: it links to `/apply/[homeId]`,
  shows "View my request" while a request is open, and explains the limit and the cooldown in a dialog
  (`RQ-05`, `RQ-06`). A human opening their own id goes to `/me`.
- **Cards** are shared (`@/components/data-display/match-card`, `pet-card`, `home-card`) for the matches and
  bookmarks lists that come next.
- API contract: `docs/api/discovery.md`. Tests: `tests/unit/features/discovery/`. Mock mode answers these
  screens from the fixtures.
- **Invite to Apply and Bookmark (FE-14):** the Adoption Requests and Bookmarks modules' buttons, put on the
  resume and on the Home Profile by their pages. A resume offers Invite to Apply only while the pet is Looking
  for a Home, and neither once it is adopted.
- **The alumni profile as its Furparent reads it (AL-05, FE-18):** the pet page puts the Adoption module's
  Adoption details (AL-06) and "Write an adoption story" where a human otherwise gets Invite and Bookmark.
- **Report (RP-01, FE-21):** the Reports module's button, put last among the actions of a resume and a Home
  Profile by their pages, for a pet or a human reading someone else's.
- **Not built here:** "See full breakdown" (MT-03) is
  the Matching module's button, passed into `components/match-summary.tsx` by the two profile pages. Latest activity on someone else's resume needs the pet's account id, which the resume doesn't carry.
  Browse filters by province only: the API matches a city exactly, so cities are found through the search box.

## Requirements covered

- **FR6** — Browse and search pets by species, age, size, temperament and compatibility.
- **FR7** — View a pet’s full resume.
- **FR8** — Bookmark pet profiles.
- **FR9** — Send an Invite to Apply to a pet.
- **FR22** — Browse and search Home Profiles (public details only).
- **FR23** — Bookmark Home Profiles.
- **FR24** — Send an adoption request with a cover letter and track its status.
- **FR28** — On adoption: alumni profile with Hired badge linked to the Furparent; other requests close.

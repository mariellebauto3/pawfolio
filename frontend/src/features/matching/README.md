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
| MT-05 | Homes for You · resume in Draft | Empty state | Pet | `/matches` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built so far

- **MT-01, MT-02 (FE-13):** `/matches` shows Pets for You to a human and Homes for You to a pet
  (`components/match-results.tsx` under `components/match-filters.tsx`). The quick filter, the sort and the page
  live in the URL (`?show=dogs&sort=newest&page=2`); the page reads them on the server. The rules for reading and
  writing that URL are pure functions in `schemas/match-view.ts`. A human's page header carries the Open to Adopt
  switch (the Profiles module's), a pet's the "2 of 3 open requests used" counter.
- **Match card:** the shared `@/components/data-display/match-card` (through `pet-card` and `home-card`), with the
  score tab, the top two reasons and "Why this match?". A score never shows without its reasons
  (ui-guidelines §6).
- **MT-03:** `dialogs/match-breakdown-dialog.tsx`, opened by `components/match-breakdown-button.tsx` from a match
  card and from "Your match" on a resume or a Home Profile (`DS-05`, `DS-07`, "See full breakdown"). It reads
  `GET /matches/{profile}/breakdown` when it first opens (`hooks/use-match-breakdown.ts`) and keeps the answer
  while the card is on the page. Nothing is scored in the browser.
- **MT-04, MT-05:** `components/matches-not-ready.tsx`, shown when the API says the account has no matches yet:
  the setup checklist and "Take the lifestyle quiz" for a human, "Continue resume" for a pet, both opening the
  first step with something left to do. A Hired pet is told it isn't looking any more.
- **Other states:** no match at all, and no match under a quick filter, each with its way out; a breakdown that
  fails to load can be tried again; one whose pair has no score any more says to reload.
- API contract: `docs/api/profiles-and-matching.md` ("Compatibility Matches"). Tests:
  `tests/unit/features/matching/`. Mock mode answers these screens from the fixtures.
- **Not built here:** Bookmark on a match card (`BM-03`) comes with FE-14, which owns the bookmark calls. The
  quick filters are the LoFi's five, one at a time; the full set of filters is on Browse.

## Requirements covered

- **FR3** — Complete and edit a Home Profile and lifestyle quiz.
- **FR5** — View a ranked Pets for You feed with match scores and reasons.
- **FR20** — Create and edit the resume: photos, bio, temperament, skills, compatibility, health.
- **FR21** — View a ranked Homes for You list of humans who are Open to Adopt.

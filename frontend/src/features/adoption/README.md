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

## Built so far

- **AL-01 (FE-18):** `dialogs/adopt-dialog.tsx`, opened by `components/adopt-button.tsx`, the first of the human's
  three choices once the Meet & Greet time has passed (MG-11, laid out by the Meet & Greet module, which is handed
  the button by the page). "This is permanent", what happens (the alumni profile, the Furparent label, the pet's
  other requests closing, Open to Adopt turning off), and a box to tick before "Yes, adopt". Nothing is sent but
  the request's id: the API makes every change itself (FR27).
- **AL-02:** `dialogs/furparent-dialog.tsx`, "You're a Furparent!", with the way to the alumni profile and to an
  adoption story. It is held by `components/adoption-moment.tsx`, which the page puts around the human's action
  panel: adopting reads the page again and takes the Adopt button away, so a dialog owned by the button would go
  with it. The celebration opens over a page that already shows the request as Adopted; when it closes, focus goes
  to the panel.
- **AL-03:** `dialogs/hired-dialog.tsx`, "You got Hired!", opened by "See what changed"
  (`components/hired-button.tsx`) on the pet's Adopted request, with the way to its alumni profile and to posting
  an update.
- **AL-04:** the Adopted request itself, on `/requests/[requestId]` for the human: the completed path and the
  history (Adoption Requests), the caretaker's contact details for the handover (Meet & Greet's
  `handover-contact.tsx`), "View alumni profile" and Adoption details. The pet's side of the same request has the
  Furparent's details and AL-03.
- **AL-05:** `/pets/[petId]` as the pet's own Furparent reads it: the Hired badge and the "Hired by …" banner of
  the alumni profile (DS-08), with Adoption details and "Write an adoption story" in place of Invite and Bookmark.
  Who the Furparent is comes from the resume (`hired_by`), who is reading from the session.
- **AL-06:** `dialogs/adoption-details-dialog.tsx`, opened by `components/adoption-details-button.tsx` from AL-05,
  from each adopted pet on the Furparent's own Home Profile (`/me`, PR-11) and from AL-04: the link, the timeline
  with when and where the two met, the days to adoption, the cover letter, and "Open request record". Read from
  the API when it opens (`hooks/use-adoption-record.ts`) and kept in memory only; the API answers the two sides of
  the adoption and admins, and anyone else gets "not available" (SEC-AUTHZ-03).
- **The adoption link** (`components/adoption-link.tsx`) is the one picture of all four dialogs, in the language of
  the status badges: the pet and the human joined by a dashed line while the adoption is still a question, and by
  a solid yellow one carrying the Hired tag once it happened. On the two celebrations the line draws in and the
  tag is stamped on it, once (`animate-link-in`, `animate-stamp-in`; reduced motion skips the movement).
- **When a decision went stale** (decided in another tab, or the pet withdrew while the dialog was open), the API
  refuses with a 409. The page is read again, which takes the old panel and its dialog away, so the API's words are
  said in a toast and focus is on the panel, where the request stands now.
- "Share your adoption story", "Write an adoption story" and "Post an update" lead to the feed (`/feed`), where
  the post dialogs (FD-03, FD-04) will open once the Community Feed module is built.
- API contract: `docs/api/adoption-and-meet-greet.md` ("The decision and the adoption"). Types:
  `types/adoptions.ts`. Tests: `tests/unit/features/adoption/`. The adoption a request ended in comes with the
  request: the page hands `readRequestAdoption` to `getRequestWith` of Adoption Requests, beside the Meet & Greet's
  reader.
- **Mock mode** answers every endpoint (`src/lib/api/mock/handlers/adoption.ts`): Ana Santos adopted Luna
  (adoption 1, request 6; sign in as `pet-hired` for Luna's side), and Bantay's request 7 waits for her decision.
  A page rendered on the server doesn't see what the browser changed, so the decision itself is walked against the
  API, not in mock mode.
- **AL-07 (FE-23):** `/admin/resolve`, Resolve adoption issue: the only way a pet's or a request's status changes
  outside the normal flow (FR27, FR37). Opened from an overdue request, a request's record or the Alumni tab,
  the pet and the request are in the address (`?pet=3&request=12`); opened from the sidebar it first asks which
  pet (`components/pet-finder.tsx`, a search answered by the page). `components/resolve-pet-card.tsx` shows
  where the pet stands, and `forms/resolve-issue-form.tsx` asks for the related request, one of four actions
  and the reason. **Which action applies to what is the API's answer** (`GET …/resolve`): an action that
  doesn't apply stays on the list, greyed, with the API's reason or the request it applies to instead
  (`actionChoices` in `schemas/resolutions.ts`). The form never sends a status.
- **AL-08:** `dialogs/confirm-resolution-dialog.tsx`, opened by "Review change" with what the API says the
  action would change (`POST …/resolve/preview`): the pet's and the request's status as the two badges they
  are everywhere, before and after, what else moves with it (the Furparent link, requests On Hold, a booked
  Meet & Greet), and the reason. "Apply change" sends the action and the reason; the toast confirms, the page
  is read again and the form starts over on where the pet stands now. If the pet or the request moved on in
  the meantime (409), the API's words are said in a toast and the page is read again.
- **Recent resolutions** (`components/recent-resolutions.tsx`): the latest manual changes beside the form, each
  with who made it, when and why, and a link to the request.
- **AL-09:** the Alumni tab of the accounts list (`/admin/accounts?tab=alumni`, built with FE-22). FE-23 adds
  "Resolve issue" to each row, which opens AL-07 on that pet.
- **The reason is read by both accounts** in their Alerts, and kept in the activity log with the admin's name;
  the form says so under the field.
- API contract: `docs/api/adoption-and-meet-greet.md` ("Resolve adoption issue"). Types: `types/resolutions.ts`
  and `src/types/adoption-resolution.ts`. Tests: `tests/unit/features/adoption/resolutions.test.ts`. Mock mode:
  `src/lib/api/mock/handlers/admin-adoption.ts`, with the API's rules for the four actions.

## Requirements covered

- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR13** — Automatically receive the Furparent label; adopted pets shown on the profile.
- **FR14** — Furparent views the alumni profile and adoption details, and posts adoption stories.
- **FR28** — On adoption: alumni profile with Hired badge linked to the Furparent; other requests close.
- **FR29** — Post updates to the community feed, including after adoption.
- **FR37** — Resolve adoption issues with a required, logged reason.
- **FR38** — Manage and monitor alumni profiles.

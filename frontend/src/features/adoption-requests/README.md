# Feature: Adoption Requests (Module 6)

The pet’s job application. Humans may nudge with an Invite to Apply; the pet sends a request with a cover letter; the human approves or declines.

- **LoFi screen IDs:** `RQ-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/AdoptionRequests/`
- **Who does what (proposal §9):** Human — Receive, approve / decline, invite · Pet — Send, track, withdraw · Admin — Monitor

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
| RQ-01 | Invite to Apply dialog | Dialog | Human | `/pets/[petId]` |
| RQ-02 | Invites to Apply | Screen | Pet | `/invites` |
| RQ-03 | Send adoption request | Screen | Pet | `/apply/[homeId]` |
| RQ-04 | Request sent | State | Pet | `/apply/[homeId]` |
| RQ-05 | Request limit reached | Dialog | Pet | `/homes/[homeId]` |
| RQ-06 | Cooldown after a decline | Dialog | Pet | `/homes/[homeId]` |
| RQ-07 | My requests · Active | Screen | Pet | `/requests` |
| RQ-08 | My requests · Closed | Screen | Pet | `/requests` |
| RQ-09 | Requests inbox · New | Screen | Human | `/requests` |
| RQ-10 | Requests inbox · In progress | Screen | Human | `/requests` |
| RQ-11 | New request (human) | Screen | Human | `/requests/[requestId]` |
| RQ-12 | Approve request dialog | Dialog | Human | `/requests/[requestId]` |
| RQ-13 | Decline request dialog | Dialog | Human | `/requests/[requestId]` |
| RQ-14 | Request · Sent (pet) | Screen | Pet | `/requests/[requestId]` |
| RQ-15 | Request · On Hold (pet) | Screen | Pet | `/requests/[requestId]` |
| RQ-16 | Withdraw request dialog | Dialog | Pet | `/requests/[requestId]` |
| RQ-17 | Request · Declined (pet) | Screen | Pet | `/requests/[requestId]` |
| RQ-18 | Admin · Requests monitor | Screen | Admin | `/admin/requests` |
| RQ-19 | Admin · Request detail | Screen | Admin | `/admin/requests/[requestId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built so far

- **RQ-01 (FE-14):** `dialogs/invite-to-apply-dialog.tsx`, opened by `components/invite-to-apply-button.tsx` on a
  pet's resume while the pet is Looking for a Home. The pet with the human's match, an optional note of up to 200
  characters, and the reminder that the address and phone number stay private. The API's refusal is shown in the
  dialog in its own words, with a link to the Home Profile when Open to Adopt is what is missing; "already
  invited" counts as sent. Afterwards "Invite sent" takes the button's place, and it is there again after a reload
  (`invited_at` on the resume).
- **RQ-02:** `/invites`, the pet's screen (`components/invite-list.tsx`, `components/invite-card.tsx`): who
  invited, the match, their note, and what the pet can do. Apply, or "View my request" once the pet applied, or
  why Apply isn't offered: the 30-day cooldown, or Open to Adopt turned off (`schemas/invites.ts`, in the order the
  Home Profile page uses). Dismiss takes the card away with a toast. A human or an admin opening `/invites` is
  sent home.
- API contract: `docs/api/bookmarks-and-invites.md`. Tests: `tests/unit/features/adoption-requests/`. Mock mode
  answers these screens from memory (`docs/architecture/frontend-data-layer.md`).
- **Not built here:** the pages the invite cards link to, Send adoption request (`RQ-03`, `/apply/[homeId]`) and the
  request itself (`/requests/[requestId]`), which come with FE-15. A human has no list of the invites they sent.

## Requirements covered

- **FR9** — Send an Invite to Apply to a pet.
- **FR10** — Review adoption requests and approve or decline them with an optional message.
- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR24** — Send an adoption request with a cover letter and track its status.
- **FR25** — Withdraw a request any time before the final decision.
- **FR30** — View stats: profile views, bookmarks and request history.
- **FR36** — Monitor all adoption requests and Meet & Greets, including overdue ones.
- **FR37** — Resolve adoption issues with a required, logged reason.

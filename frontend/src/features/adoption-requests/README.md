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
- **RQ-03, RQ-04 (FE-15):** `/apply/[homeId]`, the pet's job application (`forms/send-request-form.tsx`): who it
  goes to with the match (`components/request-recipient.tsx`), the cover letter (50 to 600 characters, counted as
  it is typed), the caretaker's notes, and the resume and health summary that go with it. Once sent, Request sent
  takes the form's place (`components/request-sent.tsx`) with the open request count and the expiry date the API
  answered. The page reads the pet's own requests first: a request already open with this home goes to that
  request, and a pet that can't apply right now reads why in place of the form (`components/apply-unavailable.tsx`).
- **RQ-05, RQ-06:** `dialogs/apply-blocked-dialog.tsx`, one dialog for the three rules that stop a request: 3 open
  requests (the three are listed, with Manage my requests), the 30-day cooldown (the last request's dates and the
  day it ends), and a request already in process with another home. It opens from Apply on a Home Profile
  (`components/apply-button.tsx`, mounted by `/homes/[homeId]`), and from the form when the API answers 409 after
  the page was rendered; the form then reads the pet's requests again to fill it. Which rule it is:
  `schemas/apply-state.ts`, in the API's order.
- **RQ-07, RQ-08:** `/requests` for a pet (`components/request-list.tsx`): Active and Closed in `?tab=`, a page at
  a time, each row a home with its city, home type and household, the dates and the status. The tab counts and
  "2 of 3 open · 1 in process" come from the API's count of each status.
- **RQ-09, RQ-10 (FE-16):** `/requests` for a human, the inbox (`InboxList` in the same file): New, In progress
  and Closed in `?tab=`, each row a pet with its breed, age and city. What waits on the human is marked "New" or
  "Decision needed"; every other row carries its status. In progress holds every open request that isn't new, On
  Hold included, so the three tabs leave none out. Manage availability links to `/availability`.
- **RQ-14, RQ-15, RQ-17, and every other status:** `/requests/[requestId]` for a pet, on
  `components/request-detail-layout.tsx`: the header (`components/request-header.tsx`: who, the read-only status
  badge and the path Sent → Adopted — Hired, or "Closed on" once it ended otherwise), the action panel, the
  request (`components/request-content.tsx`: cover letter, notes, what is attached) and, beside
  it, the history and the home. On a phone the action panel comes first. The pet's panel is
  `components/pet-request-panel.tsx`: what the status means, the human's reason and message on a decline, the day
  the cooldown ends, and Withdraw for every open status.
- **RQ-16:** `dialogs/withdraw-request-dialog.tsx`, opened by `components/withdraw-request-button.tsx`: what
  happens (it differs when the request is the one in process), an optional reason, Keep request and Withdraw
  request. Afterwards the pet lands on the Closed tab with a toast.
- **RQ-11:** `/requests/[requestId]` for a human, on the same layout: "Mochi wants to join your home", the cover
  letter and the caretaker's notes, the resume, the health summary and the match with "Why this match?" (the
  Matching module's breakdown, passed in by the page), the history in the human's words, and the pet's public
  details. The panel is `components/human-request-panel.tsx`: what each status means to the human, with Approve
  and Decline while the request is new (`components/answer-request-buttons.tsx`).
- **RQ-12, RQ-13:** `dialogs/approve-request-dialog.tsx` (what happens to the pet and its other requests, an
  optional message) and `dialogs/decline-request-dialog.tsx` (an optional reason and message, the 30-day note). A
  refusal from the API is shown in the dialog in its own words, and the page behind is read again. Afterwards the
  page shows the new status, a toast confirms, and focus moves to the action panel
  (`components/request-panel-frame.tsx`), since the buttons that were pressed are gone.
- **Building on the detail layout (FE-17, FE-18):** hand `RequestDetailLayout` a `header`, a `panel` and the
  content. `RequestHeader` takes the title and facts for the reader; `RequestLetter` and `RequestAttachments` (its
  `children` take more attachments) read the same for both sides, and `RequestHistory` takes a `reader`, since
  each side is "you" in its own history (`schemas/request-status.ts`). The page (`app/(member)/requests/
  [requestId]/page.tsx`) picks the view by role. A step that changes the status in place should sit inside
  `RequestPanelFrame`, so focus follows. Both panels take `meet`: the step another module shows in place of the
  status in plain words, with a `state` that names it, so focus also follows a change the status doesn't show (a
  booked slot is still Approved). What another module reads from the same answer comes through `getRequestWith`,
  which takes its reader. The Meet & Greet (FE-17) is built this way: `src/features/meet-and-greet/README.md`.
- API contracts: `docs/api/bookmarks-and-invites.md` and `docs/api/adoption-and-meet-greet.md` ("The pet's
  side"). Tests: `tests/unit/features/adoption-requests/`. Mock mode answers these screens from memory
  (`docs/architecture/frontend-data-layer.md`).
- **Not built here:** The decision after the meeting (FE-18): a request that is Awaiting Decision says the
  decision is the human's, with no buttons yet. The request thread the LoFi draws is not part of Pawfolio
  (decided 2026-10-09: `project-rules/ui-guidelines.md` §6). An admin opening `/requests` is sent
  to the dashboard. An adopted pet or a pet with a Draft resume still sees Apply on a Home Profile; the API
  refuses the request and the form shows its message. A human has no list of the invites they sent.

## Requirements covered

- **FR9** — Send an Invite to Apply to a pet.
- **FR10** — Review adoption requests and approve or decline them with an optional message.
- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR24** — Send an adoption request with a cover letter and track its status.
- **FR25** — Withdraw a request any time before the final decision.
- **FR30** — View stats: profile views, bookmarks and request history.
- **FR36** — Monitor all adoption requests and Meet & Greets, including overdue ones.
- **FR37** — Resolve adoption issues with a required, logged reason.

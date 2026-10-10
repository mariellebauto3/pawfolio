# Feature: Meet & Greet (Module 7)

The interview. After approval the pet books one of the human’s slots, the human confirms, and after the meeting the human decides.

- **LoFi screen IDs:** `MG-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/MeetAndGreet/`
- **Who does what (proposal §9):** Human — Set slots, confirm, decide · Pet — Book, reschedule · Admin — Monitor

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
| MG-01 | Meet & Greet availability | Screen | Human | `/availability` |
| MG-02 | Add slot dialog | Dialog | Human | `/availability` |
| MG-03 | Book a slot (pet) | Screen | Pet | `/requests/[requestId]` |
| MG-04 | Slot booked · awaiting confirmation (pet) | Screen | Pet | `/requests/[requestId]` |
| MG-05 | Confirm booking (human) | Screen | Human | `/requests/[requestId]` |
| MG-06 | Propose another time dialog | Dialog | Human | `/requests/[requestId]` |
| MG-07 | Meet Scheduled (human) | Screen | Human | `/requests/[requestId]` |
| MG-08 | Meet Scheduled (pet) | Screen | Pet | `/requests/[requestId]` |
| MG-09 | Reschedule dialog (pet) | Dialog | Pet | `/requests/[requestId]` |
| MG-10 | Cancel meeting dialog | Dialog | Pet · Human | `/requests/[requestId]` |
| MG-11 | Decision needed (human) | Screen | Human | `/requests/[requestId]` |
| MG-12 | Awaiting decision (pet) | Screen | Pet | `/requests/[requestId]` |
| MG-13 | “It didn’t happen” dialog | Dialog | Human | `/requests/[requestId]` |
| MG-14 | Decline after the meeting | Dialog | Human | `/requests/[requestId]` |
| MG-15 | Admin · Meet & Greets | Screen | Admin | `/admin/requests` |
| MG-16 | Admin · Overdue decisions | Screen | Admin | `/admin/requests` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built so far

- **MG-01 (FE-17):** `/availability`, the human's screen. "Upcoming slots" (`components/upcoming-slots.tsx`):
  every slot still ahead, soonest first, as rows instead of the LoFi's table, so a phone reads them without
  scrolling sideways. An open slot can be removed, after a confirmation; a booked one names the pet, says
  "Confirm needed" or Meet Scheduled, and leads to its request. "Past Meet & Greets"
  (`components/past-meetings.tsx`): the latest 10 confirmed meetings whose time has come, each with where its
  request stands now. Then the privacy note. With no slots yet the card says why and offers Add slot. A pet or an
  admin opening `/availability` is sent home.
- **MG-02:** `dialogs/add-slot-dialog.tsx`, opened by `components/add-slot-button.tsx`: date and time (typed and
  shown in Philippine time, `lib/utils/format-date.ts`), the kind of place, its details (optional only at the
  caretaker's), and "Weekly for 4 weeks". The rules and messages mirror the API's (`schemas/slots.ts`); a slot
  already at that time is refused by the API and said in the dialog.
- **MG-03…MG-08:** the Meet & Greet step of `/requests/[requestId]`, inside the request's action panel
  (`components/meet-section.tsx`, handed to the Adoption Requests panels by the page). Which step it is comes from
  the request's status and its booking (`meetStage` in `schemas/meetings.ts`):
  - *Approved, nothing booked.* The pet picks an open slot and books it (`forms/book-slot-form.tsx`, MG-03), or
    reads that there are none yet. The human reads how many slots are open, or a warning with Add a slot when
    there are none. If booking reopened, both read why first (`components/booking-notice.tsx`): the human
    proposed another time (the offered slot leads the pet's list, marked and chosen), or one side cancelled, with
    the reason.
  - *Booked, waiting for the human.* The pet reads its slot and can Change slot (MG-04). The human gets Confirm
    and Propose another time (MG-05).
  - *Confirmed.* Both read the meeting (`components/meet-card.tsx`, MG-07, MG-08) and can Reschedule or Cancel
    meeting; the pet can still withdraw.
- **Contact details** appear on the confirmed meeting only (NFR4, SEC-PRIV-02): the pet's caretaker reads the
  human's name, number and exact address; the human reads the caretaker's name and number, and is told what of
  theirs the caretaker sees. They come with the page from the API as plain text. Nothing writes them to browser
  storage or a URL (SEC-FE-04), which is also why the numbers are not `tel:` links. A reschedule, a proposal or a
  cancellation hides them again until a meeting is confirmed.
- **Confirming asks first** (`dialogs/confirm-booking-dialog.tsx`, not in the LoFi, `ui-guidelines.md` §5): it is
  the moment the contact details are shared, so the human reads what is shared before agreeing.
- **MG-06:** `dialogs/propose-time-dialog.tsx`: the human offers another open slot, with an optional message; the
  pet's booking ends and the pet books again. "Add a new slot" opens MG-02 in its place and comes back with the
  new slot chosen, keeping what was typed.
- **MG-09:** `dialogs/reschedule-dialog.tsx`, also "Change slot" on a booking that isn't confirmed yet: the pet
  picks another open slot, with an optional reason. The human confirms the new time.
- **MG-10:** `dialogs/cancel-meeting-dialog.tsx`, for either side: what happens, the required reason (the button
  waits for it) and optional details. Booking reopens.
- **MG-11, MG-12 (FE-18):** once the meeting time has passed, the same panel is at `decide`: the meeting that took
  place and the other side's contact details, still shared while the decision is open (`components/meet-card.tsx`,
  `when="past"`). The human gets the three choices stacked, most to least final
  (`components/decision-actions.tsx`): Adopt (the Adoption module's button, handed in by the page), Decline, and
  "It didn't happen", with the note that reminders continue for 7 days, or that the decision is overdue once an
  admin was flagged. The pet reads that the human is deciding, and can still withdraw. Whether the time has passed
  is the API's to say (`meeting_passed`): no screen compares clocks, and the decision is open in the minutes before
  the status reads Awaiting Decision too.
- **MG-13:** `dialogs/didnt-happen-dialog.tsx`: what happened (one of four, required: the button waits for it) and
  optional details. Booking reopens and the pet's side reads what was reported (`components/booking-notice.tsx`).
- **MG-14:** `dialogs/decline-after-meeting-dialog.tsx`: what ends, an optional message to the pet's caretaker, and
  the 30-day note. The request ends as Not Adopted.
- **After an adoption** the two sides keep each other's contact details on the request
  (`components/handover-contact.tsx`, shown by the page on AL-03 and AL-04): they still have a pet to hand over,
  and no other way to reach each other here (`project-rules/ui-guidelines.md` §6).
- After every change the page is read again, a toast confirms, and focus moves to the action panel
  (`RequestPanelFrame`), since the buttons that were pressed are gone. A refusal from the API is shown in its own
  words; a 409 also reads the page again, because what it showed is out of date (`hooks/use-meet-change.ts`).
- **The date leaf** (`components/date-leaf.tsx`) marks every slot and meeting: a plain outline while open, dashed
  while it waits for the human, the yellow fill once confirmed, in the language of the status badges.
- API contract: `docs/api/adoption-and-meet-greet.md` ("Availability, booking and the meeting"). Shared types:
  `src/types/meet-and-greet.ts`. Tests: `tests/unit/features/meet-and-greet/`. The request and its Meet & Greet
  come from one call: the page hands `readRequestMeeting` to `getRequestWith` of Adoption Requests.
- **Mock mode** answers every endpoint (`src/lib/api/mock/handlers/meet-and-greet.ts`): Ana Santos has four slots
  and Mochi's confirmed meeting on the first, and met Bantay yesterday, so request 7 is at the decision. A page rendered on the server doesn't see what the browser changed,
  so the steps before confirmation are walked against the API, not in mock mode.
- **MG-15, MG-16 (FE-23):** the admin's Meet & Greets and Overdue decisions are tabs of the requests monitor
  (`/admin/requests`, `src/features/adoption-requests/README.md`): the LoFi lists requests with their meeting, one
  row each. The monitor reads a booking with this module's `readBooking` (`api/meetings.ts`), handed in by the page.
- **Not built here:** editing a slot (the LoFi's "Edit" has no endpoint: remove it and add another).

## Requirements covered

- **FR11** — Set Meet & Greet availability; confirm, reschedule or cancel bookings.
- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR25** — Withdraw a request any time before the final decision.
- **FR26** — Book, reschedule or cancel a Meet & Greet once a request is approved.
- **FR36** — Monitor all adoption requests and Meet & Greets, including overdue ones.

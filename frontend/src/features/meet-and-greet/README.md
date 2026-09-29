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
| MG-10 | Cancel meeting dialog | Dialog | Human | `/requests/[requestId]` |
| MG-11 | Decision needed (human) | Screen | Human | `/requests/[requestId]` |
| MG-12 | Awaiting decision (pet) | Screen | Pet | `/requests/[requestId]` |
| MG-13 | “It didn’t happen” dialog | Dialog | Human | `/requests/[requestId]` |
| MG-14 | Decline after the meeting | Dialog | Human | `/requests/[requestId]` |
| MG-15 | Admin · Meet & Greets | Screen | Admin | `/admin/requests` |
| MG-16 | Admin · Overdue decisions | Screen | Admin | `/admin/requests` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR11** — Set Meet & Greet availability; confirm, reschedule or cancel bookings.
- **FR12** — Choose Adopt or Decline once the Meet & Greet time has passed.
- **FR25** — Withdraw a request any time before the final decision.
- **FR26** — Book, reschedule or cancel a Meet & Greet once a request is approved.
- **FR36** — Monitor all adoption requests and Meet & Greets, including overdue ones.

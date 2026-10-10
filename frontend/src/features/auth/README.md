# Feature: Authentication & Verification (Module 1)

Sign-up, sign-in and the admin verification gate. Every new Pet and Human account starts as Pending Verification and cannot use the platform until an admin approves it.

- **LoFi screen IDs:** `AU-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Auth/`
- **Who does what (proposal §9):** Human — Sign up, submit ID · Pet — Sign up, submit caretaker ID · Admin — Approve / deny

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

Built: AU-01 to AU-06 (FE-06), AU-07 to AU-17 (FE-07), AU-18 to AU-21 (FE-08) and AU-22 to AU-26 (FE-09).
Endpoints: `docs/api/auth.md`.

**Sign-up wizards (FE-07).** `forms/pet-sign-up-wizard.tsx` and `forms/human-sign-up-wizard.tsx` share
`hooks/use-sign-up-wizard.ts`: typed values stay in React state only (no browser storage, no URL: SEC-FE-04), so a
reload starts over and the browser warns first. Each step is checked on Next by `schemas/sign-up-schemas.ts`; a `422`
from the API is shown on its field and the wizard returns to the first step that has one. On success the account is
signed in as Pending Verification and goes to `/account-status`. The sign-up endpoints are not built yet (BE-04), so
the wizards run against the mock (`NEXT_PUBLIC_API_MODE=mock`, as the `signed-out` persona).

**Account-status screens (FE-08).** Both pages are Server Components that read the account and its status from the
API (`api/account-status.ts`) and send anyone who doesn't belong there to their own home. `/account-status` renders
`components/account-status-screen.tsx`: Pending (`AU-18`, with what was submitted), Denied (`AU-20`, the admin's
reason and "Correct and resubmit"), Suspended (`AU-21`, the reason only) and the message for an account closed while
signed in. `/account/edit` (`AU-19`) is for Pending and Denied accounts only: `forms/pet-submission-form.tsx` and
`forms/human-submission-form.tsx` show the sign-up fields again, filled in, through the field components the wizards
use (`components/*-fields.tsx`) and the same checks (`schemas/submission-schemas.ts`). Files are optional there:
leaving one out keeps the one on file. Saving returns to `/account-status` with a toast, Pending again. The owner
never gets their documents back, only what was sent and when (SEC-PRIV-01). The endpoints are not built yet (BE-06),
so the screens run against the mock.

**Admin verification (FE-09).** Both pages are Server Components that read from the admin endpoints
(`api/verification-review.ts`); the admin layout reads the queue size for the sidebar. `/admin/verification`
(`AU-22`) renders `components/verification-queue.tsx`: the tabs All / Pet / Human, the search by name
(`components/verification-search.tsx`) and the pages all live in the URL (`?tab=pet&q=carla&page=2`).
`/admin/verification/[accountId]` (`AU-23`, `AU-24`) renders `components/verification-review-screen.tsx`: the
submitted details, the documents and the decision, with the earlier denial on a resubmission and the place in the
queue with Next. `components/review-documents.tsx` loads each file through the admin endpoint with
`useDocumentFile` (`src/hooks/`) and shows it from memory; `DocumentViewer` (`src/components/overlays/`) opens it full
size. No URL to a
document exists, and only a JPG, PNG or PDF is ever shown (SEC-PRIV-01, SEC-FE-09). `components/review-decision.tsx`
holds the checklist (a working aid: every check must be ticked before Approve, nothing is sent), Approve (`AU-26`
toast) and `dialogs/deny-account-dialog.tsx` (`AU-25`: a reason is required, and a message when the reason is
"Other"; rules in `src/lib/auth/verification-review.ts`). After a decision the page reloads what the API says: the
outcome, the status badge and the sidebar count. The endpoints are not built yet (BE-08), so the screens run against
the mock as the `admin` persona; the mock remembers decisions, so an approved owner can sign in to the member shell.

| ID | Name | Type | Role | Route (planned) |
| --- | --- | --- | --- | --- |
| AU-01 | Landing page | Screen | Visitor | `/` |
| AU-02 | Sign in | Screen | Visitor | `/sign-in` |
| AU-03 | Sign in · error | Error state | Visitor | `/sign-in` |
| AU-04 | Forgot password | Screen | Visitor | `/forgot-password` |
| AU-05 | Reset link sent | State | Visitor | `/forgot-password` |
| AU-06 | Set a new password | Screen | Visitor | `/reset-password` |
| AU-07 | Join · choose account type | Screen | Visitor | `/sign-up` |
| AU-08 | Pet sign-up · 1 Account | Screen | Visitor | `/sign-up/pet` |
| AU-09 | Pet sign-up · 2 Pet details | Screen | Visitor | `/sign-up/pet` |
| AU-10 | Pet sign-up · 3 Photo | Screen | Visitor | `/sign-up/pet` |
| AU-11 | Pet sign-up · 4 Caretaker & ID | Screen | Visitor | `/sign-up/pet` |
| AU-12 | Pet sign-up · 5 Review | Screen | Visitor | `/sign-up/pet` |
| AU-13 | Human sign-up · 1 Account | Screen | Visitor | `/sign-up/human` |
| AU-14 | Human sign-up · 2 Personal details | Screen | Visitor | `/sign-up/human` |
| AU-15 | Human sign-up · 3 Address | Screen | Visitor | `/sign-up/human` |
| AU-16 | Human sign-up · 4 Valid ID | Screen | Visitor | `/sign-up/human` |
| AU-17 | Human sign-up · 5 Review | Screen | Visitor | `/sign-up/human` |
| AU-18 | Pending approval screen | Screen | Pet, Human | `/account-status` |
| AU-19 | Edit submitted details | Screen | Pet, Human | `/account/edit` |
| AU-20 | Account denied | Screen | Pet, Human | `/account-status` |
| AU-21 | Account suspended | Screen | Pet, Human | `/account-status` |
| AU-22 | Admin · Verification queue | Screen | Admin | `/admin/verification` |
| AU-23 | Admin · Review pet account | Screen | Admin | `/admin/verification/[accountId]` |
| AU-24 | Admin · Review human account (resubmitted) | Screen | Admin | `/admin/verification/[accountId]` |
| AU-25 | Admin · Deny account dialog | Dialog | Admin | `/admin/verification/[accountId]` |
| AU-26 | Admin · Account approved (toast) | Toast | Admin | `/admin/verification/[accountId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR1** — Register and submit verification details; account starts as Pending Verification.
- **FR2** — Log in and use the platform only after approval; pending and denied accounts see a status screen.
- **FR18** — Register with the caretaker’s verification details; starts as Pending Verification.
- **FR19** — Log in and use the platform only after admin approval.
- **FR33** — Review the verification queue; approve or deny each account with a reason.
- **FR34** — Suspend, reactivate or deactivate any account.

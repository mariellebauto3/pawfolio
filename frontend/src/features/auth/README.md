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

Built: AU-01 to AU-06 (FE-06) and AU-07 to AU-17 (FE-07). Endpoints: `docs/api/auth.md`.

**Sign-up wizards (FE-07).** `forms/pet-sign-up-wizard.tsx` and `forms/human-sign-up-wizard.tsx` share
`hooks/use-sign-up-wizard.ts`: typed values stay in React state only (no browser storage, no URL: SEC-FE-04), so a
reload starts over and the browser warns first. Each step is checked on Next by `schemas/sign-up-schemas.ts`; a `422`
from the API is shown on its field and the wizard returns to the first step that has one. On success the account is
signed in as Pending Verification and goes to `/account-status`. The sign-up endpoints are not built yet (BE-04), so
the wizards run against the mock (`NEXT_PUBLIC_API_MODE=mock`, as the `signed-out` persona).

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
| AU-18 | Pending approval screen | Screen | Pet | `/account-status` |
| AU-19 | Edit submitted details | Screen | Pet | `/account/edit` |
| AU-20 | Account denied | Screen | Human | `/account-status` |
| AU-21 | Account suspended | Screen | Pet | `/account-status` |
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

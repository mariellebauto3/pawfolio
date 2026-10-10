# Feature: Account Administration (Module 12)

Owners manage their own account settings. Admins suspend, reactivate or deactivate any account.

- **LoFi screen IDs:** `AC-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Accounts/`
- **Who does what (proposal §9):** Human — Own account · Pet — Own account · Admin — All accounts
- **API:** `docs/api/community-reports-and-admin.md`, "Account Settings & Admin Account Management"

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

| ID | Name | Type | Role | Route | Status |
| --- | --- | --- | --- | --- | --- |
| AC-01 | Settings (pet) | Screen | Pet | `/settings` | Built (FE-22) |
| AC-02 | Settings (human) | Screen | Human | `/settings` | Built (FE-22) |
| AC-03 | Request a change dialog | Dialog | Pet, Human | `/settings`; reviewed on `/admin/accounts/[accountId]` | Built (FE-22) |
| AC-04 | Change password dialog | Dialog | Pet, Human | `/settings` | Built (FE-22) |
| AC-05 | Deactivate account dialog | Dialog | Pet, Human | `/settings` | Built (FE-22) |
| AC-06 | Admin · Accounts | Screen | Admin | `/admin/accounts` | Built (FE-22) |
| AC-07 | Admin · Account detail | Screen | Admin | `/admin/accounts/[accountId]` | Built (FE-22) |
| AC-08 | Admin · Suspend account dialog | Dialog | Admin | `/admin/accounts/[accountId]` | Built (FE-22) |
| AC-09 | Admin · Reactivate account dialog | Dialog | Admin | `/admin/accounts/[accountId]` | Built (FE-22) |
| AC-10 | Admin · Deactivate account dialog | Dialog | Admin | `/admin/accounts/[accountId]` | Built (FE-22) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built (FE-22)

| What | Where |
| --- | --- |
| The owner's calls: settings, contact details, a notification switch, the password, deactivation, a change request. A row that doesn't match the contract is left out | `api/settings.ts` |
| The admin's calls: the list, an account, suspend, reactivate, deactivate, a change request's review and its document | `api/admin-accounts.ts` |
| The locked details and their words, the rules of every form, the list's filters from the address, which actions a status offers, the status history | `schemas/accounts.ts` |
| `SettingsScreen` and its cards: verified details, contact, notifications, sign-in & security, close account (`AC-01`, `AC-02`) | `components/settings-screen.tsx`, `verified-details.tsx`, `notification-settings.tsx`, `password-card-actions.tsx`, `close-account-card.tsx`, `forms/contact-details-form.tsx` |
| Request a change (`AC-03`), Change password (`AC-04`), Deactivate account (`AC-05`) | `dialogs/request-change-dialog.tsx`, `change-password-dialog.tsx`, `deactivate-account-dialog.tsx` |
| `AccountsList` and `AccountsFilters`: tabs All, Pet, Human, Alumni, the search and the status filter (`AC-06`) | `components/accounts-list.tsx`, `accounts-filters.tsx` |
| `AccountDetailScreen`: status history, requests, change requests, verification, reports, recent activity (`AC-07`) | `components/account-detail-screen.tsx`, `change-requests-card.tsx` |
| Suspend, Reactivate, Deactivate (`AC-08`, `AC-09`, `AC-10`) | `components/account-actions.tsx` |
| The pages (Server Components) | `src/app/(member)/settings/page.tsx`, `src/app/admin/accounts/page.tsx`, `src/app/admin/accounts/[accountId]/page.tsx` |

Shared with other modules since FE-22: `PasswordInput` and `NewPasswordGuide` (`src/components/forms/`), and
`DocumentViewer` (`src/components/overlays/`) with `useDocumentFile` (`src/hooks/`), moved out of the auth module.

- **One Settings page for both roles.** A pet's verified details are name, species, breed and approximate age, and
  its contact is the caretaker's; a human's are full name, birthdate, city and province, and the contact is their
  own number and street address. An admin has no member settings and is sent to the dashboard.
- **Locked details change only through an admin** (`AC-03`). Each one offers "Request a change", which opens the
  dialog on it. The new value's control follows the detail (a list for species and province, a date for a
  birthdate, a number of years or months for an age), and both the screen and the API hold it to the rule of the
  sign-up field it replaces. One request per detail at a time: a detail that is waiting says so instead. A
  supporting document goes to the private disk; only admins open it.
- **Requests are reviewed on the account's page** (`AC-07`), as the BE-23 task asks: what the account says now beside
  what is asked for, the owner's reason, the document from memory, then Approve or Deny. A denial needs its reason,
  which the owner reads in their Alerts.
- **Contact details stay private.** The API sends them to their owner only; the form keeps them in its own state:
  no browser storage, no URL (SEC-FE-04, SEC-PRIV-02).
- **A switch applies at once.** It moves when pressed and goes back, with a toast, if the API refuses.
- **The password.** The current one is checked by the API, the new one is held to the sign-up rules, and every
  other device is signed out; this one stays signed in (SEC-AUTH-07).
- **Deactivating is permanent** (`AC-05`). The dialog lists what happens, asks why (optional) and for the password.
  Only a suspended account can be reactivated (proposal §5.1), so it says so. Once the API answers, the landing page
  replaces the app.
- **An admin's actions are the API's actions** (`AC-08`…`AC-10`, FR34): each needs a reason and is logged with the
  admin's name; none sets a status (FR27). Only what the status allows is offered: Suspend for an Active account,
  Reactivate for a suspended one, Deactivate for any that isn't deactivated yet. Deactivate also asks for the
  acknowledgement. A second admin acting on the same account is answered 409, and the page shows where it stands.
- **Suspending or deactivating closes the account's open requests** (proposal §5.3, "Closed"): their Meet & Greets
  end, the other side is told, and a pet In Process with the account is Looking for a Home again. The dialogs say
  so, because the API does it.
- **Since FE-23:** the Alumni tab's "Resolve issue" (`AL-09`) opens Resolve Issues on that pet (`AL-07`), and a
  request on an account's page opens its record (`RQ-19`).
- **Not here:** "See sign-in activity" and "Full activity log" lead to Activity Logs (`LG-01`, `LG-03`), built by
  its own task. The email can't be changed: no endpoint does it.

## Requirements covered

- **FR34** — Suspend, reactivate or deactivate any account.

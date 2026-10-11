# Feature: Activity Logs (Module 14)

Who did what, when and why. Owners see their own activity; admins see the full, read-only log.

- **LoFi screen IDs:** `LG-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/ActivityLogs/`
- **Who does what (proposal §9):** Human — Own activity · Pet — Own activity · Admin — Full logs

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
| LG-01 | My activity (pet) | Screen | Pet | `/activity` | Built (FE-26) |
| LG-02 | My activity (human) | Screen | Human | `/activity` | Built (FE-26) |
| LG-03 | Admin · Activity logs | Screen | Admin | `/admin/activity-logs` | Built (FE-26) |
| LG-04 | Admin · Log entry detail | Drawer | Admin | `/admin/activity-logs` | Built (FE-26) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR41** — View activity logs of important actions.

## Built (FE-26)

| What | Where |
| --- | --- |
| The calls: my activity, the platform's log, one entry, and the two CSV exports. A row that doesn't match the contract is left out | `api/activity-logs.ts` |
| The tabs and filters and their place in the URL, and the words: an action's name, a status value, a reason, "By the system". No React, so every rule is unit-tested | `schemas/activity-logs.ts` |
| What the endpoints answer | `types/activity-logs.ts` |
| `MyActivity` (LG-01, LG-02): tabs by type, the When / Activity / Type table, pages | `components/my-activity.tsx` |
| `ActivityLogs` (LG-03) with its filters and rows; a row's "What" opens the drawer | `components/activity-logs.tsx`, `activity-log-filters.tsx`, `activity-log-table.tsx` |
| `LogEntryDrawer` (LG-04): actor, action, target, before and after, reason, device, and the read-only note | `dialogs/log-entry-drawer.tsx` |
| `ValueChange`: a change's before and after, a status as its badge | `components/value-change.tsx` |
| `DownloadCsvButton`: "Download CSV" and "Export CSV" | `components/download-csv-button.tsx` |
| The pages (Server Components) | `src/app/(member)/activity/page.tsx`, `src/app/admin/activity-logs/page.tsx` |

API contract: `docs/api/community-reports-and-admin.md`, "Activity logs as the screens use them".

- **LG-01 and LG-02 are one page.** The API lists the signed-in account's own activity, so only the entries differ.
  An admin opening `/activity` is sent to the platform's log.
- **Nothing here writes.** The log is append-only in the API and in the model; the screens have no control that
  changes an entry (SEC-LOG-04).
- **The API decides what a reader sees.** A member's entries come without reasons, ids or an admin's name; the
  screens show what they are given and add nothing.
- **Words are the screens'.** The API names an action (`adoption_request_approved`) and a value (`in_process`);
  `schemas/activity-logs.ts` has the words for every action the backend writes. A new action shows up written
  from its own name until it is added there.
- **Eight tabs for twelve types** on My activity: the types a member reads together share a tab (Requests holds
  requests and adoptions; Account holds account, verification and the member's own reports). The Type column
  names each entry's own type.
- **A CSV is saved, never shown.** It is read with `api.getFile`, which accepts `text/csv` only, and handed to the
  browser as a download (`src/lib/utils/save-file.ts`; SEC-FE-09).
- **LG-04 opens at once** with what the row already has and asks the API for the rest (the device). Closing it
  returns focus to the row.
- **Not here:** a search box and a date range (the LoFi has neither; the API's `q` is ready).

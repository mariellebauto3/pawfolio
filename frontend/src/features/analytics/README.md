# Feature: Analytics (Module 13)

Stats for each role: the pet’s views and requests, the human’s match and request history, and the admin’s platform dashboard.

- **LoFi screen IDs:** `AN-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Analytics/`
- **Who does what (proposal §9):** Human — Match results, request history · Pet — Views, bookmarks, request stats · Admin — Platform dashboard

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
| AN-01 | My stats (pet) | Screen | Pet | `/stats` | Built (FE-25) |
| AN-02 | Match & request history (human) | Screen | Human | `/stats` | Built (FE-25) |
| AN-03 | Admin · Platform dashboard | Screen | Admin | `/admin` | Built (FE-25) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR5** — View a ranked Pets for You feed with match scores and reasons.
- **FR10** — Review adoption requests and approve or decline them with an optional message.
- **FR30** — View stats: profile views, bookmarks and request history.
- **FR40** — View the platform analytics dashboard.

## Built (FE-25)

| What | Where |
| --- | --- |
| The calls: the member's own stats, the platform's dashboard. A number the answer doesn't carry reads as 0 | `api/stats.ts` |
| How the numbers are grouped and put into words: tile notes, where views came from, requests by outcome, score bands, month labels, a chart's scale. No React, so every rule is unit-tested | `schemas/stats.ts` |
| What the endpoints answer | `types/stats.ts` |
| `PetStats` (AN-01), `HumanStats` (AN-02), `PlatformDashboard` (AN-03), and `RequestHistory` shared by the first two | `components/` |
| The charts: `BarList` (a few counts, each value written out), `ColumnChart` (counts in an order: months, score bands), `StackedBar` (parts of a whole, with a list that carries every count), `LineChart` (change over time; point at it or press ← → to read a point) | `components/` |
| The pages (Server Components) | `src/app/(member)/stats/page.tsx`, `src/app/admin/page.tsx` |

The tile itself (`StatTile`, `StatTiles`) is a shared component (`src/components/data-display/stat-tile.tsx`), from
the LoFi UI kit. API contract: `docs/api/community-reports-and-admin.md`, "Analytics as the screens use them".

- **AN-01 and AN-02 are one address.** `/stats` shows whichever the API answers for the signed-in account. An admin
  is sent to `/admin`.
- **Everything is counted by the API.** The screens only group (a human's request statuses into five outcomes) and
  name. Totals count from the day the account joined; the views chart covers 30 days, the admin's trends 6 months.
- **No chart library.** Bars and columns are HTML, the line chart is one SVG with HTML labels, so there is nothing
  to measure and nothing to download. Every chart writes its values out or carries a table for screen readers;
  colour rules are in `docs/design/hifi/README.md`, "Charts".
- **"Where views come from"** works because the resume page tells the API which page the visitor was on
  (`src/lib/utils/view-source.ts`): a name such as `matches`, never the address.
- **Not here:** the LoFi's date-range select and the dashboard's Export button (see the API doc, "Left as it is").

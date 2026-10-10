# Feature: Reports & Moderation (Module 11)

Anyone active can report a profile, post, comment or account. Admins review and act, always with a reason.

- **LoFi screen IDs:** `RP-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Reports/`
- **Who does what (proposal §9):** Human — Report · Pet — Report · Admin — Review & act
- **API:** `docs/api/community-reports-and-admin.md`, "Reports & Moderation"

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
| RP-01 | Report dialog | Dialog | Pet, Human | `/feed`, `/posts/[postId]`, `/pets/[petId]`, `/homes/[homeId]` | Built (FE-21) |
| RP-02 | Report sent (toast) | Toast | Pet, Human | the same pages | Built (FE-21) |
| RP-03 | Admin · Reports queue | Screen | Admin | `/admin/reports` | Built (FE-21) |
| RP-04 | Admin · Review report | Screen | Admin | `/admin/reports/[reportId]` | Built (FE-21) |
| RP-05 | Admin · Take action dialog | Dialog | Admin | `/admin/reports/[reportId]` | Built (FE-21) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built (FE-21)

| What | Where |
| --- | --- |
| The calls: file a report, the queue a page at a time, the open count for the sidebar, one report, take an action. A row that doesn't match the contract is left out | `api/reports.ts` |
| The reasons and their words, what is sent for each kind of target, the rules of both forms, which actions a report offers, the tab and the id read from the address | `schemas/reports.ts` |
| `ReportHost`: the one report dialog and its toast, mounted around the member shell | `components/report-host.tsx` |
| `ReportButton`: Report on a resume or a Home Profile | `components/report-button.tsx` |
| The report dialog (`RP-01`) | `dialogs/report-dialog.tsx` |
| `ReportsQueue`: the Open and Resolved tabs (`RP-03`) | `components/reports-queue.tsx` |
| `ReportReviewScreen` and `ReportDecision`: the content, every report on it, the account, and the decision (`RP-04`) | `components/report-review-screen.tsx`, `report-decision.tsx` |
| Take action (`RP-05`) | `dialogs/take-action-dialog.tsx` |
| The pages (Server Components) | `src/app/admin/reports/page.tsx`, `src/app/admin/reports/[reportId]/page.tsx` |

Shared with the screens that offer Report: `ReportTarget` and the reason, target and action lists in
`src/types/report.ts`, and `useReport()` in `src/providers/report-provider.tsx`.

- **How a screen offers Report.** It calls `useReport()?.report(target)`. The provider is only the contract;
  `ReportHost` fills it from `app/(member)/layout.tsx`, so the feed and the profile pages never import this module
  (frontend-guidelines §2). Where nothing feeds it, Report is left out.
- **Where Report is.** A post's ••• menu (`FD-06`): "Report post" and "Report this account". A comment's and a
  reply's actions (`FD-05`). A resume and a Home Profile (`DS-05`, `DS-07`, `DS-08`), as the last, quietest
  action. Never on what is the reader's own, and never for an admin, who acts on reports and files none.
- **Own content.** The API refuses a report on the reporter's own post, comment or account with a 422 whose
  message is under `errors.target_id`. The target isn't a field of the form, so the dialog shows that message in
  full above its buttons.
- **Once per item.** A second report on the same item by the same account, while the first is open, answers 409
  `report_already_open`: the dialog closes and a toast says an admin is already reviewing it. Something that was
  deleted meanwhile (404) closes it too.
- **"Something else" needs the details**, here and on the API. The other reasons leave them optional.
- **One row per reported item** (`RP-03`). The API groups the reports on an item; its latest report stands for the
  row, and the count orders the queue. One action resolves every open report on the item.
- **Every action needs a reason** (SEC-AUTHZ-07). "Dismiss report" therefore opens the same dialog as "Choose
  action…", with Dismiss chosen. The owner reads the reason in their notification unless the report is dismissed.
- **Only what the API will accept is offered.** A profile or an account has nothing to remove, so those reports
  offer Suspend and Dismiss; an account that isn't Active can't be suspended. The API refuses both anyway
  (SEC-FE-05).
- **Restore** is on a resolved report whose content is still removed (LoFi: "Removed content can be restored from
  Resolved"), with a reason of its own. The report stays resolved.
- **Two admins on one report.** The second is answered 409 `report_already_resolved`: the dialog closes, the page
  is read again and shows what the first decided.
- **Words are text.** The reported post or comment, the reporters' details and the admin's reason are rendered as
  text; nothing in them becomes markup or a link (SEC-FE-01, SEC-FE-02). Photos come from the API's storage path
  through `next/image`.
- **Not here:** "Open account" on the review page leads to the account page of Account Administration (`AC-07`,
  FE-22).

## Requirements covered

- **FR16** — Report a profile, post, comment or account.
- **FR32** — Report a profile, post, comment or account.
- **FR34** — Suspend, reactivate or deactivate any account.
- **FR35** — Review reports; remove, restore or dismiss content or accounts.

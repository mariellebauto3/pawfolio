# Feature: Notifications (Module 9)

In-app notifications for requests, Meet & Greets, verification and announcements.

- **LoFi screen IDs:** `NT-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Notifications/`
- **API:** `docs/api/notifications.md`
- **Who does what (proposal §9):** Human — Receive · Pet — Receive · Admin — Announcements

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
| NT-01 | Alerts dropdown | Dropdown | Human, Pet | every member page (desktop top bar) | Built (FE-19) |
| NT-02 | Notifications (human) | Screen | Human | `/notifications` | Built (FE-19) |
| NT-03 | Notifications (pet) | Screen | Pet | `/notifications` | Built (FE-19) |
| NT-04 | Admin · Announcements | Screen | Admin | `/admin/announcements` | Built (FE-24) |
| NT-05 | Publish announcement dialog | Dialog | Admin | `/admin/announcements` | Built (FE-24) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built (FE-19)

| What | Where |
| --- | --- |
| The calls: the list by tab, the unread count, mark one, mark all. A row that doesn't match the contract is left out | `api/notifications.ts` |
| The Alerts count and its latest rows: asked for on load, every 60 s while the tab is visible, and when the window is looked at again (no websockets); what shows while a write is on its way. No React, so every rule is unit-tested | `hooks/alerts-store.ts` |
| The store connected to the session and the window | `hooks/use-alerts-feed.ts` |
| `AlertsFeed`: fills `useAlerts()` for the shell. Mounted once by `app/(member)/layout.tsx` | `components/alerts-feed.tsx` |
| The page's tabs and their place in the URL (`?tab=meet-and-greets&page=2`) | `schemas/tabs.ts` |
| The page's list, "Mark all as read", empty states by tab and role, loading skeleton | `components/` |
| The page (a Server Component) | `src/app/(member)/notifications/page.tsx` |

The dropdown itself (`AlertsMenu`) and the row (`NotificationRow`) are shared components: the top bar is shell UI,
and shared code can't import a feature. They read `useAlerts()` (`src/providers/alerts-provider.tsx`), which this
feature fills. The API type is `src/types/notification.ts`.

- **NT-02 and NT-03 are one page.** The API lists the caller's own notifications, so only the description and the
  empty states differ by role.
- **A row opens what it is about** (a request, the invites, a post) and is marked as read as it does. The link comes
  from the API as data, so it is followed only when `notificationHref` accepts it (SEC-FE-07).
- **The page is a history** (2026-10-10). Every notification the account ever got is listed, in sections by age
  (`schemas/history.ts`, `groupByAge`: Today, Yesterday, This week, Earlier this month, then one section per month),
  with how many there are. `components/period-filter.tsx` ("All / Last 7 days / Earlier", `?when=earlier`) goes
  straight to the older ones with the API's `period` filter, on any tab.
- **An announcement is read where its notification is** (2026-10-10). Its row shows "Announcement" and the start
  of its message, and opens the whole of it in `@/components/overlays/announcement-dialog` instead of leading to the
  feed, from the dropdown and from the page. The page's **Announcements** tab (`components/published-announcements.tsx`,
  `getPublishedAnnouncements` in `api/announcements.ts`, `GET /announcements`) lists everything published for the
  account's role, whether or not an alert was delivered for it.
- **On phones** Alerts in the tab bar opens `/notifications`; the dropdown is for the desktop top bar
  (`project-rules/ui-guidelines.md` §1).
- **Not here:** notification preferences are on Settings (`AC-01`, `AC-02`). The API can also dismiss a
  notification and mark one unread; the LoFi has no control for either.

## Built (FE-24)

| What | Where |
| --- | --- |
| The calls: the list with its audience counts, and publish or schedule. A row that doesn't match the contract is left out | `api/announcements.ts` |
| The form's limits and rules (the API's own, with the same messages), a day and a time read as Philippine time, and how an audience, a time and a result are put into words | `schemas/announcements.ts` |
| `AnnouncementForm`: title, message, audience, now or later (`NT-04`) | `forms/announcement-form.tsx` |
| `PublishAnnouncementDialog`: the preview and the last word before it goes out (`NT-05`) | `dialogs/publish-announcement-dialog.tsx` |
| `AnnouncementList`: what was published and what is scheduled, a page at a time | `components/announcement-list.tsx` |
| The page (a Server Component) | `src/app/admin/announcements/page.tsx` |

API: `docs/api/community-reports-and-admin.md`, "Announcements as the screens use them". Types:
`types/announcements.ts`. Tests: `tests/unit/features/notifications/announcements.test.ts`. Mock mode:
`src/lib/api/mock/handlers/announcements.ts`.

- **Nothing is sent before the dialog's button.** "Preview announcement" checks the form and opens `NT-05` with
  the announcement exactly as it will be sent. What was typed stays in the form if the dialog is closed or the
  API refuses a field, and is cleared once the announcement is stored.
- **The preview is the real thing.** The dialog draws the alert with `NotificationRow`, the component the Alerts
  dropdown and the Notifications page use, so an admin sees the row each account will read. In the preview it
  leads nowhere.
- **Now or later.** With "Schedule for later" the day and the time are Philippine time, like every time on the
  screens, and have to be still ahead: the form says so, and so does the API. The scheduler publishes it when
  its time comes.
- **Who gets it.** The audience shows how many Active accounts it is right now (the API counts them). An account
  that turned announcements off gets no alert and still reads it beside the feed (`FD-01`).
- **It can't be undone.** There is no edit, no delete and no cancel for a scheduled one, so the dialog says so
  before the button. Nothing in the list can be pressed; one that hasn't gone out yet is marked Scheduled.
- **An admin's words are text.** The title and the message are rendered as text wherever they show: the list,
  the preview, Alerts and the feed (SEC-FE-01).

## Requirements covered

- **FR15** — Receive notifications about requests, Meet & Greets, verification and announcements.
- **FR31** — Receive notifications about invites, requests, Meet & Greets and verification.
- **FR39** — Publish platform announcements and notifications.

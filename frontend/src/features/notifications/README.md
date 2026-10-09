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
| NT-04 | Admin · Announcements | Screen | Admin | `/admin/announcements` | Not built |
| NT-05 | Publish announcement dialog | Dialog | Admin | `/admin/announcements` | Not built |

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
- **On phones** Alerts in the tab bar opens `/notifications`; the dropdown is for the desktop top bar
  (`project-rules/ui-guidelines.md` §1).
- **Not here:** notification preferences are on Settings (`AC-01`, `AC-02`). The API can also dismiss a
  notification and mark one unread; the LoFi has no control for either.

## Requirements covered

- **FR15** — Receive notifications about requests, Meet & Greets, verification and announcements.
- **FR31** — Receive notifications about invites, requests, Meet & Greets and verification.
- **FR39** — Publish platform announcements and notifications.

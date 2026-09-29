# Feature: Notifications (Module 9)

In-app notifications for requests, Meet & Greets, verification and announcements.

- **LoFi screen IDs:** `NT-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Notifications/`
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

| ID | Name | Type | Role | Route (planned) |
| --- | --- | --- | --- | --- |
| NT-01 | Alerts dropdown | Dropdown | Human | `/feed` |
| NT-02 | Notifications (human) | Screen | Human | `/notifications` |
| NT-03 | Notifications (pet) | Screen | Pet | `/notifications` |
| NT-04 | Admin · Announcements | Screen | Admin | `/admin/announcements` |
| NT-05 | Publish announcement dialog | Dialog | Admin | `/admin/announcements` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR15** — Receive notifications about requests, Meet & Greets, verification and announcements.
- **FR31** — Receive notifications about invites, requests, Meet & Greets and verification.
- **FR39** — Publish platform announcements and notifications.

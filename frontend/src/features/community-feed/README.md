# Feature: Community Feed & Stories (Module 10)

One shuffled social feed for everyone: automatic “For Hire” posts, pet updates (also after adoption), human posts and adoption stories.

- **LoFi screen IDs:** `FD-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/CommunityFeed/`
- **Who does what (proposal §9):** Human — Post, react, comment · Pet — Post updates · Admin — Moderate

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
| FD-01 | Community feed (human) | Screen | Human | `/feed` |
| FD-02 | Community feed (pet) | Screen | Pet | `/feed` |
| FD-03 | Create post dialog | Dialog | Pet | `/feed` |
| FD-04 | Write an adoption story | Dialog | Human | `/feed` |
| FD-05 | Post detail & comments | Screen | Human | `/posts/[postId]` |
| FD-06 | Post options menu | Dropdown | Human | `/posts/[postId]` |
| FD-07 | Delete post dialog | Dialog | Human | `/posts/[postId]` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR14** — Furparent views the alumni profile and adoption details, and posts adoption stories.
- **FR17** — Post in the community feed, react and comment.
- **FR29** — Post updates to the community feed, including after adoption.

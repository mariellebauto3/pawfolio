# Feature: Profile Management (Module 2)

The two sides of every match: the pet’s résumé and the human’s Home Profile with the lifestyle quiz. Long forms are split into steps with a progress indicator.

- **LoFi screen IDs:** `PR-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Profiles/`
- **Who does what (proposal §9):** Human — Home Profile & quiz · Pet — Résumé · Admin — Moderate

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
| PR-01 | My résumé (owner view) | Screen | Pet | `/me` |
| PR-02 | Résumé in Draft | State | Pet | `/me` |
| PR-03 | Edit résumé · 1 Basics | Screen | Pet | `/resume/edit` |
| PR-04 | Edit résumé · 2 Photos | Screen | Pet | `/resume/edit` |
| PR-05 | Edit résumé · 3 About & temperament | Screen | Pet | `/resume/edit` |
| PR-06 | Edit résumé · 4 Skills & compatibility | Screen | Pet | `/resume/edit` |
| PR-07 | Edit résumé · 5 Health | Screen | Pet | `/resume/edit` |
| PR-08 | Edit résumé · 6 Review & publish | Screen | Pet | `/resume/edit` |
| PR-09 | Add photo dialog | Dialog | Pet | `/resume/edit` |
| PR-10 | Résumé published | State | Pet | `/resume/edit` |
| PR-11 | My Home Profile (Furparent) | Screen | Human | `/me` |
| PR-12 | Edit intro dialog | Dialog | Human | `/me` |
| PR-13 | Turn off Open to Adopt | Dialog | Human | `/me` |
| PR-14 | Home Profile & quiz · 1 Household | Screen | Human | `/home-profile/edit` |
| PR-15 | Home Profile & quiz · 2 Home & space | Screen | Human | `/home-profile/edit` |
| PR-16 | Home Profile & quiz · 3 Lifestyle | Screen | Human | `/home-profile/edit` |
| PR-17 | Home Profile & quiz · 4 Experience | Screen | Human | `/home-profile/edit` |
| PR-18 | Home Profile & quiz · 5 Preferences | Screen | Human | `/home-profile/edit` |
| PR-19 | Home Profile & quiz · 6 Review | Screen | Human | `/home-profile/edit` |
| PR-20 | Home Profile saved | State | Human | `/home-profile/edit` |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Requirements covered

- **FR3** — Complete and edit a Home Profile and lifestyle quiz.
- **FR4** — Turn Open to Adopt on or off.
- **FR13** — Automatically receive the Furparent label; adopted pets shown on the profile.
- **FR20** — Create and edit the résumé: photos, bio, temperament, skills, compatibility, health.
- **FR27** — Adoption status is changed only by the system, never by hand.

# Feature: Profile Management (Module 2)

The two sides of every match: the pet’s resume and the human’s Home Profile with the lifestyle quiz. Long forms are split into steps with a progress indicator.

- **LoFi screen IDs:** `PR-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/Profiles/`
- **Who does what (proposal §9):** Human — Home Profile & quiz · Pet — Resume · Admin — Moderate

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
| PR-01 | My resume (owner view) | Screen | Pet | `/me` |
| PR-02 | Resume in Draft | State | Pet | `/me` |
| PR-03 | Edit resume · 1 Basics | Screen | Pet | `/resume/edit` |
| PR-04 | Edit resume · 2 Photos | Screen | Pet | `/resume/edit` |
| PR-05 | Edit resume · 3 About & temperament | Screen | Pet | `/resume/edit` |
| PR-06 | Edit resume · 4 Skills & compatibility | Screen | Pet | `/resume/edit` |
| PR-07 | Edit resume · 5 Health | Screen | Pet | `/resume/edit` |
| PR-08 | Edit resume · 6 Review & publish | Screen | Pet | `/resume/edit` |
| PR-09 | Add photo dialog | Dialog | Pet | `/resume/edit` |
| PR-10 | Resume published | State | Pet | `/resume/edit` |
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

## Built so far

- **PR-01…PR-10 (FE-10):** `/me` for a pet (`components/my-resume.tsx`, on the shared
  `@/components/data-display/pet-resume`) and `/resume/edit` (`forms/resume-wizard.tsx`). The wizard saves a step
  when the pet leaves it with Next or presses Save draft; photos and vet records save as they are added. `?step=2`
  opens a step. The rules are pure functions in `schemas/resume-schemas.ts`, tested in
  `tests/unit/features/profiles/`. API contract: `docs/api/profiles-and-matching.md`. Live API only, no mock.
- **Dialogs with a form** (Add photo, the Remove confirmations) are rendered by the wizard beside the `Wizard`, not
  inside a step: a form can't sit inside the wizard's own form.
- **PR-11…PR-20 (FE-11):** `/me` for a human (`components/my-home-profile.tsx`, on the shared
  `@/components/data-display/home-profile-view`) and `/home-profile/edit` (`forms/home-profile-wizard.tsx`). Next
  saves a step and needs every answer the match uses; Save draft keeps whatever is answered so far. `?step=2` opens
  a step. The API marks the quiz as finished once the five steps are answered; the last button shows "Home Profile
  saved" (PR-20). The rules are pure functions in `schemas/home-profile-schemas.ts`, tested in
  `tests/unit/features/profiles/`. API contract: `docs/api/profiles-and-matching.md`. Live API only, no mock.
- **Open to Adopt** is one component (`components/open-to-adopt-toggle.tsx`) on PR-11 and PR-20: on applies right
  away, off asks first (PR-13, `dialogs/turn-off-open-to-adopt-dialog.tsx`), and it stays locked until the quiz is
  finished. The switch always shows what the API last answered.
- **Not built here:** the Adoption details dialog (AL-06) belongs to the Adoption module; "Adoption details" on an
  adopted pet links to its alumni profile until then. PR-13 doesn't show how many requests are in progress, and
  Profile views is a total, not "this month": the Home Profile API sends neither number.

## Requirements covered

- **FR3** — Complete and edit a Home Profile and lifestyle quiz.
- **FR4** — Turn Open to Adopt on or off.
- **FR13** — Automatically receive the Furparent label; adopted pets shown on the profile.
- **FR20** — Create and edit the resume: photos, bio, temperament, skills, compatibility, health.
- **FR27** — Adoption status is changed only by the system, never by hand.

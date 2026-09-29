# Frontend Guidelines (`frontend/`)

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · ESLint.
Next.js 16 differs from older versions (e.g. Middleware is now **Proxy**, `proxy.ts`). Before using an API, check the bundled
docs in `frontend/node_modules/next/dist/docs/` — see `frontend/AGENTS.md`.

## 1. Folder structure

```
frontend/
├── public/                 Static files served as-is
│   ├── icons/              App icons, favicons
│   └── images/             brand/, illustrations/, placeholders/
├── src/
│   ├── app/                ROUTES ONLY (page, layout, loading, error, not-found files)
│   │   ├── (public)/        Visitor pages: sign-in, forgot/reset password, sign-up (pet, human)      AU-01…AU-17
│   │   ├── (account-status)/ Pending / Denied / Suspended screen, edit submitted details             AU-18…AU-21
│   │   ├── (member)/        Pet & Human pages behind login (feed, matches, requests, profiles…)
│   │   ├── admin/           Admin pages (dashboard, verification, reports, requests, resolve, accounts,
│   │   │                    announcements, activity-logs)
│   │   ├── layout.tsx, page.tsx (landing, AU-01), globals.css
│   ├── features/           One folder per system module (14) — the bulk of the code lives here
│   │   └── <module>/        components/ dialogs/ forms/ hooks/ api/ schemas/ types/ + README.md
│   ├── components/         Shared, feature-agnostic UI: ui/ forms/ overlays/ feedback/ data-display/ layout/ navigation/
│   ├── lib/                api/ (HTTP client for Laravel), auth/ (session helpers), utils/
│   ├── hooks/              Hooks shared by several features
│   ├── types/              Shared domain types (Account, Pet, HomeProfile, AdoptionRequest, statuses…)
│   ├── constants/          Shared constants (status names, limits like MAX_OPEN_REQUESTS, route paths)
│   ├── config/             Typed access to environment variables and site config
│   ├── providers/          React context providers (session, toasts, query client)
│   └── styles/             Design tokens and shared CSS (colour, spacing, typography)
└── tests/                  unit/ integration/ e2e/
```

Each `src/features/<module>/README.md` lists the LoFi screens, dialogs and states that module must deliver, their planned
routes and the requirements they cover. Update it when scope changes.

## 2. Where does a file go?

| You are writing… | Put it in |
| --- | --- |
| A route (URL) | `src/app/**/page.tsx` — keep it thin: read params, compose feature components |
| UI used by one module | `src/features/<module>/components/` |
| A dialog, drawer or dropdown owned by one module | `src/features/<module>/dialogs/` |
| A form or wizard | `src/features/<module>/forms/` |
| API calls for one module | `src/features/<module>/api/` (uses `src/lib/api`) |
| UI used by two or more modules | `src/components/<category>/` |
| A type used across modules | `src/types/` |

**Import direction:** `app → features → components → lib`. Features must not import from other features' internals; if two
features need the same thing, move it to `components/`, `lib/`, `hooks/` or `types/`.

## 3. Routing

Planned routes (from the LoFi, full list in the feature READMEs):

| Area | Routes |
| --- | --- |
| Visitor | `/`, `/sign-in`, `/forgot-password`, `/reset-password`, `/sign-up`, `/sign-up/pet`, `/sign-up/human` |
| Account status | `/account-status`, `/account/edit` |
| Member | `/feed`, `/posts/[postId]`, `/matches`, `/browse`, `/search`, `/pets/[petId]`, `/homes/[homeId]`, `/me`, `/resume/edit`, `/home-profile/edit`, `/availability`, `/invites`, `/apply/[homeId]`, `/requests`, `/requests/[requestId]`, `/notifications`, `/bookmarks`, `/stats`, `/activity`, `/settings` |
| Admin | `/admin`, `/admin/verification`, `/admin/verification/[accountId]`, `/admin/reports`, `/admin/reports/[reportId]`, `/admin/requests`, `/admin/requests/[requestId]`, `/admin/resolve`, `/admin/accounts`, `/admin/accounts/[accountId]`, `/admin/announcements`, `/admin/activity-logs` |

- Route groups `(public)`, `(account-status)`, `(member)` don't appear in URLs; they share layouts (shells).
- Tabs and filters use query strings (`?tab=closed`), so views are linkable.
- Dialogs are components, not routes, unless a dialog must be shareable by URL.
- Role and account-status checks happen on the **server** (Laravel). `proxy.ts` may do optimistic redirects only.

## 4. Components and code style

- Server Components by default; add `'use client'` only for interactivity (state, effects, event handlers).
- One component per file; file name in `kebab-case`, export in `PascalCase`. Named exports, except where Next.js requires default exports (`page.tsx`, `layout.tsx`).
- Props are typed with a `type Props = {…}` next to the component. No `any`; use `unknown` and narrow.
- Keep components small; move logic to hooks (`use-*.ts`) and pure helpers.
- Use the `@/` alias for imports from `src/` (e.g. `@/components/ui/button`).

## 5. Data and API

- The backend is the Laravel API at `NEXT_PUBLIC_API_URL` (`/api/v1/...`). All HTTP goes through `src/lib/api` — never call `fetch` to the API directly from components.
- Auth uses **Laravel Sanctum SPA cookie sessions** (NFR2: session-based). Send credentials with requests; handle `401` (sign in), `403` (not allowed / account not active → status screen), `422` (show field errors).
- Types for API responses live in `src/types/` (shared) or `src/features/<module>/types/`; they mirror Laravel API Resources.
- Show loading states (`loading.tsx` or skeletons) and handle empty and error states for every data view.

## 6. Security

Follow **[security-guidelines.md](security-guidelines.md)** §6 (authoritative): render user content as text only, no secrets in
`NEXT_PUBLIC_*`, no personal data in browser storage or URLs, and never treat hidden buttons as protection.

## 7. Styling

- Tailwind CSS utility classes; shared values (colours, radii, spacing) are tokens in `src/styles/` referenced by Tailwind — no hard-coded hex values in components.
- Mobile-first: write the phone layout, then add `md:`/`lg:` for larger screens. Verify at 390 px and 1440 px.

## 8. Forms and validation

- Validate on the client for fast feedback, but the backend Form Request is authoritative.
- Client schemas live in `src/features/<module>/schemas/` and mirror the backend rules and messages.
- Adding a form or validation library requires a `docs/decisions/` record.

## 9. Testing

- `tests/unit/` — pure functions and hooks; `tests/integration/` — components with mocked API; `tests/e2e/` — key flows
  (sign-up → pending, request → approve → book → adopt). Test framework choice is recorded in `docs/decisions/` when added.

## 10. Commands

`npm run dev` (http://localhost:3000) · `npm run build` · `npm run lint`

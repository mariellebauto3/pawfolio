# Frontend data layer: API client, session, redirects, mocks

How `frontend/` talks to the Laravel API. Why it's built this way: [ADR 0004](../decisions/0004-api-client-session-and-mocks.md).
API conventions and error contract: [docs/api/README.md](../api/README.md).

## Setup

Copy `frontend/.env.example` to `frontend/.env.local`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Laravel origin |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | This app's origin (sent as `Origin` on server-side calls) |
| `NEXT_PUBLIC_API_MODE` | `live` | `mock` answers from fixtures (development only) |
| `SESSION_COOKIE_NAME` | `pawfolio-session` | Server-only; must match the backend's session cookie |

Typed access: `import { env } from "@/config/env"`. It throws at startup on a malformed URL, or on plain `http` to a
non-local host in production.

## Calling the API

```ts
// Client components and src/features/<module>/api/*.ts
import { api } from "@/lib/api/client";
import { apiPath } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";

const { data } = await api.get<ApiResource<Pet>>(apiPath`/pets/${petId}`);
const page = await api.get<Paginated<AdoptionRequest>>("/adoption-requests", { query: { page: 2 } });

try {
  await api.post(`/adoption-requests`, { home_profile_id, cover_letter });
} catch (error) {
  if (!isApiError(error)) throw error;
  if (error.kind === "validation") setFieldErrors(error.fieldErrors); // { cover_letter: "…" } → <Field error=…>
  else if (error.kind === "conflict") showRuleDialog(error.code, error.message); // e.g. open_request_limit (RQ-05)
  else toast.show(error.message, { tone: "error" });
}
```

```ts
// Server Components: same API, acting as the visitor (cookies forwarded). Reads only; nothing redirects for you.
import { getServerApi } from "@/lib/api/server";
const { data } = await (await getServerApi()).get<ApiResource<Pet>>(apiPath`/pets/${petId}`);
```

- Paths are relative to `/api/v1` and start with `/`. Never call `fetch` on the API directly.
- **Build any path that contains a value with `apiPath`** (it encodes each value). The client refuses a path that
  `..`, `.`, `\`, `?` or `#` would redirect to another endpoint, and throws before sending (SEC-FE-08). Query values
  go in `{ query }`, never in the path string.
- `ApiError.kind` is one of `unauthenticated`, `account_not_active`, `forbidden`, `not_found`, `session_expired`,
  `conflict`, `validation`, `payload_too_large`, `rate_limited`, `bad_request`, `server`, `network`. `message` is
  always safe to show.
- A cancelled request (your `signal` aborted, or your timeout fired) rejects with the abort reason itself, not an
  `ApiError`. A bug, such as an unsafe path, throws a plain `Error`. Only real network failures become `network`.
- **Files the API serves to one account** (verification documents) are read with
  `api.getFile(path, { accept: [...] })`, which resolves to a `Blob`. `accept` is required: the media types the
  screen can show safely. Any other answer is refused, because a file shown from a `blob:` address runs with this
  site's origin (SEC-FE-09). Show it with `URL.createObjectURL()` and release it with `URL.revokeObjectURL()` when
  the screen closes (`features/auth/hooks/use-document-file.ts`); never build a URL to the file itself.

## Session

`SessionProvider` (root layout) holds the account from `GET /auth/me`. The root layout looks it up on the server
(`lookUpAccount`, the same helper `proxy.ts` uses) and hands it over, so pages render with the right role from the first
paint ([ADR 0005](../decisions/0005-page-shells-and-server-seeded-session.md)); if the API doesn't answer in 2 s,
the provider loads it in the browser instead. Read it anywhere in a client component:

```ts
const { status, account, role, accountStatus, isActive, isAdmin, refresh } = useSession();
// status: "loading" | "signed-in" | "signed-out" | "error"
```

After signing in, call `refresh()`. To log out, use `useSignOut()` (`src/hooks/use-sign-out.ts`): it ends the
session and reloads the landing page, so nothing from the signed-in session stays in memory. The account is kept in React state only, never in browser storage
(SEC-FE-04). Use it to choose what to show; the API still checks every action (SEC-FE-05).

Automatic redirects from any `api` call:

- `401` on a signed-in page → `/sign-in?next=<current page>`
- `403 account_not_active` → `/account-status`

Pass `{ skipAuthRedirect: true }` where these are expected (e.g. the sign-in form).

## `proxy.ts` (optimistic redirects)

Before a page renders: signed out → `/sign-in?next=…`, not Active → `/account-status`, not an admin → away from
`/admin`. Route areas come from `src/constants/routes.ts`. If the API is down or slow (over 2 s), the request goes
through. The proxy is a convenience, never the access check (SEC-FE-06). `?next=` values are only followed if
`safeNextPath()` accepts them (SEC-FE-07).

## Mock mode

Set `NEXT_PUBLIC_API_MODE=mock` and restart `npm run dev`. Calls are answered from `src/lib/api/mock/`, with a
~250 ms delay so loading states show. The mocks enforce the same 401 / 403 rules as the API.

- **Personas:** sign in with any persona email and password `password`, or set the cookie in the browser console:
  `document.cookie = "pf_mock_persona=human; path=/"`. Personas: `pet` (Mochi, default), `human` (Ana Santos),
  `admin`, `pet-pending`, `human-pending`, `human-denied`, `human-resubmitted`, `pet-suspended`, `human-closed`
  (Jun Reyes, deactivated), `signed-out`.
  Without the cookie you are signed in as `pet`; set `signed-out` to see the sign-in screens.
- **Auth states:** a wrong password 5 times for one email pauses its sign-in for 15 minutes (until reload).
  `/reset-password#token=mock-reset-token&email=mochi%40example.com` opens a working reset link; any other token is
  "expired".
- **Sign-up:** as `signed-out`, a valid pet sign-up signs you in as `pet-pending` and a human one as
  `human-pending`, whatever was typed; nothing is stored. A persona's email (e.g. `mochi@example.com`) is "already
  taken", which shows how the wizard returns to the step with the error.
- **Account status:** `pet-pending`, `human-pending`, `human-denied`, `pet-suspended` and `human-closed` each show
  their screen at `/account-status` (`AU-18`, `AU-20`, `AU-21`, closed). "Save and resubmit" on `/account/edit` as
  `human-denied` signs you in as `human-resubmitted` (the same account, Pending again); what was typed isn't stored.
  Sign in as `carla.mendoza@example.com` to see the denial again.
- **Admin verification:** as `admin`, `/admin/verification` lists 23 waiting accounts (two pages). Approving or
  denying one is remembered in the `pf_mock_decisions` cookie, so the pages rendered on the server, the sidebar count
  and a later sign-in agree: approve Kulit, then sign in as `kulit@example.com` to land in the member shell; deny
  Bea Navarro, then sign in as `bea.navarro@example.com` to read your reason on the Denied screen and resubmit.
  Documents are drawn on request (a PNG or a small PDF), whatever format the fixture names. To get the fixture queue
  back, run `document.cookie = "pf_mock_decisions=; path=/; max-age=0"`.
- **Adding mocks:** add a file in `src/lib/api/mock/handlers/` and register it in `handlers/index.ts`. Follow the
  planned shape in `docs/api/` so switching to `live` changes nothing. Created records live in memory until reload.
- All fixture data is made up (SEC-PRIV-06).
- Production builds always use `live`.

## Tests

`npm test` runs `frontend/tests/unit/` (Vitest, [ADR 0003](../decisions/0003-vitest-for-unit-tests.md)): error
mapping, the CSRF and retry flow, URL building, redirects and `safeNextPath`, env parsing and the mock gates.

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

### Running against the real API (`live`)

- Start Laravel (`php artisan serve`) with this app's origin in its `SANCTUM_STATEFUL_DOMAINS` and
  `CORS_ALLOWED_ORIGINS`, then set `NEXT_PUBLIC_API_MODE=live` and restart `npm run dev`.
- Run `php artisan storage:link` once in `backend/`. Uploaded photos are served from
  `${NEXT_PUBLIC_API_URL}/storage/…`; without the link they answer 404.
- `next.config.ts` lets `next/image` load photos from that path and from nowhere else. A photo from another origin
  needs its own entry there.
- The demo accounts (`DemoSeeder`) all sign in with the password `password`, e.g. `mochi@example.com` (Active pet),
  `kulit@example.com` (Pending), `carla.mendoza@example.com` (Denied), `biscuit@example.com` (Suspended),
  `admin@example.com`. Local databases only.

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

A server-side call gives up after 10 seconds (`SERVER_CALL_TIMEOUT_MS`) and fails as a network error, so a page
whose API doesn't answer shows its error state with "Try again" instead of a loading skeleton that never ends.

- Paths are relative to `/api/v1` and start with `/`. Never call `fetch` on the API directly.
- **Build any path that contains a value with `apiPath`** (it encodes each value). The client refuses a path that
  `..`, `.`, `\`, `?` or `#` would redirect to another endpoint, and throws before sending (SEC-FE-08). Query values
  go in `{ query }`, never in the path string.
- `ApiError.kind` is one of `unauthenticated`, `account_not_active`, `forbidden`, `not_found`, `session_expired`,
  `conflict`, `validation`, `payload_too_large`, `rate_limited`, `bad_request`, `server`, `network`. `message` is
  always safe to show.
- A cancelled request (your `signal` aborted, or your timeout fired) rejects with the abort reason itself, not an
  `ApiError`. A bug, such as an unsafe path, throws a plain `Error`. Only real network failures become `network`.
- **Check what a list answered** with the readers in `src/lib/api/readers.ts` (`readPage`, `isPet`, `isHome`): a
  page that isn't a page is refused, and a row that doesn't match the contract is left out. Discovery and Matching
  share them; a module that lists pets or homes should too.
- **Files the API serves to one account** (verification documents) are read with
  `api.getFile(path, { accept: [...] })`, which resolves to a `Blob`. `accept` is required: the media types the
  screen can show safely. Any other answer is refused, because a file shown from a `blob:` address runs with this
  site's origin (SEC-FE-09). Show it with `URL.createObjectURL()` and release it with `URL.revokeObjectURL()` when
  the screen closes (`features/auth/hooks/use-document-file.ts`); never build a URL to the file itself.

## Session

`SessionProvider` (root layout) holds the account from `GET /auth/me`. The root layout looks it up on the server with
`renderAccount`, which is memoized for the render: the layout, a page that needs the account, and the guest-only guard
all share one call. It hands the account over, so pages render with the right role from the first paint
([ADR 0005](../decisions/0005-page-shells-and-server-seeded-session.md)). `proxy.ts` keeps its own short-lived lookup
(`lookUpAccount`) because it answers in 2 s or gives up, which is the right trade for an optimistic redirect. If the API
doesn't answer, the provider loads the session in the browser instead. Read it anywhere in a client component:

```ts
const { status, account, role, accountStatus, isActive, isAdmin, refresh } = useSession();
// status: "loading" | "signed-in" | "signed-out" | "error"
```

A server page that reads differently by role (Browse, a resume, a Home Profile) gets the account with
`requireAccount(returnTo)` (`src/lib/auth/require-account.ts`): the layout's lookup again, sign-in when signed out.

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
- **Discovery:** `/browse`, `/search`, `/pets/[petId]` and `/homes/[homeId]` (FE-12) are answered from the fixtures:
  as `human` you browse three pets (with made-up match scores), as `pet` two homes. Mochi has an open request with
  Ana Santos (`/homes/1` shows "View my request") and Luna (`/pets/4`) is the alumni profile. There aren't enough
  fixtures to fill a second page; use `live` to see pagination. The mock doesn't check filter values the way the
  API's Form Requests do (422); the screens only send known ones.
- **Matching:** `/matches` (FE-13) is answered from the same fixtures and made-up scores: as `human` three pets
  for Ana Santos, as `pet` two homes for Mochi, with the breakdown dialog on each. The Open to Adopt switch is left
  out, since the Home Profile endpoints have no mock. No persona is an Active human without the quiz or an Active
  pet with a Draft, so the two empty states (`MT-04`, `MT-05`) show in `live` only.
- **Bookmarks and invites:** `/bookmarks` and `/invites` (FE-14) are answered from memory: as `human` three saved
  pets (one adopted since), as `pet` two saved homes and two invites. Mochi already has a request with both homes
  that invited, so both invite cards show "View my request"; the Apply, cooldown and "Not accepting requests" cards
  need `live`. What you save, remove, send or dismiss is kept by whichever side made the call, so a page rendered on
  the server doesn't see what the browser changed, and a reload brings the fixtures back.
- **Adoption requests:** `/requests`, `/requests/[requestId]` and `/apply/[homeId]` (FE-15) are answered from
  memory. As `pet`, Mochi has three requests: Meet Scheduled with Ana Santos, On Hold with Paolo Garcia
  (`/requests/2`, `RQ-15`) and Declined by Marco Reyes a week ago (`/requests/5`, `RQ-17`), so `/homes/4` opens
  the cooldown dialog (`RQ-06`) and `/homes/3` shows "View my request". Mochi is In Process, so no home offers
  the form: the Sent state (`RQ-14`), Send request (`RQ-03`, `RQ-04`) and the limit dialog (`RQ-05`) need
  `live`. As `human` (FE-16), Ana Santos's inbox has one of each: Pepper's request is new (`/requests/3`, `RQ-11`,
  with Approve and Decline), Mochi's is in progress and Tofu's is closed. Withdrawing, approving and declining
  work in the browser, but the page that follows is rendered on the server, which still has the fixtures: the
  toast shows and the status doesn't change. Use `live` to see an answer through.
- **No mock for the pet resume:** `/me` and `/resume/edit` (FE-10) were built on the real `/me/pet` endpoints. In mock
  mode they show the error state; use `live` for them.
- **Adding mocks:** add a file in `src/lib/api/mock/handlers/` and register it in `handlers/index.ts`. Follow the
  planned shape in `docs/api/` so switching to `live` changes nothing. Created records live in memory until reload.
- All fixture data is made up (SEC-PRIV-06).
- Production builds always use `live`.

## Tests

`npm test` runs `frontend/tests/unit/` (Vitest, [ADR 0003](../decisions/0003-vitest-for-unit-tests.md)): error
mapping, the CSRF and retry flow, URL building, redirects and `safeNextPath`, env parsing and the mock gates.

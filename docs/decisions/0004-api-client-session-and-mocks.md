# 0004. One API client, session from `/auth/me`, and mock mode

- **Status:** accepted
- **Date:** 2026-10-01

## Context
Every screen talks to the Laravel API with Sanctum SPA cookie sessions (SEC-AUTH-01). Screens need to be built
before their endpoints exist, and `proxy.ts` needs the user's role and account status to redirect early (SEC-FE-06).
The Laravel session cookie is encrypted and HttpOnly, so Next.js can't read anything from it.

## Decision
1. **One client** in `frontend/src/lib/api/`, with interchangeable transports:
   - browser: `credentials: "include"`, fetches `/sanctum/csrf-cookie` before the first write, echoes `X-XSRF-TOKEN`,
     and retries once on 419;
   - server (Server Components, `proxy.ts`): forwards the visitor's cookies and sends our origin;
   - mock: answers from fixtures.

   Every failure becomes one `ApiError` with a `kind` (see `docs/api/README.md`).
2. **Types mirror API Resources in snake_case** (`src/types/`). There's no camelCase conversion layer, so a type
   reads the same as its `docs/api/` entry and the JSON in dev tools.
3. **The session is `GET /api/v1/auth/me`.** `SessionProvider` loads it in the browser. `proxy.ts` asks the same
   endpoint with the visitor's cookies. It skips the call when there is no session cookie, and lets the request
   through if the API doesn't answer within 2 s. We chose this over a readable "role/status hint" cookie because the
   hint can go stale (e.g. after a suspension) and needs extra backend code.
4. **Mock mode** (`NEXT_PUBLIC_API_MODE=mock`) answers from `src/lib/api/mock/`. It enforces the same 401 / 403 gates
   as the API, and the persona is chosen by the `pf_mock_persona` cookie. It is development-only: the env parser
   forces `live` in production builds.

## Consequences
- The backend owns the contract in `docs/api/`: the `/auth/me` shape, the 403 `account_not_active` code, and
  user-friendly `message` text for 403/409/429.
- Each signed-in page navigation costs one `/auth/me` call from the Next.js server. Revisit (short cache or hint
  cookie) if it shows up in performance tests.
- Mock handlers must follow the documented endpoint shapes. When an endpoint lands, delete its mock or keep it in
  sync.

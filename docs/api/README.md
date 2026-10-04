# Pawfolio API

The Laravel API under `/api/v1`, used only by the Next.js frontend. This file holds the conventions every endpoint
follows. Each module gets its own file listing its endpoints (method, path, role, request, response, errors, FR):

- [auth.md](auth.md) — Session, Sign-Up, Account Status, and Admin Verification (`BE-03`–`BE-08`)
- [discovery.md](discovery.md) — Discovery, Search, Profile Detail, Vet Records, and Recently Hired (`BE-14`)
- [profiles-and-matching.md](profiles-and-matching.md) — Pet Résumé, Home Profile Quiz, Compatibility Matches, Bookmarks, and Invites (`BE-11`–`BE-13`, `BE-15`)
- [adoption-and-meet-greet.md](adoption-and-meet-greet.md) — Adoption Requests, Meet & Greet, Adoption Decisions, and Admin Resolution (`BE-16`–`BE-20`)
- [community-reports-and-admin.md](community-reports-and-admin.md) — Community Feed, Reports, Account Settings, Announcements, Analytics, and Activity Logs (`BE-10`, `BE-21`–`BE-26`)

Rules: `project-rules/backend-guidelines.md` §2 and `security-guidelines.md` §5 and §7.
Frontend client: `frontend/src/lib/api/` ([ADR 0004](../decisions/0004-api-client-session-and-mocks.md)).

## Requests

- Base URL: `${NEXT_PUBLIC_API_URL}/api/v1`. Paths are plural `kebab-case` nouns. State changes are action endpoints
  (`POST /adoption-requests/{id}/approve`), never a `status` field.
- Every request sends `Accept: application/json` and `X-Requested-With: XMLHttpRequest`, so Laravel answers errors
  as JSON (no HTML pages, no redirects).
- Query strings: booleans are `1`/`0`, arrays are `key[]=a&key[]=b`.
- Bodies are JSON, except uploads, which are `multipart/form-data`. PHP reads a multipart body only on `POST`, so an
  upload to a `PATCH` or `PUT` endpoint is sent as `POST` with `_method=PATCH` in the form (Laravel method spoofing),
  e.g. `PATCH /account/submission`.

## Responses

| Case | Shape |
| --- | --- |
| One item | `{ "data": { … } }` |
| List | `{ "data": [ … ], "meta": { current_page, last_page, per_page, total, from, to, path }, "links": { first, last, prev, next } }`. Always paginated: default 20, max 50 (SEC-API-05) |
| No content | `204` with an empty body |

Field names are `snake_case`. Dates are ISO 8601 strings in UTC. Statuses are the `snake_case` enum values.

## Errors

Every error body is `{ "message": string, "code"?: string, "errors"?: { field: string[] } }`. The frontend maps
the status to an `ApiError` kind:

| Status | When | `code` | Frontend kind → what the user sees |
| --- | --- | --- | --- |
| 401 | Not signed in / session ended | — | `unauthenticated` → sent to `/sign-in?next=…` |
| 403 | Account isn't Active (Pending, Denied, Suspended, Deactivated) — SEC-AUTHZ-06 | **`account_not_active`** (required) | `account_not_active` → sent to `/account-status` |
| 403 | Wrong role, e.g. a pet on an admin endpoint | none | `forbidden` → `message` shown |
| 404 | Missing, or exists but this user may not know it (SEC-AUTHZ-04) | — | `not_found` → not-found state |
| 409 | A business rule blocks the action (proposal §5) | e.g. `open_request_limit`, `request_already_open`, `request_cooldown`, `not_open_to_adopt` | `conflict` → `message` shown; screens may use `code` for a specific dialog (`RQ-05`, `RQ-06`) |
| 419 | CSRF token missing or expired | — | `session_expired`; the client refreshes the token and retries once |
| 422 | Validation failed | — | `validation` → `errors` shown next to each field (first message per field) |
| 413 | Upload larger than the server accepts | — | `payload_too_large` → "That file is too large…" |
| 429 | Rate limited (e.g. sign-in lockout, SEC-AUTH-04) | — | `rate_limited` → `message` shown; `Retry-After` header in seconds |
| Other 4xx | e.g. 400, 405 | — | `bad_request` → generic "check what you entered" message |
| 5xx | Server error | — | `server` → generic message. The server's text is never shown (SEC-API-02) |

`message` must be user-friendly for 403, 409 and 429, because the frontend shows it as-is. For other statuses the
frontend uses its own copy.

## Sessions (Sanctum SPA)

The frontend calls `GET /sanctum/csrf-cookie` before its first write, then sends the `XSRF-TOKEN` cookie's value as
`X-XSRF-TOKEN` on every `POST`/`PUT`/`PATCH`/`DELETE`. For this to work, the backend needs (BE-02):

- `$middleware->statefulApi()` in `bootstrap/app.php`, so `/api/*` requests from the SPA get sessions and CSRF checks.
- `SANCTUM_STATEFUL_DOMAINS` listing the frontend host(s), e.g. `localhost:3000` (and the staging/production hosts).
- CORS (`config/cors.php`): paths `api/*` and `sanctum/csrf-cookie`; `allowed_origins` = the frontend origin(s) only;
  `supports_credentials` = `true` (SEC-API-03); `allowed_headers` must include `X-XSRF-TOKEN`, `X-Requested-With`,
  `Content-Type` and `Accept` (the default `*` does); `exposed_headers` = `['Retry-After']`. Without the last one,
  the browser hides `Retry-After` from JavaScript on cross-origin answers, and the sign-in lockout countdown (`AU-03`)
  can't be shown.
- Session cookie `HttpOnly`, `SameSite=Lax`, `Secure` in production (SEC-AUTH-06). Frontend and API must share a
  registrable domain (e.g. `app.example.com` and `api.example.com` with `SESSION_DOMAIN=.example.com`).
  Locally, `localhost:3000` and `localhost:8000` share cookies as they are.

Checked on 2026-10-01 against a local Laravel 12 with only `statefulApi()` enabled. The client got the CSRF cookie
before the first write, Laravel refused a write without the token (419), a stale token was refreshed and the write
retried, and the session cookie (`pawfolio-session`, HttpOnly, SameSite=Lax) identified the user to both the browser
and the server-side client. CORS was not part of that check (it was run outside a browser).

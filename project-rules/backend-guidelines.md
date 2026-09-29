# Backend Guidelines (`backend/`)

**Stack:** Laravel 12 · PHP 8.2 · REST JSON API consumed by the Next.js frontend. Laravel renders no pages.
Laravel 13 requires PHP 8.3; upgrade PHP first before changing the framework version.

## 1. Folder structure

Laravel's standard layout is kept; module code is grouped **inside each layer** using the module folder names from
`general-development-guidelines.md` (Auth, Profiles, Discovery, Matching, Bookmarks, AdoptionRequests, MeetAndGreet,
Adoption, Notifications, CommunityFeed, Reports, Accounts, Analytics, ActivityLogs).

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/V1/<Module>/   Thin controllers: validate (Form Request) → call action/service → return Resource
│   │   ├── Requests/<Module>/             Form Requests: validation rules + authorize()
│   │   ├── Resources/<Module>/            API Resources: the JSON shape sent to the frontend
│   │   └── Middleware/                    Custom middleware (e.g. ensure account is Active, admin only)
│   ├── Models/                            Eloquent models (one per table), relationships, casts, scopes
│   ├── Enums/                             Backed enums: Role, AccountStatus, PetStatus, RequestStatus, MeetStatus, ReportStatus…
│   ├── Actions/<Module>/                  One business operation per class: ApproveAdoptionRequest, AdoptPet, SuspendAccount…
│   ├── Services/<Module>/                 Reusable domain logic spanning several actions: MatchScoreCalculator, RequestLimits…
│   ├── Policies/                          Authorization per model (who may view/update/approve…)
│   ├── Events/ · Listeners/               Domain events (RequestApproved, PetAdopted…) and their reactions (notify, log)
│   ├── Notifications/                     In-app notifications (database channel)
│   ├── Jobs/                              Queued / scheduled work: expire requests (14 days), Meet & Greet reminders, overdue flags
│   ├── Observers/                         Model observers, e.g. writing activity logs
│   ├── Support/                           Small shared helpers that don't belong to a module
│   └── Providers/
├── database/  migrations/ factories/ seeders/
├── routes/
│   ├── api/v1/                            One route file per module (e.g. adoption-requests.php), loaded under /api/v1
│   ├── web.php · console.php              Scheduled jobs are registered in console.php
├── storage/app/private/                   Verification documents (never public)
└── tests/  Feature/<Module>/  Unit/<Module>/
```

## 2. API design

- Base path `/api/v1`. Resources are plural `kebab-case` nouns: `/pets`, `/home-profiles`, `/adoption-requests`, `/meet-and-greets`.
- Standard verbs: `GET` list/show, `POST` create, `PATCH` update, `DELETE` remove. **State transitions are explicit action
  endpoints**, never a generic status update: `POST /adoption-requests/{id}/approve`, `/decline`, `/withdraw`, `/adopt`.
- Admin endpoints live under `/api/v1/admin/...` and require the `admin` role.
- Responses use API Resources: `{ "data": … }` for single items, `{ "data": [...], "meta": {pagination}, "links": {...} }` for lists.
- Errors: `401` unauthenticated, `403` forbidden or account not Active, `404` not found or hidden, `409` rule conflict
  (e.g. 3 open requests, cooldown), `422` validation with `{ "message", "errors": { field: [..] } }`. Messages are user-friendly.
- Paginate every list (default 20). Filter and sort with query parameters (`?species=dog&sort=match`).
- Document every endpoint in `docs/api/` (method, path, role, request, response, errors, FR).

## 3. Layers and responsibilities

- **Controllers** stay thin. No business rules in controllers.
- **Form Requests** validate input and check `authorize()` against a Policy.
- **Actions** own each state change and run it in a **database transaction**. After success they dispatch events.
- **Events/Listeners** send notifications and write activity logs, so every change is recorded the same way.
- **Resources** decide what each role may see (hide contact details until a Meet & Greet is confirmed — NFR4).

## 4. Business rules (proposal Section 5) — always enforced here

- Only **Active** accounts can send, receive, book, post or report; pending/denied/suspended accounts get `403` (NFR2).
- Statuses change only through actions (FR27, NFR3). No endpoint accepts a raw `status` field from users.
- Max **3 open requests** per pet, only **1 in process**; one request per pet + human; **30-day cooldown** after Declined/Not Adopted.
- When a request is approved, the pet becomes In Process and its other open requests go On Hold; they return to Sent (fresh 14 days) if it ends without adoption.
- Sent requests expire after **14 days**; approved requests without a booking expire after 14 days (reminder at 7).
- Meet & Greet booking only after approval; Adopt/Decline only after the meeting time; reminders 1 day and 1 hour before; overdue flag 7 days after.
- On Adopt: pet → Adopted — Hired (permanent), linked to one Furparent; human gets the Furparent label; other open requests close.
- Humans receive requests only while Open to Adopt is on; turning it off doesn't cancel requests in progress.
- Matching: dealbreakers first (species, kids, other pets, same province), then weighted score (20/15/15/15/15/10/10).
- Each rule has a Feature test.

## 5. Auth and security

Security rules are defined in **[security-guidelines.md](security-guidelines.md)** (authoritative). Backend essentials:
Sanctum SPA cookie sessions (SEC-AUTH-01), Policies on every model (SEC-AUTHZ-01/02), Form Request validation and
no mass-assignable `role`/`status` (SEC-INPUT-01…04), private storage for documents (SEC-PRIV-01, SEC-FILE-*).
Roles: `pet`, `human`, `admin`; admin accounts are created by seeders/commands only (SEC-AUTH-10).

## 6. Logging and accountability (NFR9)

- Every admin action and every status change writes an activity log entry: actor (user or `system`), action, target, before, after, reason, timestamp.
- Admin actions that need a reason (deny, suspend, reactivate, deactivate, resolve, report action) reject requests without one.
- Log entries are append-only — no update or delete endpoints.

## 7. Code style

- Follow PSR-12 / Laravel conventions; format with **Laravel Pint** (`./vendor/bin/pint`).
- Type-hint parameters and return types. Use enums instead of string literals for statuses and roles.
- Use Eloquent relationships and eager loading (`with()`) to avoid N+1 queries.
- Config through `config/*.php` and `.env`; never call `env()` outside config files.

## 8. Commands

`php artisan serve` (http://127.0.0.1:8000) · `php artisan migrate` · `php artisan test` · `./vendor/bin/pint`

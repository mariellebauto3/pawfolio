# Security Guidelines

> **This is Pawfolio's authoritative security document.** Security rules in other files point here; if any file conflicts
> with this one, this file wins (see the order of precedence in `README.md`).

| | |
| --- | --- |
| **Owner** | The whole team; changes need review like any other rule |
| **Applies to** | `frontend/`, `backend/`, database, deployment, and any new module or feature |
| **Version** | 1.14 · 2026-10-10 — see the changelog at the end |

## 0. Baseline and cross-references

These guidelines are based on the **Senior Security Claude Skill** (`.claude/skills/senior-security/`) and must be
cross-referenced with it. Each section below maps to one of the skill's areas:

| Senior Security skill area | Where it is applied here |
| --- | --- |
| Security architecture patterns | §2 Principles, §4 Architecture |
| Threat modeling | §3 Threat model |
| Security auditing | §9 Finding vulnerabilities, §10 Feature checklist |
| Penetration testing | §9.3 Manual security testing |
| Cryptography implementation | §8 Cryptography and secrets |
| Skill's security best practices: *validate all inputs, use parameterized queries, implement proper authentication, keep dependencies updated* | §5.3, §6.2, §5.1, §7.2 |

**Current state of the skill (checked 2026-09-28):** its reference files are unfilled templates and its scripts
(`threat_modeler.py`, `security_auditor.py`, `pentest_automator.py`) run but report no findings. Don't treat a clean script run as
evidence of security. Until the skill has real content, the concrete rules here come from:

- **OWASP ASVS 4.0** (Level 2 target) — verification requirements for web apps
- **OWASP Top 10 (2021)** and **OWASP API Security Top 10 (2023)** — the most common vulnerability classes
- **Laravel** and **Next.js** official security documentation
- **The Pawfolio proposal** — NFR2 (security), NFR3 (data integrity), NFR4 (privacy), NFR9 (accountability), Section 5 status rules

When the skill gains real content, compare it with this file and record any change in the changelog.

**Wording:** **MUST** = required, a PR that breaks it is not merged. **SHOULD** = expected; skipping it needs a reason in
the PR. **MAY** = optional. Rules have IDs (e.g. `SEC-AUTH-03`) so PRs and reviews can cite them.

## 1. What we protect

| Asset | Why it matters |
| --- | --- |
| Verification documents (ID photos, vet records) | Identity theft if leaked; admin-only by requirement (NFR4) |
| Contact numbers and exact addresses | Physical safety of adopters and caretakers; revealed only after a confirmed Meet & Greet (NFR4) |
| Accounts and sessions | Takeover lets an attacker act as a pet caretaker, adopter or admin |
| Adoption status and history | Integrity of the core flow: status changes only through the system (FR27, NFR3) |
| Admin powers and activity logs | Abuse or tampering undermines trust and accountability (NFR9) |
| The animals themselves | The platform must not become a channel for selling or trading animals |

## 2. Principles

1. **Server-side enforcement.** The frontend is untrusted. Every rule is checked by the Laravel API (NFR2, NFR3).
2. **Deny by default.** Nothing is readable or writable unless a policy explicitly allows it for that role and account status.
3. **Least privilege.** Users, admins, database accounts, API keys and servers get only the access they need.
4. **Privacy by default.** Collect the minimum, reveal the minimum, keep sensitive files private.
5. **Defence in depth.** Validation, authorization, output encoding, security headers and monitoring each stop what the others miss.
6. **Everything important is logged.** Admin actions and status changes are recorded with who, what, when and why.
7. **Secure by design.** Security is part of the design of every feature (§10), not something bolted on after.

## 3. Threat model

Review this table whenever a module is added or changed. New threats get the next ID.

| ID | Threat | Example in Pawfolio | Main mitigations |
| --- | --- | --- | --- |
| T01 | Account takeover | Password guessing on `/sign-in`; stolen session cookie | SEC-AUTH-01…08 |
| T02 | Broken object-level authorization (IDOR) | Pet A opens `/requests/{id}` of pet B; human reads another human's thread | SEC-AUTHZ-01…04 |
| T03 | Privilege escalation | A user sends `role=admin` or `status=adopted` in a request | SEC-AUTHZ-05, SEC-INPUT-04 |
| T04 | Blocked accounts acting | Pending/suspended account calls the API directly | SEC-AUTHZ-06 |
| T05 | Exposure of private data | Contact number in an API response before confirmation; ID photo served from a public URL | SEC-PRIV-01…06, SEC-FILE-04 |
| T06 | Injection | SQL injection via search/sort parameters | SEC-INPUT-01…03 |
| T07 | Cross-site scripting (XSS) | Script in a pet bio, cover letter, post or comment | SEC-FE-01…03, SEC-HDR-01 |
| T08 | Cross-site request forgery (CSRF) | Another site triggers "Withdraw request" for a signed-in user | SEC-AUTH-06 |
| T09 | Malicious file upload | Script disguised as an image; huge files; GPS data in photo EXIF | SEC-FILE-01…06 |
| T10 | Fake or fraudulent accounts | Fake pet profiles selling animals; stolen-ID sign-ups | Verification (FR33), reports (FR35), SEC-ABUSE-01…04 |
| T11 | Abuse and spam | Mass requests, invite spam, harassment in threads | SEC-ABUSE-01…04, SEC-API-04 |
| T12 | Admin misuse or mistakes | Suspending without reason; editing logs | SEC-LOG-01…05, SEC-AUTHZ-07 |
| T13 | Vulnerable dependencies | Known CVE in an npm or Composer package | SEC-DEP-01…05 |
| T14 | Leaked secrets | `.env` or API keys committed to git | SEC-SECRET-01…05 |
| T15 | Insecure deployment | Debug mode on in production; database open to the internet | SEC-DEPLOY-01…08 |
| T16 | Open redirect | A phishing link `/sign-in?next=https://evil.example` sends a user to a fake site right after they sign in; a notification whose stored link leaves the site | SEC-FE-07 |
| T17 | Client-side path traversal | A link to `/requests/..%2F..%2Fadmin%2Faccounts%2F5%2Fsuspend` makes the page send a signed-in write, CSRF token included, to another endpoint | SEC-FE-08 |
| T18 | Active content in a served file | A file stored as an "ID" is really HTML or SVG; shown from a `blob:` address or in a new tab, its script runs as the admin's own page | SEC-FE-09, SEC-FILE-01 |

## 4. Architecture

- **SEC-ARCH-01 (MUST)** The browser talks only to the Next.js frontend and the Laravel API over **HTTPS**. The database and file storage are never reachable from the internet directly.
- **SEC-ARCH-02 (MUST)** All business rules, authorization and validation live in the backend. The frontend only reflects them.
- **SEC-ARCH-03 (MUST)** Trust boundaries are explicit: browser → API (untrusted input), API → database/storage (trusted, least-privilege credentials).
- **SEC-ARCH-04 (SHOULD)** Keep external services to a minimum; each new one (email, SMS, storage, analytics) gets a `docs/decisions/` record covering what data it receives.

## 5. Authentication, sessions and input

### 5.1 Authentication (OWASP A07)

- **SEC-AUTH-01 (MUST)** Use **Laravel Sanctum SPA** cookie-session authentication (NFR2). No tokens in `localStorage` or `sessionStorage`.
- **SEC-AUTH-02 (MUST)** Hash passwords with Laravel's default hasher (bcrypt/argon2). Never store, log or email plain passwords.
- **SEC-AUTH-03 (MUST)** Passwords: at least 8 characters with a letter and a number (LoFi `AU-06`); reject known-breached passwords (`Password::uncompromised()`).
- **SEC-AUTH-04 (MUST)** Rate-limit sign-in: after 5 failed attempts, pause 15 minutes per account + IP (LoFi `AU-03`). Also rate-limit sign-up, forgot-password and verification resubmission.
- **SEC-AUTH-05 (MUST)** Don't reveal whether an email exists: identical responses for "forgot password" (`AU-05`) and generic sign-in errors.
- **SEC-AUTH-06 (MUST)** Session cookies are `HttpOnly`, `Secure` (in production) and `SameSite=Lax`; CSRF protection is enabled for all state-changing requests (Sanctum CSRF cookie).
- **SEC-AUTH-07 (MUST)** Regenerate the session ID on sign-in; invalidate it on sign-out and on password change (other devices signed out, LoFi `AC-04`).
- **SEC-AUTH-08 (MUST)** Password-reset links are single-use and expire in 30 minutes.
- **SEC-AUTH-09 (SHOULD)** Admin accounts use two-factor authentication once available; admin sessions time out after 30 minutes of inactivity.
- **SEC-AUTH-10 (MUST)** Admin accounts are created only by seeder/console command, never through public sign-up.

### 5.2 Authorization (OWASP A01, API1, API5)

- **SEC-AUTHZ-01 (MUST)** Every endpoint checks **who** (authenticated), **what role** (pet / human / admin) and **which record** (ownership or relationship) via Laravel Policies.
- **SEC-AUTHZ-02 (MUST)** Never trust IDs from the client. Load the record, then authorize it against the current user (prevents IDOR).
- **SEC-AUTHZ-03 (MUST)** Request details, threads and Meet & Greet data are visible only to the pet account, the human on that request, and admins.
- **SEC-AUTHZ-04 (MUST)** Missing and forbidden records the user must not know about return `404`, not `403`, so IDs can't be probed.
- **SEC-AUTHZ-05 (MUST)** Roles and statuses can't be set through regular endpoints (see SEC-INPUT-04). Status changes happen only in Actions (FR27).
- **SEC-AUTHZ-06 (MUST)** Middleware blocks every member endpoint for accounts that are not **Active**; they can only reach the account-status and edit-submission endpoints (§5.1 of the proposal).
- **SEC-AUTHZ-07 (MUST)** Admin endpoints live under `/api/v1/admin/*`, require the admin role, and require a reason for deny, suspend, reactivate, deactivate, resolve and report actions.
- **SEC-AUTHZ-08 (MUST)** Business limits are enforced atomically in a transaction: 3 open requests, 1 in process, 1 request per pet + human, 30-day cooldown, one Furparent per pet.

### 5.3 Input validation (OWASP A03)

- **SEC-INPUT-01 (MUST)** Validate every input on the server with Form Requests: type, length, format, allowed values.
- **SEC-INPUT-02 (MUST)** Use Eloquent / the query builder with bound parameters. No string-concatenated SQL; `DB::raw` only with constants.
- **SEC-INPUT-03 (MUST)** Sorting and filtering use **allow-lists** of column names; unknown values are rejected.
- **SEC-INPUT-04 (MUST)** Protect against mass assignment: models declare `$fillable`; `role`, `status`, `*_at` milestone fields and foreign keys to other users are never fillable from requests.
- **SEC-INPUT-05 (MUST)** Enforce server-side the rules shown in the UI: age 18+ for humans, required reasons, text length limits (e.g. cover letter 50–600 characters).
- **SEC-INPUT-06 (SHOULD)** Normalize input (trim whitespace, normalize emails to lowercase) before validation.

## 6. Frontend (`frontend/`)

- **SEC-FE-01 (MUST)** Render user content (bios, cover letters, posts, comments, messages) as plain text through React. `dangerouslySetInnerHTML` is forbidden unless the content is sanitized with a vetted library and the PR explains why.
- **SEC-FE-02 (MUST)** Links from user content open with `rel="noopener noreferrer"`; only `http`/`https` URLs are allowed.
- **SEC-FE-03 (MUST)** Never put secrets in frontend code or `NEXT_PUBLIC_*` variables — everything shipped to the browser is public.
- **SEC-FE-04 (MUST)** Don't store personal data (contact numbers, addresses, documents) in `localStorage`, `sessionStorage` or URLs.
- **SEC-FE-05 (MUST)** Hiding a button is not security. Every action hidden in the UI is also blocked by the API.
- **SEC-FE-06 (SHOULD)** `proxy.ts` may redirect unauthenticated users early, but is never the only authorization check.
- **SEC-FE-07 (MUST)** Redirect targets taken from the URL (e.g. `?next=` after sign-in) must be same-site paths; check them with `safeNextPath()` (`src/lib/auth/redirects.ts`) and fall back to the home page. A link stored as data is checked the same way before it is rendered: a notification's `action_url` goes through `notificationHref()` (`src/lib/utils/notification-href.ts`), and one it refuses is shown without a link.
- **SEC-FE-08 (MUST)** Build API paths that contain values with `apiPath` (`src/lib/api/core.ts`), which encodes each value; never splice route params or user input into a path string. The client refuses paths that `..`, `.`, `\`, `?` or `#` would change.
- **SEC-FE-09 (MUST)** Read files the API serves (verification documents) with `api.getFile` and an `accept` list of the types the screen can show: JPG, PNG and PDF. The client refuses anything else. Show the file from memory (`blob:`), release it when the screen closes, and never give a document a URL of its own.

## 7. Backend, API and dependencies

### 7.1 API

- **SEC-API-01 (MUST)** API Resources decide which fields each role sees. Never return a whole model (`toArray()`) to the client.
- **SEC-API-02 (MUST)** Error responses never contain stack traces, SQL or file paths. `APP_DEBUG=false` outside local development.
- **SEC-API-03 (MUST)** CORS allows only the frontend origin(s), with credentials; Sanctum `stateful` domains list only those origins.
- **SEC-API-04 (MUST)** Rate-limit writes that can be abused (requests, invites, reports, posts, comments, messages) per user.
- **SEC-API-05 (MUST)** Every list is paginated with a maximum page size (e.g. 50) to prevent data scraping and heavy queries.
- **SEC-API-06 (SHOULD)** Scheduled jobs (expiry, reminders, overdue flags) run with system identity and are logged like user actions.

### 7.2 Dependencies (OWASP A06)

- **SEC-DEP-01 (MUST)** Commit lock files (`package-lock.json`, `composer.lock`).
- **SEC-DEP-02 (MUST)** Run `npm audit` (frontend) and `composer audit` (backend) before each release and when adding packages. High and critical findings block the release.
- **SEC-DEP-03 (MUST)** Before adding a package, check that it is maintained, widely used, and needed. Prefer framework features.
- **SEC-DEP-04 (SHOULD)** Update dependencies at least monthly; apply security patches as soon as practical.
- **SEC-DEP-05 (MUST)** Run supported versions of PHP, Node.js, Laravel and Next.js (security-patched releases only).

## 8. Data, files, cryptography and secrets

### 8.1 Privacy (NFR4)

- **SEC-PRIV-01 (MUST)** Verification documents are admin-only, stored on the private disk, and served through an authorized admin endpoint.
- **SEC-PRIV-02 (MUST)** Contact numbers and exact addresses are returned only to the two parties of a **confirmed** Meet & Greet, and to admins when needed.
- **SEC-PRIV-03 (MUST)** Public profiles show only the city and a household summary (humans) or the pet's public resume.
- **SEC-PRIV-04 (MUST)** Collect only data the proposal requires. New personal-data fields need a documented purpose.
- **SEC-PRIV-05 (MUST)** Deactivation hides the profile immediately; retained records (adoption history, logs) stay access-controlled.
- **SEC-PRIV-06 (MUST)** Seed and test data are fake. Never use real people's names, IDs, photos or numbers.
- **SEC-PRIV-07 (SHOULD)** Follow the Philippine Data Privacy Act of 2012 (RA 10173) principles: consent at sign-up, purpose limitation, access on request.

### 8.2 File uploads

- **SEC-FILE-01 (MUST)** Allow only JPG, PNG (photos) and PDF (documents); validate by content type and by inspecting the file, not the extension alone. No SVG or HTML uploads.
- **SEC-FILE-02 (MUST)** Maximum 5 MB per file; limit the number of files per request.
- **SEC-FILE-03 (MUST)** Store under random, server-generated file names; never use the uploaded name in paths.
- **SEC-FILE-04 (MUST)** Public photos (pets, posts) may use public storage; documents never do.
- **SEC-FILE-05 (MUST)** Re-encode uploaded images and strip EXIF metadata (it can contain the GPS location of a foster home).
- **SEC-FILE-06 (SHOULD)** Scan uploads for malware when a scanning service is available in the hosting environment.

### 8.3 Cryptography

- **SEC-CRYPTO-01 (MUST)** Use framework and platform crypto only (Laravel hashing and encryption, TLS). Never write custom cryptography.
- **SEC-CRYPTO-02 (MUST)** HTTPS/TLS everywhere outside local development, with HSTS in production.
- **SEC-CRYPTO-03 (MUST)** `APP_KEY` is unique per environment, secret, and never committed. Rotating it is planned (it invalidates encrypted values and sessions).
- **SEC-CRYPTO-04 (SHOULD)** Encrypt at rest (Laravel `encrypted` casts) the most sensitive columns: contact numbers, street addresses, ID numbers if ever stored.
- **SEC-CRYPTO-05 (MUST)** Tokens for password reset, email verification and similar use Laravel's secure generators; never predictable values.

### 8.4 Secrets

- **SEC-SECRET-01 (MUST)** Secrets live only in `.env` files (local) or the host's secret settings (production). Commit only `.env.example` with placeholders.
- **SEC-SECRET-02 (MUST)** Never paste secrets into code, docs, issues, PRs, chat or AI prompts.
- **SEC-SECRET-03 (MUST)** A leaked secret is rotated immediately, then removed from history if needed, and reported to the team.
- **SEC-SECRET-04 (SHOULD)** Run a secret scanner (e.g. `gitleaks`) before pushing, and in CI once it exists.
- **SEC-SECRET-05 (MUST)** Use different credentials for local, staging and production.

## 9. Logging, monitoring and abuse

### 9.1 Logging (NFR9, OWASP A09)

- **SEC-LOG-01 (MUST)** Log every admin action and every status change: actor, action, target, before, after, reason, time.
- **SEC-LOG-02 (MUST)** Log security events: sign-ins, failed sign-ins, lockouts, password changes, permission denials on admin endpoints.
- **SEC-LOG-03 (MUST)** Never log passwords, session cookies, tokens, full ID numbers or document contents.
- **SEC-LOG-04 (MUST)** Activity logs are append-only: no update or delete endpoint, including for admins.
- **SEC-LOG-05 (SHOULD)** Review security logs weekly during the pilot; alert on repeated lockouts or admin permission denials.

### 9.2 Abuse prevention

- **SEC-ABUSE-01 (MUST)** Every account is verified by an admin before it can act (FR1, FR18, FR33).
- **SEC-ABUSE-02 (MUST)** Reports are available on profiles, posts, comments and accounts (FR16, FR32); "Selling or trading animals" is a report reason.
- **SEC-ABUSE-03 (SHOULD)** Flag posts and messages that mention prices or payment (e.g. "₱", "reservation fee") for admin review.
- **SEC-ABUSE-04 (MUST)** Suspension immediately ends the account's sessions and hides its profile.

## 10. Finding and fixing vulnerabilities

### 10.1 Security checklist for every new feature or module

Copy into the PR description for any feature that touches data, auth or files:

- [ ] Threats reviewed against §3; new threats added to the table
- [ ] Every endpoint has a Policy check (role, account status, ownership) — SEC-AUTHZ-01…06
- [ ] All inputs validated server-side with Form Requests; sort/filter allow-listed — SEC-INPUT-01…05
- [ ] No mass-assignable `role`, `status` or milestone fields — SEC-INPUT-04
- [ ] API Resources expose only fields this role may see; private data hidden until allowed — SEC-API-01, SEC-PRIV-02
- [ ] User content rendered as text; no `dangerouslySetInnerHTML` — SEC-FE-01
- [ ] API paths with values built with `apiPath`; `?next=`-style redirects checked with `safeNextPath` — SEC-FE-07, SEC-FE-08
- [ ] Uploads validated, renamed, stripped, stored in the right disk — SEC-FILE-01…05
- [ ] Files from the API read with `api.getFile` and an allow-list of types, shown from memory only — SEC-FE-09
- [ ] Abusable writes rate-limited — SEC-API-04
- [ ] Admin actions require a reason and are logged — SEC-AUTHZ-07, SEC-LOG-01
- [ ] Feature tests for: unauthenticated, wrong role, non-Active account, another user's record, invalid input
- [ ] No secrets or real personal data in the change — SEC-SECRET-01, SEC-PRIV-06

### 10.2 Automated checks

| Check | Tool | When |
| --- | --- | --- |
| Dependency vulnerabilities | `npm audit`, `composer audit` | Adding packages, before release, CI |
| Secrets in code | `gitleaks` (or similar) | Before push, CI |
| Static analysis | ESLint (frontend); Larastan/PHPStan (backend, when adopted) | Every PR |
| Security tests | Laravel Feature tests for authz, validation, limits | Every PR |
| Senior Security skill scripts | `threat_modeler.py`, `security_auditor.py`, `pentest_automator.py` | Only once they contain real checks (currently templates) |

### 10.3 Manual security testing (before each release / demo)

Follow the skill's penetration-testing area, using OWASP WSTG as the method:

1. Try each role against another role's endpoints and against other users' records (IDOR).
2. Try every action as a Pending, Denied and Suspended account.
3. Send forbidden fields (`role`, `status`) and out-of-order state changes (adopt before the meeting, book before approval).
4. Put script tags and long strings in every text field; upload wrong file types and oversized files.
5. Check that contact details and documents never appear in responses where they shouldn't.
6. Check security headers and cookie flags in the browser dev tools.

Record results in `docs/architecture/security-test-log.md` (create it at the first test run).

### 10.4 Handling a vulnerability

1. **Report** it privately to the team lead — not in a public issue or channel.
2. **Rate** its severity:

   | Severity | Examples | Fix target |
   | --- | --- | --- |
   | Critical | Account takeover, access to ID documents, admin access | Immediately; block release |
   | High | IDOR on requests/threads, stored XSS, contact data leak | Within 2 days; block release |
   | Medium | Missing rate limit, verbose errors, weak header config | Within 1 week |
   | Low | Hardening improvements | Next planned cycle |

3. **Fix** it on a `fix/security-<short-desc>` branch with a test that proves the fix (commit scope `security`).
4. **Check** for the same flaw elsewhere in the codebase.
5. **Record** it in §12 and, if it teaches a new rule, add the rule here.

## 11. Deployment and configuration

- **SEC-DEPLOY-01 (MUST)** Production: `APP_ENV=production`, `APP_DEBUG=false`, HTTPS enforced, `SESSION_SECURE_COOKIE=true`.
- **SEC-DEPLOY-02 (MUST)** Security headers: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), a restrictive `Permissions-Policy`.
- **SEC-DEPLOY-03 (MUST)** The database accepts connections only from the backend; its user has only the privileges the app needs (no superuser).
- **SEC-DEPLOY-04 (MUST)** Production secrets are set in the host's environment settings, not in files in the repository.
- **SEC-DEPLOY-05 (MUST)** Back up the database regularly; backups are access-controlled and restorable (test a restore at least once).
- **SEC-DEPLOY-06 (MUST)** Don't expose development tools in production (Telescope, debug bars, `phpinfo`, directory listings).
- **SEC-DEPLOY-07 (SHOULD)** Deploy only from `main` after the release checklist (audit, tests, manual checks §10.3) passes.
- **SEC-DEPLOY-08 (MUST)** Keep the server OS, PHP and Node.js on security-patched versions.

## 12. Known risks and security decisions

Update this table as risks are found, accepted or fixed.

| Date | Item | Decision / status |
| --- | --- | --- |
| 2026-09-28 | Senior Security skill references and scripts are unfilled templates | Rules sourced from OWASP ASVS/Top 10 + framework docs; revisit when the skill is updated |
| 2026-09-28 | Verification is manual (no automatic ID checks) | Accepted for the pilot; automatic checks are future scope (proposal §10) |
| 2026-09-28 | No two-factor authentication yet | Accepted for the pilot; SEC-AUTH-09 recommends it for admins |
| 2026-09-28 | Production database and hosting not chosen | Apply §11 when the ADR is written |
| 2026-10-01 | Frontend mock API mode (fixtures instead of Laravel) could hide missing server checks or ship to production | Development-only: forced off in production builds (`src/config/env.ts`); mocks enforce the same 401/403 gates; fixtures are fake (SEC-PRIV-06). ADR 0004 |
| 2026-10-03 | LoFi `AU-19` shows the owner their current ID photo, but documents are admin-only (SEC-PRIV-01, NFR4) | The owner sees what was sent (kind, format, date), never the file; the API sends no path or URL for it. An owner preview would need its own authorized endpoint and a rule change here |
| 2026-10-04 | The admin's checklist on `AU-23`/`AU-24` is ticked in the browser and isn't sent, so the API can't tell whether the checks were made | Accepted for the pilot: Approve asks for every check to be ticked first, and the decision is logged with the admin's name (SEC-LOG-01). Storing the checks would need a column and a rule change here |
| 2026-10-04 | The document viewer (`AU-23`, `AU-24`) shows files from `blob:` addresses | When the Content-Security-Policy is written (SEC-DEPLOY-02), allow `blob:` in `img-src` and `frame-src` only |
| 2026-10-08 | Contact details on a confirmed Meet & Greet (`MG-07`, `MG-08`): the LoFi's `MG-05` shares them in one click | Confirm asks first and says what is shared. The API sends `contacts` only while a meeting is confirmed (and after its time, for the decision); a reschedule, a proposal or a cancellation hides them again. The screen renders them as text from the page's own answer: no browser storage, no URL, no `tel:` link (SEC-FE-04, SEC-PRIV-02) |
| 2026-10-09 | The LoFi's request thread (`RQ-11`, `MG-03`, `MG-07`, `AL-04`) would be a private channel admins can't read and nobody can report (T11, SEC-ABUSE-02) | Not built: messaging is future scope in the proposal (§10), and its API and table are removed. The rules that name threads (T02, T11, SEC-AUTHZ-03) apply if it returns, and it then needs a way to report a message and a rule change here |
| 2026-10-09 | `GET /api/v1/adoptions/{id}` answered any signed-in Active account with the adoption's cover letter and timeline (T02; High by §10.4). Found while wiring FE-18, before any release | Fixed with FE-18: `AdoptionPolicy` lets only the pet, its Furparent and admins read it, and anyone else is answered 404 (SEC-AUTHZ-02…04), with a test for each reader. Looked for the same flaw in the other reads of a private record (requests, notifications, bookmarks, vet records): each checks whose it is |
| 2026-10-09 | Contact details after the Meet & Greet (`MG-11`, `MG-12`, `AL-04`): with no request thread, the two sides have no other way to arrange the handover | The API keeps sending `contacts` to the two sides of the request while the decision is open and once it is Adopted, and the request page renders them as text, as on `MG-07`. A decline after the meeting, a cancellation or "It didn't happen" hides them again. The adoption record (`AL-06`) carries none (SEC-PRIV-02, SEC-FE-04) |
| 2026-10-09 | Notifications (`NT-01`…`NT-03`): `action_url` is stored data, and `POST /api/v1/notifications` lets an account write its own with any URL (T16). `body` can carry another account's words (an invite's note, a comment) (T07) | The screens follow a link only when `notificationHref()` accepts it: a path on this site, among the member pages; anything else is a row without a link. Title and body are rendered as text (SEC-FE-01). The top bar's background count never redirects and stops after a 401 or a 403 `account_not_active` |
| 2026-10-09 | The community feed (`FD-01`…`FD-07`): any Active account's words and photos are shown to every other one (T07), a post can carry an address that leads off the site (T10, T11), and a post names its author | Titles, posts and comments are rendered as text and nothing in them is made into a link, so a pasted address can't be followed with a click (SEC-FE-01, SEC-FE-02). Photos are shown only from the API's storage path, through `next/image`. A post's type and its author are never sent: the API takes them from the session (SEC-AUTHZ-02, SEC-INPUT-04). The author block carries the public line only (breed, city, the Furparent label), and a name links to a profile only when the API says this viewer may open it (`is_profile_viewable`, the profile's own policy; SEC-PRIV-03, SEC-AUTHZ-04) |
| 2026-10-09 | A suspended or deactivated account's posts and comments were left out of the feed and of search, but still answered by their own address: `GET /api/v1/posts/{id}`, commenting and liking worked, and its comments stayed listed on other posts (SEC-ABUSE-04, SEC-PRIV-05; Medium by §10.4). Found while wiring FE-20, before any release | Fixed with FE-20: the feed's endpoints hide what a non-Active account wrote (`byActiveAuthor` on `Post` and `Comment`), answer 404 for it like something that never existed (SEC-AUTHZ-04), and count only what is listed; admins still read such a post to moderate. Nothing is deleted, so a reactivated account's words return. A test covers each endpoint for both statuses. Looked for the same flaw in the other reads of posts: search already left them out |
| 2026-10-09 | Posts and comments can't be reported from the feed yet: Report (`FD-06`, `FD-05`) is built with Reports & Moderation (`RP-01`, FE-21), after the feed (SEC-ABUSE-02) | Closed with FE-21: Report is on every post, comment, resume and Home Profile that isn't the reader's own, and admins review the queue (`RP-03`…`RP-05`). The feed and FE-21 are released together |
| 2026-10-09 | Reports & Moderation (`RP-01`…`RP-05`): a report names another account and carries a member's words (T07, T11); the queue shows who reported whom; an action removes content or suspends an account (T12) | A report never carries who is reporting or a status: both are the session's and the system's (SEC-AUTHZ-02, SEC-INPUT-04). One open report per account per item, and never on one's own or on an admin. The queue's filters are allow-listed (SEC-INPUT-03). Reporters' names and words are shown to admins only, as text (SEC-FE-01); a reporter is told that a report was reviewed, never what was decided. Every action needs a reason, is written to the activity log, and is done once: a second admin is answered 409 (SEC-AUTHZ-07, SEC-LOG-01). The dialog offers only the actions the API accepts for that report (SEC-FE-05) |
| 2026-10-10 | Settings and Account Administration (`AC-01`…`AC-10`) were wired to BE-23, which had three faults: changing the password and saving a contact number failed with a server error, and a suspension left the account's requests open while a human's own deactivation left their pet stuck In Process (proposal §5.3; Medium by §10.4). Found while wiring FE-22, before any release | Fixed with FE-22: one action each for suspend, deactivate and closing an account's requests, used by the owner's, the admin's and the report's endpoints, with a test for each. Only an Active account is suspended and only a suspended one reactivated (proposal §5.1); every admin action needs a reason and is logged (SEC-AUTHZ-07, SEC-LOG-01). A change to a locked detail is held to its sign-up rule (SEC-INPUT-05), and its supporting document is served to admins only, read with `api.getFile` and shown from memory (SEC-PRIV-01, SEC-FE-09). Contact details stay in the form's state only (SEC-FE-04). The admin's account page carries no contact number or address (SEC-PRIV-02) |
| 2026-10-10 | The admin's monitor and Resolve adoption issue (`RQ-18`, `RQ-19`, `MG-15`, `MG-16`, `AL-07`…`AL-09`) were wired to BE-20, which had two faults. Resolve applied any of its four actions to any pet and request, so an admin's slip could set an adopted pet In Process, close an Adopted request while the pet stayed linked, or free a pet by closing a request that wasn't the one in process (FR27, NFR3, T12; High by §10.4). And a request's record sent both sides' phone numbers and the human's street address to the admin once a meeting was confirmed (SEC-PRIV-02; Medium). Found while wiring FE-23, before any release | Fixed with FE-23: one action (`ResolveAdoptionIssue`) holds the rules, each of the four applies to one situation only and anything else is answered 409, checked again inside the transaction with the pet's row locked (SEC-AUTHZ-08), with a test for each. The screen asks the API what applies and offers only that (SEC-FE-05); it sends an action, a request and the reason, never a status. The reason is required, both accounts read it in plain words, and every change is logged with the admin's name (SEC-AUTHZ-07, SEC-LOG-01). The admin's request record and list carry no contact number or address, and the monitor's filters are allow-listed (SEC-INPUT-03). An admin's reminder goes to the side with the next step, once a day per request, and is logged. Looked for the same flaw in the other admin reads of a request: the account page lists names and statuses only |
| 2026-10-10 | Announcements (`NT-04`, `NT-05`): an admin's words go to every Active account's Alerts and beside the feed (T07), and one press reaches all of them and can't be taken back (T12). BE-24 published a scheduled announcement at once when its time had already passed (Low by §10.4). Found while wiring FE-24, before any release | The title and the message are rendered as text everywhere, the preview included, and nothing in them is made into a link (SEC-FE-01, SEC-FE-02). Publishing is two steps: the form, then a dialog that shows the alert as it will be read, to whom and when, and says it can't be edited, taken back or, once scheduled, cancelled. A time that has passed is refused by the form and by the API (422) instead of published. Who publishes and whether it is published are the session's and the system's, never the body's (SEC-AUTHZ-02, SEC-INPUT-04); only an Active admin lists or publishes (SEC-AUTHZ-07), publishing is rate-limited (SEC-API-04), and each announcement is logged with the admin's name (SEC-LOG-01). Cancelling a scheduled announcement would need an endpoint and a rule change here |
| 2026-10-10 | Stats and the platform dashboard (`AN-01`…`AN-03`): a member's numbers are about other accounts' behaviour (who viewed, who bookmarked), and the admin's are about every account (SEC-PRIV-03, SEC-PRIV-02, T05). "Where views come from" needs the page a visitor came from (SEC-FE-04). BE-25 counted "Pets matched" over pets no longer listed and drew the views chart in UTC days (Low by §10.4). Found while wiring FE-25, before any release | Whose stats `/stats` answers with is the session's, never a parameter (SEC-AUTHZ-02), and an admin is refused. Counts only: no answer names a viewer or a bookmarker, and a stats or dashboard row of a request carries no `contacts`, whatever its status, with a test for it (SEC-PRIV-02). The dashboard is for an Active admin only (SEC-AUTHZ-07) and carries no email, document or address. The resume page reads the request's Referer on the server and sends only a name from a fixed list (`matches`, `browse`, …), and only when the page is on this site; the address and its query never leave the page. Names on the screens are rendered as text (SEC-FE-01). The two counting faults are fixed with FE-25, each with a test |
| 2026-10-10 | Activity logs (`LG-01`…`LG-04`) were wired to BE-26, which had three faults. A member's own activity named the admin who decided about their account and carried the admin's reason, which can name another account (SEC-API-01, SEC-ABUSE-02; Medium by §10.4). An account with no pet and no Home Profile was answered with every request's entries (T02, SEC-AUTHZ-02; Medium). And the log's filters were taken as typed (SEC-INPUT-03; Low). The log also leaves the site as a CSV file (T05, T18). Found while wiring FE-26, before any release | Fixed with FE-26: one presenter decides what each reader sees. A member's entry has no reason, no id and no raw user agent, and an admin is "An admin"; a report against the account is not in its activity at all. Each kind of record is matched only when the account has one. Filters go through Form Requests and an unknown value is 422; the search binds its value and escapes `%` and `_`. A test covers each. The log stays read-only: no write endpoint, and the model refuses an update or a delete (SEC-LOG-04), with a test that every write verb is 405. An export is the same view as the list (a member's has no Reason column), is read with `api.getFile` accepting `text/csv` only, and is handed to the browser as a download, never opened as a page (SEC-FE-09); a cell that would start a formula is written as text. Names and reasons are rendered as text (SEC-FE-01). Looked for the same scoping flaw in the other reads of "my" records (requests, notifications, bookmarks, stats): each starts from the account's own id |

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-09-28 | First version, written during scaffolding |
| 1.1 | 2026-10-01 | FE-04: threats T16 (open redirect) and T17 (client-side path traversal), rules SEC-FE-07 and SEC-FE-08; mock-mode decision in §12 |
| 1.2 | 2026-10-03 | FE-08: decision in §12 that owners don't get their verification documents back on `AU-19` |
| 1.3 | 2026-10-04 | FE-09: threat T18 (active content in a served file), rule SEC-FE-09 and its checklist line; decisions in §12 on the admin checklist and on `blob:` in the CSP |
| 1.4 | 2026-10-08 | FE-17: decision in §12 on how contact details are shared and shown on a confirmed Meet & Greet |
| 1.5 | 2026-10-09 | FE-30: decision in §12 that the request thread is not built |
| 1.6 | 2026-10-09 | FE-18: §12 records the adoption record's access fix, and that contact details stay on a request while its decision is open and once it is Adopted |
| 1.7 | 2026-10-09 | FE-19: SEC-FE-07 covers links stored as data (a notification's `action_url`), T16 names them, and §12 records how notifications are read and linked |
| 1.8 | 2026-10-09 | FE-20: §12 records how the community feed shows other people's words, photos and names, the fix that hides a non-Active account's posts and comments, and that reporting from the feed waits for FE-21 |
| 1.9 | 2026-10-09 | FE-21: §12 closes the feed's open item on reporting and records how reports are filed, read and acted on |
| 1.10 | 2026-10-10 | FE-22: §12 records the account settings and administration faults fixed while wiring BE-23, and how settings and account actions are protected |
| 1.11 | 2026-10-10 | FE-23: §12 records the Resolve adoption issue and request record faults fixed while wiring BE-20, and how the monitor and a resolution are protected |
| 1.12 | 2026-10-10 | FE-24: §12 records how announcements are published, shown and logged, and the scheduling fault fixed while wiring BE-24 |
| 1.13 | 2026-10-10 | FE-25: §12 records how stats and the platform dashboard keep to counts, how a view's source is read, and the counting faults fixed while wiring BE-25 |
| 1.14 | 2026-10-10 | FE-26: §12 records the activity log faults fixed while wiring BE-26, what a member and an admin each read of an entry, and how the CSV export is protected |

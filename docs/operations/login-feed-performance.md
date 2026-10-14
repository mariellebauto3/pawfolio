# Login and home data loading

Active Pet/Human accounts land on `/feed`; active Admins land on `/admin`; other account statuses land on
`/account-status`. Sign-in preserves Sanctum CSRF, password verification, account/IP lockouts, role/status checks,
security audit logging, and a fresh document to discard the previous account's client state. Laravel's login guard
already regenerates the session ID; the action now rotates CSRF without migrating that same session twice.
Pet authentication reads the first avatar path in the profile query instead of making a separate photo query.

## Member home

The server checks `/auth/me` once per render and seeds the browser session provider. Home then reads a 10-post
cursor batch with a small profile card and scalar counts, and three matching suggestion summaries. It no longer
opens the full own-profile, Invites or Bookmarks list endpoints to construct cards. Suggestions stream under
Suspense; they do not hold back the feed. The notification unread count remains necessary shared navigation data;
it loads after mount and polls once a minute while visible. Notification rows load only when the dropdown/page
is opened. Overlapping count and session checks are deduplicated.

Cursor continuation reads do not count the whole feed, repeat announcements/home cards, or use offsets. The
existing visibility predicates and `(created_at DESC, id DESC)` order apply to every batch. An observer with a
400px margin requests at most one batch at a time, deduplicates IDs, preserves already edited/liked rows, stops
at exhaustion, and pauses on errors until the user retries. Unmount aborts pending requests. Post author/media
relationships are batch-loaded; reaction state uses an indexed existence subquery. Comment bodies remain on
the post detail page. Media retains fixed frames and lazy loading. Post forms/options are separate lazy chunks.

## Admin home and safe caching

The admin layout authorizes the session before rendering. Sidebar counts stream independently from the dashboard
instead of blocking its shell. Dashboard reports eager-load the reported users' display profiles to avoid N+1
lookups. Adoption totals/average duration and monthly trends aggregate in SQL rather than hydrating all historical
adoptions/requests in PHP. Month boundaries retain Asia/Manila semantics.

Only aggregate tiles/trends are cached, for at most 15 seconds, in the configured `READ_CACHE_STORE` (file by
default). Names, attention lists, private fields, authentication and authorization are never cached here. Database
triggers advance an authoritative revision on relevant committed writes; each hit checks that revision, so bulk
updates and rollbacks are handled correctly. A time-bucket key expires clock-dependent counts without writes.
Database/app-specific keys prevent reuse across different environments. Transaction reads bypass the shared cache.
Cache outages fall back to the database. For multiple instances prefer the existing shared Redis store; no new
cache service is required for local development.

## Module loading and connections

Authenticated navigation, profile/post links and module pagination explicitly disable Next.js speculative
prefetching. Modules fetch their data when opened. One server render shares one API client, deduplicating identical
successful GETs inside that cookie context; failures are retryable and writes clear that render's reads. No global
cache stores user API responses. Next.js still reuses its existing navigation/back-forward state; mutation flows
continue to refresh the affected data, and sign-in/out replace the document to isolate accounts.

## Going back to a page (2026-10-14)

Before this, every click on a module asked for it again: Browse, then Requests, then Browse made the same Browse
request twice, each with its own `/auth/me` and data call. A page that was opened is now kept in the tab's memory
for 30 seconds (`experimental.staleTimes.dynamic` in `frontend/next.config.ts`) and shown again without a request.
It is memory of one tab only: a reload, sign-in and log-out start from nothing, and the API authorizes every
request as before.

What keeps a kept page true:

- Every write the browser's `api` client sends and the API accepts drops all kept pages, by rendering the open
  page again (`PageCacheSync`, `src/lib/utils/page-refresher.ts`). No screen lists which pages it affects. Writes
  in a burst share renders: the first is answered at once, the rest by one more render a second later.
- A new notification does the same (`onArrival` in the Alerts store), so what another account did (a request
  approved, an invite) shows without waiting 30 seconds. A change by another account that sends no notification
  (a home turning Open to Adopt off) is seen up to 30 seconds late, where it used to be seen on the next click.
- Marking one notification as read, noting an admin section as opened, signing in and logging out pass `keepPages`
  and render nothing again for it.

Known cost: about twenty screens already call `router.refresh()` after their own write (withdraw, book a slot,
remove a bookmark from the list). Those writes now render the open page twice. It is invisible and they are
occasional; removing the screens' own calls is the tidy-up, left out here to keep the change small.

Prefetching stays off, the main tabs included. Measured on a production build with a 250 ms network delay: without
prefetch a first click on a tab shows its skeleton after 290 ms; with it, after 15 ms; the page itself arrives at
the same time either way. Prefetching the five tabs cost 7 more requests on every page load and 3 more after
every write. Prefetching only on hover showed the generic page skeleton first and the tab's own a moment later,
which reads as a flicker. Neither was worth it next to a return visit that now costs nothing.

Checked in headless Chrome against a scratch database (never the shared one), as a pet: Browse, Requests, Browse
made no request for the second Browse and showed it in under 200 ms; after 32 seconds it was asked for again. A
home saved from a card on Homes for You was on the Bookmarks page opened seconds earlier. A like kept the feed's
loaded posts. A notification written for the account rendered the open Requests page again on the next count.
Log-out and sign-in by the form rendered nothing again before the new document.

Run migrations before using the new dashboard revision cache and cursor-filter indexes. Existing indexes already
cover case-insensitive emails, feed ordering, reaction ownership and profile/count foreign keys. The new indexes
cover visible feed cursor scans restricted to an author or type; full-feed cursors reuse the existing partial index.

The Supabase session pooler and PostgreSQL one-shot prepared-query options remain intact. Do not enable persistent
PDO connections blindly or weaken hashing/session checks to hide latency. The measured local-to-Supabase
connection handshake was roughly 800–865ms and warm queries roughly 100–140ms; fewer API requests/queries reduce
that cost. The Linux container already configures four PHP workers. Windows `php artisan serve` handles one request
at a time; production latency and concurrency should be assessed using the deployed worker runtime near the database.

## Validation (2026-10-14)

- Laravel: 369 tests passed, 5,495 assertions. Includes stable tied-date cursors during inserts/deletes, hidden
  authors, likes, invalid cursor types, role/status guards, home count visibility, lightweight match ranking,
  cache expiry/invalidation/rollback/outage fallback, and existing authentication/adoption/moderation workflows.
- Frontend: 858 tests passed; TypeScript, ESLint and the production build passed. New checks cover cursor contracts,
  deduplication without losing optimistic edits/likes, GET isolation and interleaved writes, slow notification
  reads, and refreshing counts after a write overtakes an earlier read.
- Headless Chrome: real demo logins reached Pet/Human `/feed`, Admin `/admin`, and pending `/account-status`.
  A controlled in-browser 25-post fixture verified initial 10-row state, automatic continuation, failure pause,
  explicit retry, duplicate removal, exhaustion without extra requests, and the lazy composer. Test posts were
  not written to Supabase. Desktop viewport was 1440px; the open composer had no horizontal overflow at 390px.
- The new additive migration was applied successfully to the configured Supabase database. A live metrics read
  used 13 queries in 4,528.8ms; two immediate hits used one revision query in 131.7ms and 114.6ms. These measurements
  exclude connection setup and attention-list queries; they are not complete login or deployed p95 measurements.

Security review retained Sanctum sessions and CSRF rotation, bcrypt cost, account/IP lockouts, active-account and
role middleware, owner-derived home summaries, per-batch visibility, and audit logging. Cursor fields and post-type
filters are validated before SQL; parameter values are bound. The cache contains aggregate counts/trends only and
never authorizes access. No new write permissions, private fields, dependencies, or upload mechanisms were added.

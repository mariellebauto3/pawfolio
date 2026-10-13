# Authentication optimization validation

Implemented on 2026-10-13. No production migrations or deployments were run. A read-only preflight against the configured remote PostgreSQL database was subsequently completed before opening the PR.

## Changes

- A unique `LOWER(email)` expression index matches case-insensitive login and uniqueness validation. Stored addresses and existing constraints remain intact. The password broker also retrieves legacy mixed-case addresses through a case-insensitive Eloquent provider.
- Login fetches only authentication fields. Login and `/auth/me` fetch only the profile identity, display name and avatar path. Avatar lookup selects only its path. Registration reuses newly created profiles and the pet's known empty public gallery.
- Password breach verification sends only the five-character SHA-1 prefix, retains response padding, uses one-second connection and three-second total timeouts, caches validated prefix responses for five minutes and applies a ten-second outage cooldown. Outages, empty and malformed responses fail closed with a retryable password validation error. This intentionally strengthens Laravel's original fail-open outage behavior. Invalid local password rules stop before external verification.
- Failed-login counters, lockout creation and successful-login reset share an atomic cache lock. A second lockout check prevents in-flight requests from overriding an established lockout. Contention returns 429 with a one-second retry, without waiting on another request. Hashing and audit writes occur outside the critical section. Missing accounts perform bcrypt verification at the configured work factor using a fixed dummy hash.
- Production lockouts use `AUTH_LOCKOUT_STORE=database` by default, independently of the general cache. Only stores supporting shared locks are accepted in production. The existing `cache` and `cache_locks` tables suffice; no additional service is required.
- Image headers reject sources over 16 million pixels or 12,000 pixels per side before GD decoding. Already-small images skip bitmap duplication and resampling, while retaining JPEG quality 85, PNG compression 6, alpha preservation, metadata removal and the 1920-pixel output limit. Images stay sequential to bound per-request memory; no thread or process pool was added.
- Registration hashes passwords outside database transactions. Transaction failures and duplicate races delete uploaded files; partial pet uploads also clean up earlier successful uploads. Storage writes must succeed before metadata is returned, and failed writes attempt cleanup of their own path. Committed registrations retain their files if later session operations fail.
- Supabase storage requests have a three-second connection timeout, fifteen-second operation timeout and one retry. These bounds still permit significant latency across several uploads and must be measured with the deployed storage region.
- The existing Docker runtime enables CLI OPcache and builds configuration, route and view caches at startup using runtime environment variables. The four-worker deployment architecture remains unchanged.

The expression-index approach follows [PostgreSQL's expression index guidance](https://www.postgresql.org/docs/15/indexes-expressional.html). Lock operations use [Laravel's cache locks](https://api.laravel.com/docs/12.x/Illuminate/Cache/Lock.html).

## Local evidence

PHP 8.2.12, SQLite in-memory tests, bcrypt cost 4 for tests; production hashing cost was not reduced.

Latest pre-PR full-suite run: **326 tests, 3,608 assertions passed**, 47.368 seconds and 98 MB reported test-process memory. These are test-suite measurements, not production request latency or memory benchmarks. Laravel Pint and `git diff --check` passed.

| Indicator | Original behavior replayed | New behavior |
| --- | --- | --- |
| Human registration action and response: profile SELECTs | 2 | 0 |
| Pet registration action and response: profile/gallery SELECTs | 3 | 0 |
| Two breach checks for one cached prefix | 2 external calls without caching | 1 external call |
| Two uncached passwords during an external outage | Separate external calls | 1 external call during cooldown |
| External breach request timeout | Framework default 30 seconds | 3 seconds configured maximum |

Profile counts replay the old unconditional relationship reload against the same newly created account. Tests compare the entire response before and after that replay. They do not represent total HTTP endpoint query counts or production request timings. HTTP assertions use fakes, so they establish request elimination and failure handling, not real service latency.

Regression coverage includes login and lockout behavior, generic unknown-account errors, legacy email uniqueness and broker lookup, breach thresholds/cache/outages, malformed and extreme images, private uploads, partial upload cleanup, database rollback after profile creation, duplicate-email races, and registration response equivalence. Route and view cache generation succeeded locally. Docker image build and production OPcache behavior remain unverified.

## Deployment and remaining measurements

Before migration, review:

```sql
SELECT LOWER(email), COUNT(*)
FROM users
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;
```

If duplicates exist, migration stops instead of merging or deleting accounts. Resolve ownership manually before proceeding. The index uses normal transactional creation; schedule a maintenance window if the users table is large enough for its write lock to matter.

After migration, measure the actual query using a representative address:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, email, password, role, status, remember_token
FROM users
WHERE LOWER(email) = 'representative@example.com'
LIMIT 1;
```

The configured remote PostgreSQL database was inspected inside a read-only transaction with a ten-second statement timeout. It contained **zero case-insensitive email conflict groups**. The existing indexes included the ordinary unique email index, but not the new `LOWER(email)` expression index. A missing-address lookup used a sequential scan across **24 accounts**, with **0.082 ms execution time** and **0.853 ms planning time**. Establishing the connection took **2791.52 ms** in this one sample from the developer machine. This suggests connection/network overhead merits measurement, but does not establish a typical latency or predict latency from Render. No account addresses, password hashes, or credentials were printed. No DDL or data changes were performed.

Post-migration plans and realistic concurrency/load tests still require deployment. Small tables may correctly continue using a sequential scan even after adding the index; judge the plan using representative data and planner statistics.

Keep `SESSION_DRIVER=database` and `CACHE_STORE=database` for shared session, rate-limit and breach-cache state. The production lockout store must be shared by every application instance; do not use local file, array, null or failover-to-array stores for enforcement. Switching lockout stores drops the old store's temporary counters, so avoid changing it during an active attack. Existing database caching adds network round trips for locking; use an already-provisioned Redis store only if measurements justify it.

Measure warm and cold p50/p95/p99 login and registration latency, database connection time, query time, cache operations, password verification CPU time, storage latency and worker occupancy in the deployed regions. Four PHP workers remain a capacity bound, and Docker OPcache/config caching cannot eliminate platform cold starts. The forgot-password endpoint still sends mail synchronously and preserves its existing 200ms minimum response time. No new queue worker or mail infrastructure was introduced.

Existing Supavisor deployments can continue using their pooler and `DB_EMULATE_PREPARES` setting. Persistent PDO connections were not enabled without evidence that they help this runtime. Compare network round trips and pooler behavior before changing connection settings.

Immediate file cleanup is best effort when storage itself is unavailable: failures are reported without masking the original registration error. A killed process or host failure between upload and transaction completion cannot execute cleanup. After outages, preview recovery with `php artisan uploads:prune-registration-orphans`; run it with `--delete` to remove identified files. The command streams private registration directories, checks database references in batches and protects files younger than 24 hours (increase with `--hours`). It preserves files referenced by verification documents or pet vet records. Recovery requires this command to be run after an interruption; no scheduler was added. No claim of atomic transactions across PostgreSQL and external storage is made.

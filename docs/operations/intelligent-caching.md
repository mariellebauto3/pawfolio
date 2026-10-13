# Performance implementation and activation

## Changes

- Pet analytics combines eight tile counts into four aggregate queries. The full
  stats service now makes six queries instead of ten, a 40% reduction. Existing
  account isolation and outcomes are unchanged.
- Human analytics groups scores in SQL instead of transferring every matching
  row to PHP. At most 101 score buckets are needed for the existing histogram.
- PostgreSQL groups daily profile views by Manila date in SQL instead of sending
  every view timestamp to PHP. Other engines retain the existing date handling.
- Search pagination reuses totals already calculated in that request, removing a
  duplicate count. Post search selects only author display-name fields and avoids
  unused photo relationship queries and payloads.
- Composite viewer/profile/time indexes support the daily profile-view existence
  checks. Existing trigram, feed, matching and booking indexes remain in place.
- The Recently Hired query selects only the required adoption, pet and photo
  columns. Optional cached hits make one SQL query; disabled caching makes three,
  and cold enabled caching makes four. Photo existence is checked on every read,
  so a deleted file still produces the existing fallback immediately.

## Deployment

No credentials, infrastructure or deployed environment have been changed. Deploy
the backend dependencies and run `php artisan migrate --force` before activation.
The existing Render startup already runs migrations. This creates the version
table, transactionally maintained triggers and profile-view indexes. Verify the
database role can create the triggers. Index creation can lock a large existing
table; schedule migration during a suitable low-traffic window.

Redis is worthwhile only when its measured network cost is smaller than the
business queries it replaces. Provision a Redis-compatible TCP/TLS endpoint near
the Laravel backend, ideally in the same region/private network; an HTTP-only
Redis REST endpoint is not compatible with this client. Keep Redis private or use
TLS, authentication and provider network restrictions.

Set these **backend** variables after verifying connectivity:

```dotenv
READ_CACHE_STORE=redis
REDIS_CLIENT=predis
REDIS_URL=rediss://username:password@your-cache-host:6379
REDIS_CACHE_DB=0
REDIS_CACHE_CONNECT_TIMEOUT=0.25
REDIS_CACHE_READ_TIMEOUT=0.25
REDIS_CACHE_MAX_RETRIES=0
CACHE_PREFIX=pawfolio-production-cache-
REDIS_PREFIX=pawfolio-production-redis-
```

Use the provider's port and URL, URL-encode credentials, and keep TLS certificate
verification enabled. Cache database 0 supports services with only one logical
database; separate namespaces isolate applications and environments. Defaults
disable persistent connections. Laravel reuses its connection within a request;
cross-invocation reuse is not assumed. Predis supports bounded
[connection and read timeouts](https://github.com/predis/predis/wiki/Connection-Parameters).
Tune these against measured latency; optional cache failures fall back to SQL and
log only the exception class, without URLs or credentials.

Keep current `SESSION_DRIVER`, `CACHE_STORE` and `AUTH_LOCKOUT_STORE`. For multiple
instances or an ephemeral backend, security counters and sessions must use shared
stores. `RATE_LIMIT_STORE` can explicitly select the database independently of
optional read caching. Do not use array/file failover for shared authentication
counters. Existing security-store failures still fail closed; optional read-cache
fallback never handles those failures.

After environment changes rebuild Laravel's configuration cache and restart the
backend. Leave `READ_CACHE_STORE` unset to disable caching without changing APIs.
For local experiments `READ_CACHE_STORE=file` works, or use a supplied Redis
endpoint; no local Docker installation is needed. If Laravel is later moved into
a Vercel function, use shared stores, the same low-latency TCP/TLS integration and
request-scoped connections. The current repository contains no Laravel Vercel
runtime to validate. Vercel currently hosts the frontend only.

## Verification and remaining measurements

Baseline: 350 tests / 5,411 assertions passed on PHP 8.2 and isolated SQLite.
Final regression: 358 tests / 5,435 assertions passed; Composer validation and
formatting checks passed. Run `php vendor/bin/phpunit` from `backend` to reproduce.
New tests verify warm query count, bulk changes, hiring/account visibility,
rollback, cache read/write failures, real Predis connection refusal, photo-file
changes and the six-query analytics bound. The cache version read remains SQL
even on a hit; this is part of its consistency guarantee.

Local suite duration is not an API latency benchmark: password-breach network
checks and machine state vary. No production response-time, Redis-hit latency,
CPU reduction or throughput claim has been established. Redis credentials and
a live service were not provided. PostgreSQL-specific trigger and date SQL,
query plans and concurrent bookings/cache fills require staging validation.

Before enabling Redis broadly, compare the same dataset and deployment region
with caching disabled/enabled: cold and warm gallery p50/p95/p99 latency, SQL
counts and execution plans (`EXPLAIN (ANALYZE, BUFFERS)`), Redis command latency
and hit/miss counts, process CPU/memory, and concurrent reads/writes. Exercise
hire/unlink, suspension, rename, photo deletion, rollback and Redis outage/recovery
while reading. Confirm committed changes appear on the next request and booking
constraints still reject conflicting requests. Monitor version-row contention
and retained key count; old keys expire automatically. A database restore or
version-table recreation requires a new cache prefix to avoid reusing old keys.

The main unresolved risk remains backend-to-database network distance. Existing
development measurements found high Supabase round-trip latency. Removing queries
helps, but service proximity and the correct connection-pool endpoint need live
deployment measurements. This implementation adds no asynchronous processing.

# Core backend optimization verification

Implemented on `fix/backend-core-performance`. Changes preserve response contracts, matching formulas, quiz results, and appointment workflows. These changes have not been deployed or migrated against production.

## Changes

- Matching recalculation fetches only scoring fields, processes candidates in chunks of 200, and batches score writes and disqualified-score deletions. Profile detail evaluation no longer calculates each pair twice. Recalculation is atomic; parent locks protect the input snapshot, and transactions retry deadlocks up to three times.
- Quiz and resume answer lists use bulk writes and retain unchanged rows. Profile responses reuse loaded models and relationship counts.
- Feed author visibility checks use eager relationship existence flags scoped to the current viewer. Author/profile loading avoids per-author queries. Post photos use one insert; photo reordering uses one bound CASE update.
- Reaction toggles serialize on the viewer's account row, preserve unique constraints, and recheck target visibility. Comment creation and notifications commit together. Replies beneath removed comments cannot receive reactions.
- Resume and profile writes lock fresh parent records. Upload limits and published-photo minimums are checked under those locks. Failed uploads and database transactions clean up newly created files; replaced files are removed after commit only when no shared reference remains. Defaults and shared verification documents are retained.
- Appointment availability creation locks the home before checking duplicates. Slot deletion rechecks bookings under lock. New partial unique indexes enforce available slot and active booking uniqueness while retaining historical records. Appointment responses reuse known booking relationships and avoid loading every home slot.
- New partial indexes support visible feeds, comment threads, and file-reference checks.
- PostgreSQL defaults to `DB_DISABLE_PREPARES=true`, retaining native bound parameters while avoiding a separate named-prepare round trip for one-shot ORM queries. Set it to false to restore previous behavior. Existing `DB_EMULATE_PREPARES` configuration remains available. PHP documents this driver's latency optimization in the [PDO PostgreSQL manual](https://www.php.net/manual/en/class.pdo-pgsql.php).

## Measured results

Final Laravel regression suite: **347 tests passed, 5,334 assertions, 55.74 seconds**. Pint formatting and `git diff --check` passed. Tests cover rollback, partial upload cleanup, unchanged answer identities, shared-file retention, visibility, reaction toggles, and appointment uniqueness in addition to existing feature workflows.

Local test fixtures measured database query counts before and after:

| Operation | Before | After |
| --- | ---: | ---: |
| Recalculate matches for 40 eligible pets | 89 | 9 |
| Feed with 20 distinct pet authors | 28 | 9 |
| Quiz preference step with nine answers | 27 | 19 |

The optimized feed used nine queries at both one and twenty authors. Three post photos require one insert, and ten-photo reordering requires one update. Regression tests compare all eight score fields across more than one candidate chunk, preserve score identities, and verify rollback after a later batch fails.

A read-only synthetic PostgreSQL SELECT from this developer machine to the configured remote database measured five alternating samples: native named preparation median 545.62 ms (537.70–1018.77), native one-shot median 270.78 ms (264.86–735.67). Integer, boolean, quoted string, and backslash bindings produced identical results. This measures protocol overhead on this network, not deployed endpoint latency. Connection options were restored and the read-only transaction rolled back.

A separate five-sample, 5,000-evaluation CPU comparison with preloaded models measured medians of 1102.57 ms before and 1068.60 ms after; ranges overlap. There is no strong evidence of a CPU improvement. The confirmed gain is reduced database work.

## Remote preflight and deployment

Read-only PostgreSQL checks found zero duplicate available home/time slots, zero duplicate active bookings per request, and zero duplicate active bookings per slot. Existing ranking and appointment indexes were present; the matching plan used the existing home/score index. New indexes have not been installed or checked with production execution plans.

One connection sample took 2520.05 ms. Small feed and ranking queries executed on the server in 0.757 and 0.697 ms, but their client round trips were approximately 810 and 803 ms. This developer-to-cloud measurement demonstrates substantial network overhead; it does not establish the latency between deployed application and database.

Deploy code and run the three new migrations through the normal release process. Recheck duplicates immediately before migration; resolve conflicts explicitly if any arise. Index creation uses ordinary transactional migrations and can block concurrent writes while building; schedule according to table size and traffic. No remote writes or customer-data modifications were performed during verification.

## Remaining production verification

- Measure endpoint p50/p95 latency, query counts, connection acquisition, worker memory, and database execution plans after deployment. Test PostgreSQL concurrency with simultaneous quiz/resume edits, reaction toggles, and appointment booking. SQLite regression tests cannot reproduce PostgreSQL lock scheduling.
- Scoring remains synchronous to preserve immediately current results. Work remains proportional to candidate count, and snapshot locks remain held until commit; load-test contention and retry behavior.
- Storage cleanup is best effort. Storage outages or process termination can leave files; synchronous cloud upload/deletion latency remains a potential bottleneck. No new queue, service, or storage architecture was introduced.
- Full comment threads remain unpaginated to preserve the API. Pagination would require coordinated consumer changes.
- Confirm application/database regional proximity and connection pooling configuration using deployed measurements. The driver optimization does not remove connection handshakes or replace pooling.

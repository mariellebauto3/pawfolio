# Optional Redis read caching

Pawfolio currently serves Next.js on Vercel and Laravel on Render, with PostgreSQL
as the business database. Redis is optional and initially limited to the public
Recently Hired gallery. It replaces three repeated business queries with one
small authoritative version lookup; the result contains only names, public photo
paths and hiring dates. Private profile resources, credentials, authorization,
engagement counts and appointment availability are not cached.

Predis is installed because local PHP 8.2 and the existing production PHP image
do not include PhpRedis. Laravel's installed connector supports Predis 3. No new
container, worker, queue, service deployment or session migration is introduced.
Predis is a [supported Laravel client](https://laravel.com/docs/12.x/redis).

Invalidation uses a PostgreSQL version row advanced by database triggers. This
covers model writes, bulk updates, cascade deletes and direct SQL writes. The
version and business changes commit or roll back together, as described in
[PostgreSQL's trigger documentation](https://www.postgresql.org/docs/current/trigger-definition.html).
Reading the version before consulting Redis prevents an old cache entry from
becoming valid again after a Redis outage. A racing fill writes only its original
version key; subsequent readers use the new version. Reads inside transactions
bypass shared caching so uncommitted data cannot contaminate committed keys.
SQLite triggers exercise the transaction behavior locally; other drivers bypass
this cache. Keys expire after 60 seconds, including obsolete versions.

The remaining version query is intentional: a Redis-only invalidation mechanism
cannot guarantee immediate invalidation when Redis is unavailable during a write.
The gallery's four-row bound makes duplicate cold fills inexpensive; distributed
locks would add network calls and lock failure modes without a demonstrated need.
Trigger writes serialize briefly on one version row, so PostgreSQL concurrent
write behavior must be checked under production load before expanding this design.

Authentication already reuses the authenticated model and loaded profile within
the request. Matching already persists scores and batches recalculation; adding
one Redis request per cheap pair calculation would increase overhead. Search
suggestions already select bounded labels without relationship loads or counts;
their case-insensitive partial matching and frontend debounce remain intact.
Feed counts and scheduling remain fresh PostgreSQL reads with existing eager
loading, transaction locks and uniqueness constraints. These modules need no
additional cache to retain current consistency and security behavior.

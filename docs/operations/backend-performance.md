# Backend performance and environment checks

Local development uses PHP directly (`php artisan serve`) and the cloud Supabase
database. Docker and a local Supabase stack are not required for this workflow.

The local `.env` and `.env.example` use `SESSION_DRIVER=file` and
`CACHE_STORE=file` to avoid cloud round trips for sessions and throttling. These
stores persist on the local machine; rate limiting and session authentication
remain enabled. Changing session drivers requires signing in again.

After changing `.env`, restart the backend. If configuration was previously
cached, run `php artisan config:clear` before restarting. Set local `APP_URL` to
`http://localhost:8000` so public upload URLs include the backend port.

## Cloud database

Keep SSL enabled (`DB_SSLMODE=require`). Supabase session pooling uses port 5432;
transaction pooling uses 6543. For transaction pooling, set
`DB_EMULATE_PREPARES=true`; parameters remain bound through PDO. Do not change
the pooler endpoint or port without confirming the intended connection mode.

Connection measurements on the development machine showed about 1.7–1.9 seconds
to connect and 0.8 seconds per trivial query. PostgreSQL executed the diagnostic
constant query in under 1 ms. Removing queries reduces this overhead, but cannot
repair network latency. Measure from the deployed backend before changing its
region, endpoint or pooler configuration.

## Production

Local environment changes do not update hosting environment variables. Set the
public HTTPS backend URL, production frontend origins, `APP_ENV=production`,
`APP_DEBUG=false`, secure session cookies and `LOG_CHANNEL=stderr` on the host.
Keep the existing `APP_KEY` and credentials.

Multiple backend instances require a shared session and cache store. Do not copy
the local file-store settings to a deployment with multiple instances or
ephemeral storage. A shared low-latency Redis service is an option; provision and
verify it before changing drivers. Existing database stores remain supported.

The current Render deployment uses Docker because Render has no native PHP
runtime. Removing the Dockerfile requires first moving to a host providing PHP
8.2+, Composer, GD with PNG/JPEG support and PDO PostgreSQL. Such a host can start
the backend with `php artisan serve --host=0.0.0.0 --port=<host-port>`. Keep uploads
on persistent storage. No deployment architecture was changed by these fixes.

## Errors and validation

Unhandled API exception logs now include the exception class, HTTP method, route
template and source file/line. They exclude raw exception messages, which can
contain SQL bindings or personal data. Public errors remain generic. Match a
failed request's timestamp and route with backend and hosting logs to identify
the actual exception; performance changes do not prove those errors are fixed.

Run the relevant feature tests with `php vendor/bin/phpunit`. Tests use isolated
in-memory SQLite, not the cloud database. Run PostgreSQL diagnostics read-only
when validating deployment-specific query behavior.

## Navigation and backend concurrency

The frontend proxy no longer makes an extra `/auth/me` request before rendering.
Server guards use the request-scoped session lookup instead. The Render Docker
image sets `PHP_CLI_SERVER_WORKERS=4` and starts Artisan with `--no-reload`, which
Laravel requires to enable multiple PHP workers. This reduces request queuing
behind slow database calls. Adjust worker count to the host memory limit.
This setting works in the Linux container; PHP workers are unsupported on Windows.

Deploy both the frontend and backend to apply these changes. Validate signed-in
navigation and concurrent requests after deployment. An authenticated session
failure still requires the Vercel/Render logs for its underlying API exception or
timeout; anonymous health probes cannot reproduce a user's authenticated request.

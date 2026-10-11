# Frontend session routing

Browser API requests use the frontend's `/backend/api/v1/*` path, and CSRF initialization uses `/backend/sanctum/csrf-cookie`. Next.js external rewrites forward these requests to `NEXT_PUBLIC_API_URL`. Server-side API requests continue to call that backend directly, forwarding the cookies from the frontend request.

Server session checks and page API calls use the request's public host and protocol (forwarded by the hosting proxy) for `Origin` and `Referer`, matching browser calls. Using a stale `NEXT_PUBLIC_APP_URL` here causes Sanctum to ignore an otherwise valid session: browser sign-in succeeds, but protected pages redirect back to sign-in. `NEXT_PUBLIC_APP_URL` remains the fallback when host headers are absent. Render's `SANCTUM_STATEFUL_DOMAINS` must include the frontend host, such as `pawfolio-service.vercel.app` (without `https://`).

This keeps Laravel's session and XSRF cookies on the frontend host, including when Vercel and Render use different domains. Calling Render directly from the browser puts the session cookie on Render instead; Vercel cannot receive that cookie when rendering a protected page and redirects back to sign-in.

Protected navigation waits up to 30 seconds for session verification, matching server page API calls. If it cannot verify the session, it returns HTTP 503. Vercel function logs include `Pawfolio navigation session check failed` with the error name, kind and status only. Check these alongside Render logs to distinguish timeouts/network failures from API errors; no session cookies or account details are logged.

Backend configuration:

- Leave `SESSION_DOMAIN` unset or `null` so cookies have no explicit backend domain. With the rewrite, the browser stores them on the frontend host.
- Use `SESSION_PATH=/` so server page requests include the session cookie.
- Use `SESSION_SECURE_COOKIE=true` in production; retain HttpOnly protection on the session cookie.
- Include the frontend hostname in `SANCTUM_STATEFUL_DOMAINS`, and set `FRONTEND_URL` and frontend `NEXT_PUBLIC_APP_URL` to the frontend origin.
- Match frontend `SESSION_COOKIE_NAME` to backend `SESSION_COOKIE` (default `pawfolio-session`).

Redeploy the frontend after changing `NEXT_PUBLIC_API_URL`; the rewrite destination is built into the deployment. Existing cookies stored on the backend domain cannot migrate to the frontend host, so users need to sign in once after this change.

Verify on the deployed frontend: CSRF and sign-in requests use `/backend/*`; the frontend host has an HttpOnly session cookie with path `/`; active members open `/feed`, admins open `/admin`, and pending accounts open `/account-status`. Reloading the destination must preserve the session. Signed-in visitors opening sign-in or signup go to their account automatically.

# 0008. Scheduled jobs run after API answers

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Proposal §5 makes some changes happen with time, not with a click: a Sent request expires after 14 days, an Approved
request without a booking expires after 14 days, a request moves to Awaiting Decision once its meeting time has passed,
reminders go out before the meeting and for 7 days after it before the request is flagged for admins (FR36), and a
scheduled announcement is published at its time (`NT-05`). Five jobs in `routes/console.php` do this, but they need
`php artisan schedule:run` every minute, and the backend runs on Render's free plan with `php artisan serve` only:
no cron, no worker, and it sleeps after 15 minutes without traffic. None of the jobs had ever run in production.

## Decision

`App\Http\Middleware\RunDueScheduledJobs`, on the API routes, runs the five jobs after a successful answer, at most
once every 5 minutes (a cache key marks the run).

- The jobs run after the answer has gone (`defer()`), and the answer carries `Content-Length`, so the visitor never
  waits for them (`php artisan serve` holds the browser otherwise; see ADR 0007).
- Every job catches up on everything overdue, so time when nobody visits is made up on the next visit. Every
  notification is in-app, so a reminder made on the next visit is seen as soon as it could be seen anyway.
- A job that fails is reported and the others still run; the next run tries again.
- `RUN_DUE_JOBS_ON_REQUESTS=false` turns it off (the tests do, except their own). `routes/console.php` stays as it is
  for a host with a scheduler; both can run together because each job locks its rows and checks them again.
- No new endpoint, service, secret or setting is needed.

An outside timer calling a secret endpoint every 5–10 minutes was considered: changes would happen on time with nobody
visiting, but it adds a service, a secret and an endpoint, and it keeps the free instance awake (about 744 of its 750
hours a month).

## Consequences

- Statuses, reminders, the overdue flag and scheduled announcements happen within about 5 minutes of someone using the
  site after they are due. With nobody using the site, they wait for the next visit.
- Once every 5 minutes, one PHP worker spends about a second or two on the jobs after its answer.
- A local `php artisan serve` runs the jobs too, against whatever database `.env` names.
- A second background task should be added to `RunDueScheduledJobs::JOBS` and `routes/console.php` together; a test
  checks they list the same jobs.

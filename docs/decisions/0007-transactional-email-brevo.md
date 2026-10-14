# 0007. Transactional email through Brevo's HTTPS API

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Forgot password (`AU-04`…`AU-06`) was built and tested, but no email ever left the server: `MAIL_MAILER` was `log`.
The backend runs on Render's free plan, which blocks outbound SMTP (ports 25, 465 and 587) since September 2025, so
no SMTP provider (Gmail, Brevo's relay) can be reached from it. The team owns no domain, and there is no queue worker
or scheduler in production. Password reset is the only email the platform sends.

## Decision

- **Provider:** Brevo, free plan (300 emails a day). It sends to any address from a single verified sender, without
  a domain of our own.
- **Transport:** Brevo's HTTPS API (`POST https://api.brevo.com/v3/smtp/email`, port 443) through a small Laravel mail
  transport, `App\Mail\BrevoTransport`, built on Laravel's HTTP client. No package is added: Symfony's Brevo bridge
  would bring `symfony/http-client` with it.
- **Configuration:** `MAIL_MAILER=brevo`, `BREVO_API_KEY` (secret, Render's environment only) and `MAIL_FROM_ADDRESS`
  (the verified sender). Local development keeps `MAIL_MAILER=log`, so reset links are read from
  `storage/logs/laravel.log` and Brevo's quota isn't spent.
- **Sending:** `POST /auth/forgot-password` answers first and makes the token and sends the email afterwards
  (`defer()`), so the provider's speed or failure never shows in the answer (SEC-AUTH-05). The answer carries
  `Content-Length`: without it, `php artisan serve` keeps the browser waiting until the deferred work ends (measured).
  A failure is reported without the address (SEC-LOG-03).
- **Quota and abuse:** besides the 5-per-15-minutes limit per IP and the broker's one link a minute per account, an
  address gets at most 3 links an hour, counted for every address alike (T11).

## What Brevo receives

The recipient's email address, the sender, and the email itself, which holds the reset link and its token. Brevo
rewrites links to track clicks, and this can't be turned off on the free plan, so the link passes through Brevo's
redirect and is stored in its logs. The token works once and for 30 minutes (SEC-AUTH-08). Brevo receives no name,
password or other account data.

## Consequences

- Reset emails reach real inboxes from Render's free plan.
- Without an authenticated domain, Brevo shows the sender as an `@…brevosend.com` address and some emails land in
  spam; `AU-05` already asks to check the spam folder. A domain of our own would need DNS records in Brevo.
- A deferred email holds one of the server's 4 PHP workers until Brevo answers (at most 10 seconds, the transport's
  timeout).
- After deploying, send one real reset email and open its link, to check the `#token=…` part survives Brevo's click
  tracking.
- A second kind of email (e.g. Meet & Greet reminders) would share the 300-a-day quota; review the plan then.

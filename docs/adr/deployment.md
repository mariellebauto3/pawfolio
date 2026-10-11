# ADR 0006 — Production Deployment & Infrastructure Architecture (`BE-27`)

- **Status:** accepted
- **Date:** 2026-10-04
- **Refs:** `BE-27`, `BE-28`, `SEC-DEPLOY-01..07`, `SEC-AUTH-06`, `SEC-FILE-03`, `SEC-PRIV-05`

## Context

Pawfolio is a decoupled web application with a Next.js 16 App Router frontend (`frontend/`) and a Laravel 12 API backend (`backend/`) serving `/api/v1` using Laravel Sanctum SPA cookie-based authentication. Before staging and production rollout, the team needed an explicit decision record covering:

1. Production relational database engine
2. Frontend, backend, worker, scheduler, and storage hosting
3. Cookie/CORS/TLS boundaries for Sanctum SPA sessions
4. Private vs public file storage for verification IDs, vet records, and pet/post photos
5. Secret management, encryption keys (`APP_KEY`), and backup/recovery procedures

## Decision

### 1. Database Engine — Managed PostgreSQL 16 (Supabase / AWS RDS ap-southeast)
- **Production & Staging:** Managed PostgreSQL 16 (`DB_CONNECTION=pgsql`, `DB_SSLMODE=require`) with automated daily snapshots and point-in-time recovery (`SEC-DEPLOY-06`).
- **CI / Automated Tests:** In-memory SQLite (`:memory:`) for fast, isolated feature and unit test runs (`php artisan test`).
- **Schema Parity:** All 39 migrations use portable Laravel Schema Builder definitions compatible with both PostgreSQL and SQLite. Personal contact fields (`home_profiles.contact_number`, `home_profiles.street_address`, `pets.caretaker_contact_number`) are encrypted at rest via `EncryptedOrPlaintext` (`SEC-PRIV-05`) and stored in `text` columns (`2026_10_04_000001_widen_encrypted_personal_columns.php`).

### 2. Hosting & Runtime Topology
- **Frontend (`app.pawfolio.ph`):** Next.js deployed on Vercel (or containerized Node 22 runtime) configured with `NEXT_PUBLIC_API_URL=https://api.pawfolio.ph` and `NEXT_PUBLIC_API_MODE=live`.
- **Backend API (`api.pawfolio.ph`):** Laravel 12 on PHP 8.4 (FPM + Nginx) behind TLS 1.2/1.3 termination (`SEC-DEPLOY-05`).
- **Shared Registrable Domain:** Both `app.pawfolio.ph` and `api.pawfolio.ph` share `.pawfolio.ph` (`SESSION_DOMAIN=.pawfolio.ph`, `SANCTUM_STATEFUL_DOMAINS=app.pawfolio.ph`, `CORS_ALLOWED_ORIGINS=https://app.pawfolio.ph`) so `HttpOnly`, `SameSite=Lax`, `Secure` session and CSRF cookies work seamlessly across SSR and browser calls (`SEC-AUTH-06`, `SEC-API-03`).
- **Scheduler & Queue Workers:**
  - `php artisan schedule:run` runs every minute via cron/systemd timer to execute the 5 idempotent lifecycle jobs (`ExpireSentRequestsJob`, `ProcessApprovedUnbookedRequestsJob`, `SendMeetAndGreetRemindersJob`, `ProcessPassedMeetingsAndDecisionsJob`, `PublishScheduledAnnouncementsJob`).
  - `php artisan queue:work --tries=3 --timeout=60` runs under Supervisor/systemd for asynchronous notifications and emails.

### 3. File Storage Separation (`SEC-FILE-03`)
- **Public Disk (`public` / S3 public prefix):** Pet photos, post photos, and adoption story photos (`pets/photos/*`, `posts/photos/*`). Re-encoded via GD (`FileUploadService::storePublicPhoto`) to strip EXIF/GPS metadata, cap dimensions at `<= 1920px`, and assign UUID filenames (`SEC-FILE-04`, `SEC-FILE-05`).
- **Private Disk (`local` / S3 private bucket outside `public/`):** Government IDs, caretaker proof photos, vet records, and detail change documents (`verification/*`, `pets/vet-records/*`, `accounts/change-requests/*`). Never publicly addressable; served only through authenticated, role- and ownership-checked controller endpoints (`AdminVerificationController::streamDocument`, `DiscoveryController::downloadVetRecord`) with `Content-Disposition` and `X-Content-Type-Options: nosniff`.

### 4. Production Hardening Checklist (`BE-28`, `SEC-DEPLOY-01..07`)
- `APP_ENV=production`, `APP_DEBUG=false` (`SEC-DEPLOY-02`).
- Unique `APP_KEY` generated per environment (`php artisan key:generate`) and backed up in the secrets manager (`SEC-DEPLOY-01`, `SEC-PRIV-05`).
- Security headers enforced globally via `App\Http\Middleware\SecurityHeaders` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Content-Security-Policy`, and `Strict-Transport-Security` in production) (`SEC-DEPLOY-03`).
- Admin accounts provisioned exclusively via `php artisan pawfolio:create-admin` or `AdminSeeder` (`SEC-AUTH-10`); `DemoSeeder` refuses to run when `APP_ENV=production` (`BE-09`).

## Consequences

- Frontend and backend must be deployed under subdomains of the same registrable domain so Sanctum `SameSite=Lax` cookies work without third-party cookie restrictions.
- Rotating `APP_KEY` requires re-encrypting `home_profiles.contact_number`, `home_profiles.street_address`, and `pets.caretaker_contact_number`.

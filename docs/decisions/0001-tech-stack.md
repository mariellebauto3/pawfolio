# 0001. Next.js frontend + Laravel API backend

- **Status:** accepted
- **Date:** 2026-09-28

## Context
Pawfolio needs a responsive web app for three roles (Pet, Human, Admin) with server-enforced business rules,
session-based authentication (NFR2) and admin audit logs (NFR9).

## Decision
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 — in `frontend/`.
- **Backend:** Laravel 12 (PHP 8.2) as a JSON REST API under `/api/v1`, with Laravel Sanctum SPA cookie sessions — in `backend/`.
- **Database:** SQLite for local development; production engine to be decided (separate ADR).

## Consequences
- Two apps to run locally (`npm run dev`, `php artisan serve`) and to deploy.
- CORS and Sanctum stateful domains must list the frontend origin.
- Laravel 13 needs PHP 8.3; upgrading PHP is a prerequisite for a framework upgrade.

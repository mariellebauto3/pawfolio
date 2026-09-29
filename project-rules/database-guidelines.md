# Database Guidelines

**Engine:** SQLite for local development today. The production engine (MySQL via XAMPP/host, or PostgreSQL e.g. Supabase/Neon)
is **not decided yet** — record the choice in `docs/decisions/`. Until then, write **portable** migrations: no engine-specific
SQL, column types or JSON operators.

## 1. Naming

- Tables: `snake_case`, plural (`adoption_requests`). Pivot tables: both singular names in alphabetical order (`pet_skill`).
- Columns: `snake_case`. Primary key `id`. Foreign keys `<singular_table>_id` (`home_profile_id`).
- Booleans start with `is_` / `has_` (`is_open_to_adopt`). Timestamps end with `_at` (`approved_at`, `expires_at`).
- Status columns are named `status` and store `snake_case` string values backed by PHP enums (`looking_for_a_home`).

## 2. Migrations

- One migration per change; never edit a migration that has been merged — add a new one.
- Every table has `id`, `created_at`, `updated_at`.
- Foreign keys with explicit `constrained()` and a deliberate `onDelete` rule. Default to `restrict` for history (requests, logs);
  `cascade` only for owned child rows (e.g. pet photos).
- Index foreign keys and every column used for filtering or sorting (status, city/province, species, created_at).
- Add unique constraints for business rules the database can enforce (e.g. one open request per pet + human where possible;
  one Furparent per pet).

## 3. Records we keep

- Accounts are **deactivated, not deleted** (soft deletes / status), so adoption history and logs stay valid (proposal §5.1).
- Adoption requests, Meet & Greets, reports and activity logs are never hard-deleted.
- Status changes store a timestamp column for each milestone (`approved_at`, `scheduled_at`, `adopted_at`…) and are also written to activity logs.

## 4. Privacy

Authoritative rules: **[security-guidelines.md](security-guidelines.md)** §8 (privacy, files, encryption at rest). Database specifics:

- ID photos, vet records and certificates: store only the **file path** (private disk) plus metadata; never the file in the database.
- Contact numbers and street addresses live in their own columns so API Resources can hide them until a Meet & Greet is confirmed.
- Seeders and factories use fake data only — never real people's information.

## 5. Core entities (provisional — finalize in `docs/database/` ERD)

| Area | Tables (planned) |
| --- | --- |
| Accounts & verification | `users` (role, account status), `verification_submissions`, `verification_documents` |
| Profiles | `pets` (résumé, adoption status), `pet_photos`, `home_profiles` (quiz answers, open to adopt) |
| Matching | computed from `pets` + `home_profiles`; cache in `match_scores` only if needed for performance |
| Bookmarks & invites | `bookmarks` (polymorphic: pet or home profile), `invites` |
| Requests & meetings | `adoption_requests`, `meet_greet_slots`, `meet_and_greets`, `request_messages` (request thread) |
| Adoption | `adoptions` (pet ↔ furparent link, adopted_at) |
| Community | `posts`, `post_photos`, `comments`, `reactions` |
| Moderation | `reports`, `report_actions` |
| Platform | `notifications` (Laravel), `announcements`, `activity_logs` |

## 6. Seeding

- `DatabaseSeeder` creates the admin account(s) and, in local/dev only, demo data mirroring the LoFi (Mochi, Kulit, Ana Santos…).
- Never run demo seeders in production.

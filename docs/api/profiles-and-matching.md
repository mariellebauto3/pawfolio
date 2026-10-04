# Profiles, Compatibility Matching, Bookmarks & Invites API

Endpoints for Pet Résumés (`BE-11`), Human Home Profiles & 6-Step Compatibility Quiz (`BE-12`), Compatibility Matches & Breakdown (`BE-13`), Bookmarks & Invite to Apply (`BE-15`).

## Pet Résumé (`BE-11`, `PR-01..PR-10`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/me/pet` | `pet` (Active) | Fetch caller's Pet Résumé, photos, vet records, temperament tags, skills, special needs, and 5-step completeness report |
| `PATCH` | `/api/v1/me/pet` | `pet` (Active) | Update Pet Résumé fields (locked identity fields `name`, `species`, `breed`, `approximate_age_months`, `status` are ignored per `FR27` / `SEC-INPUT-04`) |
| `POST` | `/api/v1/me/pet/photos` | `pet` (Active) | Upload a pet photo (`multipart/form-data`, max 6 photos, GD EXIF-stripped & resized `<=1920px`) |
| `PATCH` | `/api/v1/me/pet/photos/order` | `pet` (Active) | Reorder pet photos (`photo_ids` array) |
| `DELETE` | `/api/v1/me/pet/photos/{photo}` | `pet` (Active) | Delete a pet photo (enforces minimum 3 photos when published, 1 photo in draft) |
| `POST` | `/api/v1/me/pet/cover-photo` | `pet` (Active) | Upload or replace optional cover photo |
| `POST` | `/api/v1/me/pet/vet-records` | `pet` (Active) | Upload private vet record (`record_type`, `summary`, `recorded_at`, `file` stored on private disk) |
| `DELETE` | `/api/v1/me/pet/vet-records/{record}` | `pet` (Active) | Delete a vet record |
| `POST` | `/api/v1/me/pet/publish` | `pet` (Active) | Validate 5-step completeness (including `>= 3` photos and `>= 60` char bio), transition `draft -> looking_for_a_home`, create automatic `for_hire` post, and recalculate match scores |

## Human Home Profile & 6-Step Compatibility Quiz (`BE-12`, `HP-01..HP-08`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/me/home-profile` | `human` (Active) | Fetch caller's Home Profile (including private owner fields `street_address`, `contact_number`, `birthdate`, `province`) |
| `PATCH` | `/api/v1/me/home-profile/{step}` | `human` (Active) | Save step `1`..`6` of the compatibility quiz and recalculate match scores when completed |
| `PATCH` / `POST` | `/api/v1/me/home-profile/intro` | `human` (Active) | Update `headline` and `about_home` |
| `POST` | `/api/v1/me/open-to-adopt` | `human` (Active) | Toggle `is_open_to_adopt` (`409 quiz_incomplete` if quiz is incomplete) |

## Compatibility Matches (`BE-13`, `MT-01..MT-05`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/matches` | `pet`, `human` (Active) | Paginated list of compatible matches passing all 4 dealbreakers, sorted by score desc |
| `GET` | `/api/v1/matches/{id}/breakdown` | `pet`, `human` (Active) | 4 dealbreakers + 7 weighted criteria (`20 + 15 + 15 + 15 + 15 + 10 + 10 = 100`) breakdown drawer |

## Bookmarks & Invites (`BE-15`, `BM-01`, `RQ-01..RQ-02`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/bookmarks` | `pet`, `human` (Active) | Paginated list of bookmarked profiles (`?type=pets\|homes`) |
| `POST` | `/api/v1/bookmarks` | `pet`, `human` (Active) | Bookmark a Pet (`pet_id`) or Home Profile (`home_profile_id`) |
| `DELETE` | `/api/v1/bookmarks/{bookmark}` | `pet`, `human` (Active) | Remove bookmark by bookmark ID |
| `DELETE` | `/api/v1/bookmarks/{type}/{id}` | `pet`, `human` (Active) | Remove bookmark by target type (`pets` or `homes`) and target ID |
| `POST` | `/api/v1/pets/{pet}/invites` | `human` (Active) | Send an Invite to Apply (`note` optional, requires `is_open_to_adopt = true`) |
| `GET` | `/api/v1/invites` | `pet`, `human` (Active) | Paginated list of active/sent invites |
| `POST` | `/api/v1/invites/{invite}/dismiss` | `pet` (Active) | Dismiss an invite (`dismissed_at = now()`) |

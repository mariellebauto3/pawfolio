# Profiles, Compatibility Matching, Bookmarks & Invites API

Endpoints for pet resumes (`BE-11`), Human Home Profiles & 6-Step Compatibility Quiz (`BE-12`), Compatibility Matches & Breakdown (`BE-13`), Bookmarks & Invite to Apply (`BE-15`).

## Pet resume (`BE-11`, `PR-01`…`PR-10`)

FR20, FR27. **Status: built (BE-11).** The frontend screens (FE-10) run against it through
`frontend/src/features/profiles/api/resume.ts`; there is no mock for these endpoints. A change here also changes
that file, the types (`frontend/src/features/profiles/types/own-pet.ts`, `frontend/src/types/pet.ts`), the client
rules (`frontend/src/features/profiles/schemas/resume-schemas.ts`) and the tests on both sides in the same PR.

- **Who:** the signed-in **pet** account, Active. The pet comes from the session, never from an id in the request
  (SEC-AUTHZ-02). Signed out: **401**. Not Active: **403** `account_not_active`. A human or an admin: **403**.
- **Every endpoint below answers with the whole resume** as `GET /me/pet` does (201 for the two that add a file), so
  the screen replaces what it holds with the answer.

| Method and path | What it does |
| --- | --- |
| `GET /me/pet` | The pet's own resume, with what only the owner sees (`PR-01`, `PR-02`) |
| `PATCH /me/pet` | Saves any of the editable fields (`PR-03`, `PR-05`…`PR-07`) |
| `POST /me/pet/photos` | Adds a gallery photo (`PR-09`) |
| `PATCH /me/pet/photos/order` | Puts the photos in a new order; the first is the profile photo (`PR-04`) |
| `DELETE /me/pet/photos/{photo}` | Removes a photo (`PR-04`) |
| `POST /me/pet/cover-photo` | Sets or replaces the cover photo (`PR-04`) |
| `POST /me/pet/vet-records` | Adds a private vet record (`PR-07`) |
| `DELETE /me/pet/vet-records/{record}` | Removes a vet record (`PR-07`) |
| `POST /me/pet/publish` | Draft → Looking for a Home (`PR-08`, `PR-10`) |

### `GET /me/pet`

- **200:**

  ```json
  {
    "data": {
      "id": 1,
      "name": "Mochi",
      "species": "dog",
      "breed": "Aspin",
      "approximate_age_months": 24,
      "sex": "female",
      "size": "medium",
      "currently_at": "Happy Paws Rescue (foster home)",
      "city": "Quezon City",
      "province": "Metro Manila",
      "bio": "Hi, I'm Mochi! I was found near a jeepney terminal and now I'm fostered by Happy Paws.",
      "energy_level": "high",
      "good_with_kids": "yes",
      "good_with_dogs": "yes",
      "good_with_cats": "unknown",
      "time_alone": "up_to_6_hrs",
      "space_needs": "needs_yard_or_daily_walks",
      "experience_needed": "first_time_ok",
      "health_notes": "Fully vaccinated (Aug 2026), dewormed, spayed.",
      "temperament_tags": ["Playful", "Loyal", "Curious", "Gentle"],
      "skills": ["sit_and_stay", "leash_trained"],
      "special_needs": [],
      "cover_photo_url": null,
      "photos": [{ "id": 11, "url": "https://…/storage/pets/photos/….jpg", "caption": "Beach day", "sort_order": 1 }],
      "status": "draft",
      "published_at": null,
      "hired_by": null,
      "views_count": 0,
      "bookmarks_count": 0,
      "is_bookmarked": false,
      "caretaker_name": "Joy Lim",
      "caretaker_contact_number": "09170000014",
      "vet_records": [{ "id": 3, "mime_type": "application/pdf", "size_bytes": 48211, "uploaded_at": "2026-10-04T02:15:00.000000Z", "download_url": "/api/v1/pets/1/vet-records/3" }],
      "completeness": {
        "is_complete": false,
        "strength_percent": 60,
        "steps": { "basics": true, "photos": false, "about_temperament": true, "compatibility": true, "health": false },
        "missing": ["Add at least 3 clear photos of the pet (up to 10).", "Add health & vet notes."]
      }
    }
  }
  ```

  | Field | Meaning |
  | --- | --- |
  | `name`, `species`, `breed`, `approximate_age_months` | Verified by an admin and **locked**: no endpoint here changes them (`AC-03`) |
  | `sex` … `health_notes` | `null` until filled in. Values: `sex` `female` \| `male`; `size` `small` \| `medium` \| `large`; `energy_level` `low` \| `medium` \| `high`; `good_with_*` `yes` \| `no` \| `unknown`; `time_alone` `up_to_2_hrs` \| `up_to_4_hrs` \| `up_to_6_hrs` \| `8_plus_hrs`; `space_needs` `apartment_ok` \| `needs_yard_or_daily_walks` \| `ground_floor`; `experience_needed` `first_time_ok` \| `some_experience` \| `experienced_only` |
  | `skills`, `special_needs` | Values of the `PetSkill` and `PetSpecialNeed` enums. No special needs is an empty list |
  | `photos` | In `sort_order`; the first is the profile photo and the account's `avatar_url` |
  | `status` | `draft` \| `looking_for_a_home` \| `in_process` \| `adopted_hired`. Never set through these endpoints except by publish (FR27) |
  | `hired_by` | Adopted pets only: `{ adoption_id, home_profile_id, full_name, city, adopted_at }` |
  | `caretaker_name`, `caretaker_contact_number`, `vet_records`, `completeness` | Owner only. The public resume (`GET /pets/{pet}`) leaves them out (SEC-PRIV-02) |
  | `vet_records[].download_url` | An API path, not a public file: it answers only the owner and a human with an approved request (`PR-07`) |
  | `completeness.steps` | The five things a resume needs to be published, by wizard step. `strength_percent` is the share that is done |
  | `completeness.missing` | One sentence for each step that isn't done, for the Draft banner (`PR-02`) |

- **404** when the account has no pet row.

### `PATCH /me/pet`

- **Body** (JSON): any of the fields below; a field left out keeps its value. `name`, `species`, `breed`,
  `approximate_age_months`, `status` and anything else are ignored (FR27, SEC-INPUT-04).

  | Field | Rules |
  | --- | --- |
  | `sex`, `size`, `energy_level`, `good_with_kids`, `good_with_dogs`, `good_with_cats`, `time_alone`, `space_needs`, `experience_needed` | One of the values above, or `null` |
  | `currently_at` | Required when sent, max 120 |
  | `city` | Required when sent, max 80 |
  | `province` | Required when sent; one of the provinces of the sign-up form |
  | `bio` | `null`, or 50 to 600 characters |
  | `health_notes` | `null`, or up to 2000 characters |
  | `temperament_tags` | Up to 5 texts of up to 40 characters; replaces the whole list |
  | `skills` | Up to 15 `PetSkill` values; replaces the whole list |
  | `special_needs` | Up to 5 `PetSpecialNeed` values; replaces the whole list |

- **200** with the resume. Match scores are worked out again.
- **422** `errors` by field (`temperament_tags.0` for one tag), with Laravel's default wording: the frontend checks
  the same rules first and shows its own messages.
- **Not checked yet:** a published resume can be saved with a required field emptied. The frontend doesn't allow it;
  the API should refuse it too (NFR3).

### Photos

- **`POST /me/pet/photos`**, `multipart/form-data`: `photo` (JPG or PNG, max 5 MB, checked by content and re-encoded
  without EXIF, SEC-FILE-01…05), `caption` (optional, max 140), `is_primary` (`1` puts it first, as the profile
  photo). **201** with the resume. **422** `errors.photo`: `"Upload a JPG or PNG photo."`,
  `"Each file must be 5 MB or smaller."`, `"You can upload up to 10 photos."`. Cropping happens in the browser
  before the upload.
- **`PATCH /me/pet/photos/order`**: `{ "photo_ids": [12, 11, 13] }`, the photos in their new order. **200** with the
  resume. **404** when an id isn't one of this pet's photos.
- **`DELETE /me/pet/photos/{photo}`**: **200** with the resume. **404** for another pet's photo (SEC-AUTHZ-04).
  **409** `minimum_photos_required` when it would leave fewer than 3 on a published resume, or fewer than 1 on a
  Draft.
- **`POST /me/pet/cover-photo`**, `multipart/form-data`: `cover_photo`, same rules as `photo`. **200** with the
  resume.

### Vet records

Private (SEC-PRIV-01): a human sees them only on one of the pet's requests that was approved (`PR-07`).

- **`POST /me/pet/vet-records`**, `multipart/form-data`: `vet_record` (JPG, PNG or PDF, max 5 MB). **201** with the
  resume. **422** `errors.vet_record`: `"Upload a JPG, PNG or PDF file."`, `"Each file must be 5 MB or smaller."`,
  `"You can upload up to 5 vet records."`.
- **`DELETE /me/pet/vet-records/{record}`**: **200** with the resume. **404** for another pet's record.

### `POST /me/pet/publish`

A state change through an action, not a `status` field (FR27).

- **Body:** none.
- **200** with the resume. A Draft becomes `looking_for_a_home`, `published_at` is set, a "For Hire" post is added
  to the feed (`PR-10`) and the change is written to `activity_logs`. A resume that is already published is
  answered as it is.
- **422** `errors.resume`: the `completeness.missing` sentences, when the resume isn't complete.
- **409** `already_adopted` for an adopted pet.

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

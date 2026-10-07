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

## Home Profile & lifestyle quiz (`BE-12`, `PR-11`…`PR-20`)

FR3, FR4, FR13. **Status: built (BE-12).** The frontend screens (FE-11) run against it through
`frontend/src/features/profiles/api/home-profile.ts`; there is no mock for these endpoints. A change here also
changes that file, the types (`frontend/src/features/profiles/types/own-home-profile.ts`,
`frontend/src/types/home-profile.ts`), the client rules
(`frontend/src/features/profiles/schemas/home-profile-schemas.ts`) and the tests on both sides in the same PR.

- **Who:** the signed-in **human** account, Active. The Home Profile comes from the session, never from an id in the
  request (SEC-AUTHZ-02). Signed out: **401**. Not Active: **403** `account_not_active`. A pet or an admin: **403**.
- **Every endpoint below answers with the whole Home Profile** as `GET /me/home-profile` does, so the screen
  replaces what it holds with the answer. **404** when the account has no Home Profile row.

| Method and path | What it does |
| --- | --- |
| `GET /me/home-profile` | The human's own Home Profile, with what only the owner sees (`PR-11`) |
| `PATCH /me/home-profile/{step}` | Saves quiz step `1`…`5`; `6` marks the quiz as finished (`PR-14`…`PR-19`) |
| `PATCH /me/home-profile` | Saves any of the quiz fields, none of them required: Save draft (`PR-14`…`PR-18`) |
| `POST /me/home-profile/intro` | Saves the headline, About our home and the two photos (`PR-12`) |
| `POST /me/open-to-adopt` | Turns Open to Adopt on or off (`PR-13`, `PR-20`) |

### `GET /me/home-profile`

- **200:**

  ```json
  {
    "data": {
      "id": 4,
      "full_name": "Bea Navarro",
      "city": "Marikina",
      "headline": "Family of three, weekend park people",
      "about_home": "We are a family of three who spend weekends at the park.",
      "profile_photo_url": "https://…/storage/homes/avatars/….jpg",
      "cover_photo_url": null,
      "home_type": "house",
      "outdoor_space": "small_yard",
      "activity_level": "active",
      "hours_away": "3_to_5",
      "pet_experience": "experienced",
      "special_needs_willingness": "minor_needs_only",
      "household_members": ["partner", "kids_6_to_12"],
      "other_pets": ["cats"],
      "accepted_species": ["dog", "cat"],
      "preferred_sizes": [],
      "preferred_ages": ["adult"],
      "is_open_to_adopt": false,
      "is_furparent": false,
      "has_completed_quiz": true,
      "adopted_pets": [
        { "adoption_id": 2, "adopted_at": "2026-09-21T03:10:00.000000Z", "pet": { "id": 7, "name": "Choco Jr.", "species": "dog", "breed": "Aspin", "city": "Pasig", "status": "adopted_hired", "photo_url": "https://…/storage/pets/photos/….jpg" } }
      ],
      "is_bookmarked": false,
      "province": "Metro Manila",
      "contact_number": "09181234567",
      "street_address": "123 Sampaguita St.",
      "birthdate": "1994-05-15",
      "views_count": 0,
      "open_slots_count": 1
    }
  }
  ```

  | Field | Meaning |
  | --- | --- |
  | `full_name` | Verified by an admin and **locked**: no endpoint here changes it (`AC-03`) |
  | `headline`, `about_home`, the two photo URLs | `null` until set (`PR-12`) |
  | `home_type` … `special_needs_willingness` | `null` until answered. Values: `home_type` `house` \| `condo` \| `apartment` \| `townhouse`; `outdoor_space` `none` \| `balcony` \| `small_yard` \| `large_yard`; `activity_level` `relaxed` \| `moderate` \| `active` \| `very_active`; `hours_away` `0_to_2` \| `3_to_5` \| `6_to_8` \| `9_plus`; `pet_experience` `first_time` \| `some` \| `experienced`; `special_needs_willingness` `yes` \| `minor_needs_only` \| `no` |
  | `household_members` | `just_me` \| `partner` \| `kids_under_6` \| `kids_6_to_12` \| `teens` \| `seniors` |
  | `other_pets` | `dogs` \| `cats` \| `other`. No other pets is an empty list |
  | `accepted_species`, `preferred_sizes`, `preferred_ages` | `dog` \| `cat` \| `other`; `small` \| `medium` \| `large`; `puppy_kitten` \| `adult` \| `senior`. An empty size or age list means any |
  | The five lists | **In no promised order**: the items can come back in another order than they were sent in |
  | `is_open_to_adopt` | Changed by `POST /me/open-to-adopt` (FR4) |
  | `is_furparent`, `adopted_pets` | Set by an adoption, never through these endpoints (FR13). `adopted_pets[].pet` is the pet summary |
  | `has_completed_quiz` | True once the quiz is finished; Pets for You and Open to Adopt need it (`MT-04`) |
  | `province`, `contact_number`, `street_address`, `birthdate`, `views_count`, `open_slots_count` | Owner only. The public Home Profile shows the city and the household answers and leaves these out (SEC-PRIV-03) |

### Quiz steps: `PATCH /me/home-profile/{step}`

- **Body** (JSON), by step. A required answer left out or empty is **422**.

  | Step | Fields |
  | --- | --- |
  | `1` Household | `household_members` (required, at least one), `other_pets` (a list, may be empty), `about_home` (`null` or up to 1000 characters) |
  | `2` Home & space | `home_type`, `outdoor_space` (both required), `city` (up to 80, never empty when sent), `province` (one of the provinces of the sign-up form) |
  | `3` Lifestyle | `activity_level`, `hours_away` (both required) |
  | `4` Experience | `pet_experience`, `special_needs_willingness` (both required) |
  | `5` Preferences | `accepted_species` (required, at least one), `preferred_sizes`, `preferred_ages` (lists, may be empty) |
  | `6` Review | None. Marks the quiz as finished |

- A list replaces what was saved. Anything else in the body (`full_name`, `is_furparent`, `quiz_completed_at`,
  `street_address`…) is ignored (SEC-INPUT-04).
- **200** with the Home Profile. The quiz is marked finished as soon as every required answer of the five steps is
  in, which is usually the save of step 5; step 6 then changes nothing. Once it is finished, every save works the
  match scores out again.
- **`PATCH /me/home-profile`** (no step) takes the same fields with none of them required, so a half-answered step
  can be saved as a draft. A required list that is sent must still hold at least one item, so leave it out instead.
- **422** `errors` by field (`household_members.0` for one item), with Laravel's default wording: the frontend
  checks the same rules first and shows its own messages.

### `POST /me/home-profile/intro`

- **Body**, `multipart/form-data` (`PATCH` with JSON also works when there is no photo): `headline` (up to 140;
  empty clears it), `about_home` (up to 1000; empty clears it), `profile_photo`, `cover_photo` (JPG or PNG, max 5 MB,
  checked by content and re-encoded without EXIF, SEC-FILE-01…05). A photo left out stays as it is.
- **200** with the Home Profile. The profile photo is also the account's `avatar_url` (`GET /auth/me`).
- **422** `errors.headline`, `errors.about_home`; `errors.profile_photo` and `errors.cover_photo`:
  `"Upload a JPG or PNG photo."`, `"Each file must be 5 MB or smaller."`.

### `POST /me/open-to-adopt`

A switch through its own endpoint, with the change written to `activity_logs` (before and after).

- **Body:** `{ "is_open_to_adopt": true }`.
- **200** with the Home Profile. Turning it off doesn't touch requests already in progress (proposal §5.5); the home
  stops appearing in pets' Homes for You.
- **409** `quiz_incomplete` when it is turned on before the quiz is finished. The message is shown as it is.

### Not checked yet

Found while wiring FE-11 (2026-10-07). The frontend never sends these, but the API should refuse them too (NFR3):

- **`PATCH /me/home-profile/6` marks the quiz as finished whatever was answered**, even with nothing answered. The
  frontend calls it only when its own check of the five steps passes.
- **`PATCH /me/home-profile` and `PATCH /me/home-profile/6` accept `is_open_to_adopt`** and set it without the
  `quiz_incomplete` check and without the before/after log entry that `POST /me/open-to-adopt` writes. The switch
  should change only through that endpoint.
- The rules are written in the controller, not in Form Requests with a Policy (SEC-INPUT-01, SEC-AUTHZ-01). The
  role and Active checks are done by the route middleware.

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

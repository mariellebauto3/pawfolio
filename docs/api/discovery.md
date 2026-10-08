# Discovery endpoints

Module 3, Discovery & Search (`DS-01`…`DS-08`, FR6, FR7, FR22). **Status: built (BE-14).** The frontend screens
(FE-12) run against it through `frontend/src/features/discovery/api/discovery.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/discovery.ts` answers the same way from the fixtures. A change here also changes
those two files, the types (`frontend/src/features/discovery/types/discovery.ts`), the URL and filter rules
(`frontend/src/features/discovery/schemas/browse-filters.ts`) and the tests on both sides in the same PR.

| Method and path | What it does |
| --- | --- |
| `GET /public/recently-hired` | The "Recently Hired" strip on the landing page (`AU-01`) |
| `GET /pets` | Pets looking for a home, a page at a time (`DS-01`) |
| `GET /pets/{pet}` | One pet's resume as someone else reads it (`DS-05`, `DS-08`) |
| `GET /home-profiles` | Homes that are Open to Adopt, a page at a time (`DS-02`) |
| `GET /home-profiles/{home}` | One Home Profile as someone else reads it (`DS-07`) |
| `GET /search` | Pets, homes and posts that mention some words (`DS-03`, `DS-04`) |
| `GET /pets/{pet}/vet-records/{record}` | A private vet record's file (`PR-07`); not used by the discovery screens |

- **Who** (everything except `recently-hired`): any signed-in **Active** account. Signed out: **401**. Not Active:
  **403** `account_not_active`. The role doesn't limit the lists; the frontend shows pets to humans and homes to pets
  (proposal §9).
- **What is never listed:** Draft resumes, adopted pets, pets and homes whose account isn't Active, and homes that
  aren't Open to Adopt or haven't finished the quiz.
- **Lists in a query** travel as one comma-separated value: `species=dog,cat`. An empty value is no filter.
- **Every filter is checked against an allow-list** by a Form Request (`backend/app/Http/Requests/Discovery/`,
  SEC-INPUT-01, SEC-INPUT-03). A value that isn't listed is **422** with `errors` by field (`species.0` for one item
  of a list), not a silent empty result. `per_page` past the most allowed is brought down to it, as on every list.
- **Who may read a resume or a Home Profile** is decided by `PetPolicy` and `HomeProfilePolicy`
  (`backend/app/Policies/`); the controller turns a refusal into **404** (SEC-AUTHZ-04).

## `GET /api/v1/public/recently-hired`

The "Recently Hired" strip on the landing page (`AU-01`).

- **Who:** anyone, signed in or not. No session or CSRF token needed.
- **200:** the most recently Hired pets, newest first, **at most 8**. It is a fixed showcase rather than a list to
  page through, so it has no pagination; the cap of 8 does the job of SEC-API-05.

  ```json
  {
    "data": [
      { "name": "Luna", "photo_url": "https://…/alumni/luna.jpg", "hired_at": "2026-09-24T08:00:00.000000Z" }
    ]
  }
  ```

  `name` and `photo_url` are the pet's, `hired_at` is when the Adopt action was confirmed. **Only these three
  fields:** no id, breed, location, caretaker or Furparent, since anyone on the internet can read this (NFR4,
  SEC-PRIV-03). `photo_url` is `null` when the pet has no public photo.
- Pets whose account is suspended or deactivated, or whose profile is hidden, are left out.
- **Empty:** `{ "data": [] }` before the first adoption. The page shows an empty state.

## `GET /api/v1/pets`

Browse pets (`DS-01`, FR6).

| Query | Values | Meaning |
| --- | --- | --- |
| `q` | text | Part of the name, the breed, the city, the bio or a temperament tag |
| `species` | `dog` \| `cat` \| `other`, a list | Any of them |
| `age` | `puppy_kitten` (up to 12 months) \| `adult` (13 to 84) \| `senior` (over 84), a list | Any of them |
| `size` | `small` \| `medium` \| `large`, a list | Any of them |
| `temperament` | Temperament tags as the resume stores them (`Calm`, `Playful`…), a list; each up to 40 characters | Pets with **any** of them (added for FE-12) |
| `good_with` | `kids` \| `dogs` \| `cats`, a list | Pets that answered Yes to **every** one picked |
| `province`, `city` | one of the provinces of the sign-up form; a city of up to 80 characters | Same province, same city |
| `sex` (`female` \| `male`), `energy_level` (`low` \| `medium` \| `high`), `special_needs` (`none` \| `any`) | | Not on the screen yet |
| `sort` | `best_match` (default) \| `newest` \| `name_asc` | Best match needs a human who finished the quiz; otherwise newest first. Pets without a score come after the scored ones |
| `page`, `per_page` | default 20, at most 50 | The screen asks for 12 |

- **200:** a page of pet resumes (the public shape of `GET /me/pet`, `docs/api/profiles-and-matching.md`), each
  with `is_bookmarked`, and `match_score` (0 to 100) when the viewer is a human with a score for that pet. A pet
  that fails one of the viewer's dealbreakers is still listed, without a score.
- Only pets that are **Looking for a Home**. `status=in_process` lists the In Process ones instead; the screens
  don't send it. No other status can be asked for: `status=draft` is **422**.

## `GET /api/v1/pets/{pet}`

- **200:** the resume, plus:

  | Field | Meaning |
  | --- | --- |
  | `match` | For a human who finished the quiz: `{ passed_dealbreakers, failed_dealbreakers, dealbreakers, score, criteria, reasons }`. `failed_dealbreakers` holds any of `species_accepted`, `ok_with_kids`, `ok_with_other_pets`, `same_province`; `score` is 0 when one failed; `reasons` is up to three sentences |
  | `match_score`, `match_reasons` | The same score and reasons, only when the dealbreakers passed |
  | `invited_at` | For a human with a Home Profile: when their own Invite to Apply to this pet was sent, or `null` when there is none or the pet dismissed it. The resume shows "Invite sent" instead of the button (`RQ-01`, `bookmarks-and-invites.md`) |
  | `hired_by` | Adopted pets: who adopted, for the "Hired by …" banner (`DS-08`). `is_home_viewable` says whether this viewer may open the Furparent's Home Profile; when it is `false` the name is shown without a link |
  | `vet_records` | Only for the owner, an admin and a human with an approved request (`PR-07`) |
  | `caretaker_name`, `caretaker_contact_number` | Only for the owner, an admin and the human of a **confirmed** Meet & Greet (SEC-PRIV-02). The discovery screens don't show them; `MG-07` does |

- A read by someone other than the owner or an admin is counted as a profile view, once a day per viewer.
  `?source=` says where it came from.
- **404** for a Draft, and for a pet whose account isn't Active, unless the viewer is the owner or an admin
  (SEC-AUTHZ-04).

## `GET /api/v1/home-profiles`

Browse homes (`DS-02`, FR22). Public details only: the city and the household answers (SEC-PRIV-03).

| Query | Values | Meaning |
| --- | --- | --- |
| `q` | text | Part of the name, the headline, the city or About our home |
| `home_type` | `house` \| `condo` \| `apartment` \| `townhouse`, a list | Any of them |
| `outdoor_space` | `none` \| `balcony` \| `small_yard` \| `large_yard`, a list | Any of them |
| `activity_level` | `relaxed` \| `moderate` \| `active` \| `very_active`, a list | Any of them |
| `has_other_pets` | `none`, or a list of `dogs` \| `cats` \| `other` | No other pets, or any of the kinds picked. `none` wins over the rest of a list |
| `has_kids` | `yes` \| `no` | With or without kids under 6 or kids 6–12, the two groups the kids dealbreaker counts (added for FE-12) |
| `province`, `city` | one of the provinces of the sign-up form; a city of up to 80 characters | |
| `pet_experience`, `accepted_species`, `preferred_size` | | Not on the screen yet |
| `sort` | `best_match` (default) \| `newest` | Best match needs a pet whose resume is published. Homes without a score come after the scored ones |
| `page`, `per_page` | default 20, at most 50 | The screen asks for 12 |

- **200:** a page of Home Profiles (the public shape of `GET /me/home-profile`), each with `is_bookmarked`, and
  `match_score` when the viewer is a pet with a score for that home.

## `GET /api/v1/home-profiles/{home}`

- **200:** the Home Profile, plus `match` for a pet whose resume is published (the same shape as on a pet), and
  `match_score` / `match_reasons` when the dealbreakers passed. `province`, `contact_number` and `street_address`
  come only for the owner, an admin and the pet of a **confirmed** Meet & Greet (SEC-PRIV-02); the discovery
  screens don't show them.
- Counted as a profile view like a pet's.
- **404** when the account isn't Active, and when the home isn't Open to Adopt, unless the viewer is the owner, an
  admin, or a pet that already has a request or an invite with it (SEC-AUTHZ-04). **Open to Adopt off hides the
  home from everyone else, a Furparent's included** (agreed 2026-10-08): the account keeps working, it just isn't
  shown. A pet the home adopted still reads it, since its request with the home stands.

## `GET /api/v1/search`

The top-bar search (`GN-01`, `DS-03`).

It answers in two ways, and both say how many results there are of **every** kind, for the tabs.

- **Query:** `q` (the words, up to 100 characters), and either `limit` for the overview or `type` to page through
  one kind.

  | Query | Values | Meaning |
  | --- | --- | --- |
  | `limit` | default 10, at most 25 | How many of each kind the overview holds. The screen asks for 5 |
  | `type` | `pets` \| `home_profiles` \| `posts` | Answer with that kind only, as a paginated list |
  | `page`, `per_page` | default 20, at most 50 | With `type` |

- **200 without `type`**, the overview:

  ```json
  {
    "data": {
      "query": "quezon",
      "pets": [],
      "home_profiles": [],
      "posts": [{ "id": 4, "type": "for_hire", "title": null, "body": "…", "author_name": "Mochi", "created_at": "2026-10-01T02:00:00.000000Z" }],
      "totals": { "pets": 31, "home_profiles": 4, "posts": 1 }
    }
  }
  ```

- **200 with `type`**, one kind a page at a time, in the shape of every list. `meta` also carries the words and the
  same totals:

  ```json
  {
    "data": [],
    "meta": { "current_page": 2, "last_page": 2, "per_page": 20, "total": 31, "query": "quezon", "totals": { "pets": 31, "home_profiles": 4, "posts": 1 } },
    "links": {}
  }
  ```

- Pets and Home Profiles are in the shapes of the two Browse lists, without a match score, newest first.
  `posts[].type` is `for_hire` \| `hired` \| `update` \| `post` \| `adoption_story`.
- An empty `q` finds nothing: empty lists and totals of 0.
- `%` and `_` are searched for as themselves.
- **422** for a `type` that isn't one of the three, a `page` below 1, or more than 100 characters.

## The Apply button on a Home Profile (`DS-07`)

There is no endpoint that says whether a pet may apply to a home. The page reads the pet's own
`GET /adoption-requests?per_page=50` (newest first) and works it out (`schemas/apply-state.ts`): a request that is
Sent, On Hold, Approved, Meet Scheduled or Awaiting Decision with this home shows "View my request"; a Declined or
Not Adopted one closed less than 30 days ago shows when the pet can apply again (`RQ-06`). `POST /adoption-requests`
enforces both rules whatever the page shows (SEC-FE-05).

## Found while wiring FE-12

All fixed in the same PR (2026-10-07), with tests in `backend/tests/Feature/Discovery/`:

- **The filters were read in the controller without an allow-list** (SEC-INPUT-01, SEC-INPUT-03), so an unknown
  `species`, `size` or `sort` was accepted and simply matched nothing. The three endpoints now validate through
  Form Requests, and who may read a profile moved into two Policies (SEC-AUTHZ-01).
- **Search had no pagination and no totals**, only a cap of 25 per kind. It now counts every kind and pages
  through one (SEC-API-05).

- **Best match put unscored rows first on PostgreSQL.** The lists sort by `match_scores.score` descending over a
  left join, and PostgreSQL sorts rows without a score first that way (SQLite and MySQL sort them last). The lists
  now order "has a score" explicitly. The tests run on SQLite, so the order on PostgreSQL itself is still to be
  seen on the shared database.
- **"Hired by …" could lead to "Page not found"**: a Furparent's home with Open to Adopt off answers 404, by
  design, but the alumni profile linked to it anyway. The resume's `hired_by` now carries `is_home_viewable`, and
  the name is plain text when the home isn't shown.
- **Each row of a list ran three queries of its own** (view count, bookmark count, `is_bookmarked`). The lists and
  search now read them for the whole page at once.

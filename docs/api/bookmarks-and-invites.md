# Bookmarks and Invite to Apply endpoints

Module 5, Bookmarks (`BM-01`…`BM-04`, FR8, FR23) and the Invite to Apply part of Module 6 (`RQ-01`, `RQ-02`, FR9).
**Status: built (BE-15), checked and corrected for FE-14 (2026-10-08).** The FE-14 screens are being built against
this file; in mock mode the handlers in `frontend/src/lib/api/mock/handlers/` answer the same way. A change here
also changes the frontend calls, types, mocks and the tests on both sides in the same PR.

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /bookmarks` | pet, human | The account's saved profiles, a page at a time (`BM-01`, `BM-02`, `BM-04`) |
| `POST /bookmarks` | pet, human | Save one profile (`BM-03`) |
| `DELETE /bookmarks/pets/{pet}` | human | Remove the bookmark of that pet |
| `DELETE /bookmarks/home-profiles/{home}` | pet | Remove the bookmark of that home |
| `DELETE /bookmarks/{bookmark}` | pet, human | Remove a bookmark by its own id |
| `POST /pets/{pet}/invites` | human | Invite a pet to apply (`RQ-01`) |
| `GET /invites` | pet | The invites the pet received (`RQ-02`) |
| `POST /invites/{invite}/dismiss` | pet | Dismiss one (`RQ-02`) |

- **Who:** a signed-in **Active** account of the role listed. Signed out: **401**. Not Active: **403**
  `account_not_active`. Another role: **403**. An admin has no bookmarks and no invites.
- **A human saves pets and a pet saves homes**, never the other way round (proposal §9), so no account can save its
  own profile.
- **Which profile may be saved or invited** is what the account may open: `PetPolicy` and `HomeProfilePolicy`
  (`backend/app/Policies/`), the same as `GET /pets/{pet}` and `GET /home-profiles/{home}` (`discovery.md`). A
  profile the account may not open answers **404**, like one that doesn't exist (SEC-AUTHZ-04).
- Every write is rate-limited per account (`throttle:writes`, SEC-API-04).

## `GET /api/v1/bookmarks`

The Bookmarks screen: the pets a human saved (`BM-01`) or the homes a pet saved (`BM-02`), newest save first. The
role decides which; there is nothing to filter.

| Query | Values |
| --- | --- |
| `page`, `per_page` | default 20, at most 50. `page` below 1 is **422** |

- **200:** a page of rows. A human's row is `{ id, created_at, pet }`; a pet's is `{ id, created_at, home_profile }`.
  `pet` and `home_profile` are the public shapes of the Browse lists (`discovery.md`), with `is_bookmarked: true`,
  and `match_score` (0 to 100) when the viewer has a score with that one. No score, no `match_score`.
- **A saved profile that the account may no longer open is left out**, and out of `meta.total`: a pet whose account
  was suspended or deactivated, a home that turned Open to Adopt off (unless the pet has a request or an invite
  with it). The bookmark itself is kept, so it is back when the profile is.
- A pet that was adopted after it was saved stays, with its Hired status, as its profile does (`DS-08`).
- An empty page is `BM-04`.

## `POST /api/v1/bookmarks`

| Body | Sent by | |
| --- | --- | --- |
| `pet_id` | a human | The pet to save |
| `home_profile_id` | a pet | The home to save |

- **201:** `{ id, pet_id, home_profile_id, created_at }`; the one not saved is `null`.
- **200** with the same body when it was saved already: a second press is not an error, and there is still one
  bookmark.
- **422:** the id is missing or not a whole number above 0, or the field of the other role was sent (a human
  sending `home_profile_id`, a pet sending `pet_id`).
- **404:** a profile the account may not open (above).
- **409** `pet_already_adopted`: an adopted pet's profile is public but has no Bookmark (`DS-08`).

## `DELETE /api/v1/bookmarks/pets/{pet}` and `/bookmarks/home-profiles/{home}`

Removes the account's own bookmark of that profile. This is the one a resume or a Home Profile page uses: it knows
the profile and `is_bookmarked`, not the bookmark's id.

- **204** whether or not there was one, so pressing twice is not an error. The profile is not looked up: it may be
  hidden by now, and its bookmark can still be removed.

## `DELETE /api/v1/bookmarks/{bookmark}`

- **204** when the bookmark was the account's own. **404** for someone else's or one that doesn't exist
  (SEC-AUTHZ-04).

## `POST /api/v1/pets/{pet}/invites`

A human invites a pet to apply (`RQ-01`, FR9). An invite is a nudge: it is not a request, and it doesn't count
toward the pet's 3 open requests.

| Body | |
| --- | --- |
| `note` | Optional, up to 200 characters, trimmed. Empty is no note |

Nothing else is read: the pet is the one in the path and the home is the sender's own (SEC-INPUT-04).

- **201:** `{ id, pet_id, home_profile_id, note, created_at }`. The pet gets a notification that links to
  `/invites`, unless it turned "Adoption requests and invites" off, and the invite is written to the activity log.
- **404:** a pet the human may not open: a Draft, or a pet whose account isn't Active.
- **422:** `note` is too long or isn't text.
- **409**, with a `message` the screen shows as it is:

  | `code` | When |
  | --- | --- |
  | `not_open_to_adopt` | The human has no finished Home Profile, or Open to Adopt is off (proposal §5.5) |
  | `pet_not_looking_for_home` | The pet is In Process or adopted |
  | `request_already_open` | The pet already has an open request with this home, so there is nothing to nudge |
  | `invite_already_sent` | This home's invite to this pet is still live. After the pet dismisses it, the human may invite again |

The four checks and the insert run in one transaction that locks the sender's Home Profile, so two invites sent at
once can't both pass (SEC-AUTHZ-08).

## `GET /api/v1/invites`

Invites to Apply (`RQ-02`): the invites the pet received and hasn't dismissed, newest first.

| Query | Values |
| --- | --- |
| `page`, `per_page` | default 20, at most 50. `page` below 1 is **422** |

- **200:** a page of:

  | Field | Meaning |
  | --- | --- |
  | `id`, `created_at` | The invite |
  | `note` | The human's personal note, or `null`. Typed by a user: rendered as plain text (SEC-FE-01) |
  | `home_profile` | The home that invited, in the public shape of the Browse lists, with `is_bookmarked`, and `match_score` when the pet has a score with it. Never the address or the phone number (SEC-PRIV-03) |
  | `open_request_id` | The pet's open request with this home, when there is one: the card offers "View my request" instead of Apply |
  | `cooldown_until` | When the pet may apply to this home again: 30 days after its last Declined or Not Adopted result there (`RQ-06`). `null` when that has passed or never happened |

- **Apply is offered** when `open_request_id` and `cooldown_until` are both `null` and `home_profile.is_open_to_adopt`
  is true. `POST /adoption-requests` enforces all three whatever the card shows (SEC-FE-05).
- An invite from an account that isn't Active any more is left out (SEC-PRIV-05, SEC-ABUSE-04).
- A human doesn't list the invites they sent. The resume says whether theirs is out: `invited_at` on
  `GET /pets/{pet}` (`discovery.md`).

## `POST /api/v1/invites/{invite}/dismiss`

- **200:** `{ id, dismissed_at }`. The invite leaves the list. Dismissing it again answers the same, with the first
  time.
- **404:** another pet's invite, or one that doesn't exist. The human who sent it and an admin get the same answer
  (SEC-AUTHZ-04).

## Found while wiring FE-14

All fixed in the same PR (2026-10-08), with tests in `backend/tests/Feature/Bookmarks/` and
`backend/tests/Feature/AdoptionRequests/`; neither area had any before.

- **Any account could bookmark either kind**, an admin included, and nothing checked the profile beyond "not a
  Draft": a suspended account's pet, or a home with Open to Adopt off, could be saved, which also told the caller
  that the id exists. Saving now follows the role and the two Policies.
- **The list had no match score**, which `BM-01` shows on every card, sent every profile twice (`target` and
  `pet` / `home_profile`), and kept listing profiles that had since been hidden.
- **The docs and the code disagreed** on the type of a bookmark (`pets` / `homes` here, `pet` / `home_profile` /
  `home` in the code), and an unknown `type` on the list was ignored. There is no `type` any more.
- **Dismissing someone else's invite answered 403**, and inviting a Draft or a suspended account's pet answered 409
  `pet_not_looking_for_home`. Both told the caller that the id exists; both are 404 now.
- **A second invite was refused for ever**, where the rule is one *live* invite per pet and home (ERD note,
  2026-09-30): after a dismissal the human may ask again.
- **A pet that had already applied could still be invited**, which sent it a notification asking for what it had
  done. That is 409 `request_already_open` now.
- **A human could list invites** though `RQ-02` is the pet's screen, and `?include_dismissed=1` showed dismissed
  ones to no screen. Both are gone; the resume carries `invited_at` instead.
- **Each invite row ran two queries of its own** (the score and the cooldown). They are read once for the page.
- Validation moved into Form Requests (SEC-INPUT-01), who may do what into `BookmarkPolicy` and `InvitePolicy`
  (SEC-AUTHZ-01), and sending an invite into the `SendInvite` action.
- Removing a bookmark and dismissing an invite twice were errors; they answer the same as the first time now.
- The refusal said "Only Furparent accounts can invite"; a Furparent is a human who has adopted, and any human who
  is Open to Adopt may invite.

**Left as it is, to decide:** after a pet dismisses an invite the same human may send another straight away. Only
the general write limit (60 a minute per account) stands in the way of asking again and again. A wait after a
dismissal would be a new rule for proposal §5.

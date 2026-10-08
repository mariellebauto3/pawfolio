# Adoption Requests, Meet & Greet, Adoption & Admin Resolution API

Endpoints for Adoption Requests (`BE-16`), Meet & Greet Scheduling (`BE-17`), Post-Meeting Adoption Decisions & Alumni (`BE-18`), Scheduled Lifecycle Jobs (`BE-19`), and Admin Adoption Monitor & Resolution (`BE-20`).

## Adoption Requests (`BE-16`, `RQ-03..RQ-17`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/home-profiles/{home}/adoption-requests` | `pet` (Active) | Send an adoption request (`cover_letter` 50–600 chars, optional `caretaker_notes` up to 600). The rules and their 409 codes are listed under "The pet's side" below |
| `POST` | `/api/v1/adoption-requests` | `pet` (Active) | The same, with `home_profile_id` in the body |
| `GET` | `/api/v1/adoption-requests` | `pet`, `human` (Active) | Paginated list of the caller's own requests (`?tab=` or `?status=`), with `meta.status_counts` |
| `GET` | `/api/v1/adoption-requests/{id}` | `pet`, `human`, `admin` | Request detail (`unlocked_contact` / `contacts` revealed only after Meet & Greet confirmation; private `messages` thread visible only to the two participants per `RQ-19`). 404 for anyone else |
| `POST` | `/api/v1/adoption-requests/{id}/approve` | `human` (Active) | Approve a `sent` request (optional `approval_message`) -> transitions Pet to `in_process` and puts other `sent` requests `on_hold`. 404 for anyone but the human it was sent to |
| `POST` | `/api/v1/adoption-requests/{id}/decline` | `human` (Active) | Decline a request (optional `decline_reason`, `decision_message`) -> starts 30-day cooldown. 404 for anyone but the human it was sent to |
| `POST` | `/api/v1/adoption-requests/{id}/withdraw` | `pet` (Active) | Withdraw an open or in-process request (optional `withdraw_reason`); if in-process, releases Pet back to `looking_for_a_home` and restores `on_hold` requests to `sent`. 404 for anyone but the pet that sent it |
| `GET` | `/api/v1/adoption-requests/{id}/messages` | `pet`, `human` (Active) | List private thread messages on an in-process request |
| `POST` | `/api/v1/adoption-requests/{id}/messages` | `pet`, `human` (Active) | Send a message on an in-process request (`body` max 2000 chars) |

### The pet's side (`RQ-03`…`RQ-08`, `RQ-14`…`RQ-17`, FR24, FR25)

**Status: built (BE-16), checked and corrected for FE-15 (2026-10-08).** The pet's screens (FE-15) run against it
through `frontend/src/features/adoption-requests/api/requests.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/adoption-requests.ts` answers the same way. A change here also changes those
files, the types beside the calls, and the tests on both sides in the same PR.

- **Who:** a signed-in **Active** account. Signed out: **401**. Not Active: **403** `account_not_active`. Sending
  is a pet's; the list is a pet's or a human's; an admin reads requests under `/admin` (**403** here).
  `AdoptionRequestPolicy` decides (SEC-AUTHZ-01).
- **A request is read by its two sides and admins.** Anyone else is answered **404**, like a request that doesn't
  exist (SEC-AUTHZ-03, SEC-AUTHZ-04).
- The pet is always the caller's own and the status and dates are the system's: `pet_id`, `status`, `sent_at` and
  the rest are ignored when sent (SEC-INPUT-04, FR27).
- Every write is rate-limited per account (`throttle:writes`, SEC-API-04).

#### `POST /api/v1/home-profiles/{home}/adoption-requests`

| Body | |
| --- | --- |
| `cover_letter` | Required, 50 to 600 characters after trimming (`RQ-03`) |
| `caretaker_notes` | Optional, up to 600 characters, trimmed. Empty is no notes |

- **201:** `{ data: <request>, meta: { open_requests, max_open_requests } }`. `open_requests` counts this one, for
  "Open requests: 2 of 3" on Request sent (`RQ-04`); `data.expires_at` is 14 days after `data.sent_at`. The human
  gets a notification that links to `/requests/{id}`, unless they turned "Adoption requests and invites" off, and
  the request is written to the activity log.
- **422:** `cover_letter` "Write between 50 and 600 characters.", `caretaker_notes` "Keep the notes to 600
  characters or fewer.", `home_profile_id` "Choose a home to apply to." (the alias only).
- **404:** a home the pet may not open (`HomeProfilePolicy`, as `GET /home-profiles/{home}`): one that doesn't
  exist, one whose account isn't Active, or one with Open to Adopt off that the pet has no request or invite with.
- **409**, with a `message` the screen can show as it is. Checked in this order, inside one transaction that locks
  the pet's row, so two requests sent at once can't both pass (SEC-AUTHZ-08):

  | `code` | When | The screen |
  | --- | --- | --- |
  | `pet_resume_draft` | The pet's resume is still a Draft | The message, with a link to the resume |
  | `already_adopted` | The pet is Adopted — Hired | The message |
  | `pet_in_process` | A human approved one of the pet's requests: only one is in process at a time (§5.5) | The "request in process" dialog |
  | `request_already_open` | The pet has an open request with this home | The message, with "View my request" |
  | `request_cooldown` | This home Declined or Not Adopted the pet less than 30 days ago | `RQ-06` |
  | `open_request_limit` | The pet has 3 open requests | `RQ-05` |
  | `not_open_to_adopt` | Open to Adopt is off, for a pet that may still open the home | The message |

  The dialogs need more than the code (the three open requests, the dates of the last request), so the screen reads
  the pet's own requests (`GET /adoption-requests?per_page=50`) when one of these arrives.

#### `GET /api/v1/adoption-requests`

The caller's own requests, newest `sent_at` first: a pet's My requests (`RQ-07`, `RQ-08`) or a human's inbox
(`RQ-09`, `RQ-10`).

| Query | Values |
| --- | --- |
| `tab` | `active` (every open status), `new` (Sent), `in_progress` (every open status that isn't Sent), `closed` (every final status). Anything else is **422** |
| `status` | One or more statuses, comma-separated (`sent,on_hold`); wins over `tab`. An unknown status is **422** |
| `page`, `per_page` | default 20, at most 50. `page` below 1 is **422** |

- **200:** a page of requests, and `meta.status_counts`: how many of the caller's requests are in each status,
  whatever the tab or the page, e.g. `{ "sent": 1, "on_hold": 1, "declined": 2 }`. A status with none is left out.
  The tab counts and "2 of 3 open · 1 in process" come from it.
- Each request: `id`, `status`, `pet` (summary, with `approximate_age_months`), `home_profile`, `cover_letter`, `caretaker_notes`,
  `approval_message`, `decline_reason`, `decision_message`, `withdraw_reason`, and the dates `sent_at`,
  `expires_at`, `approved_at`, `meet_scheduled_at`, `awaiting_decision_at`, `overdue_flagged_at`, `closed_at`.
- `home_profile` is `{ id, full_name, city, profile_photo_url, is_furparent, home_type, household_members }`:
  public facts only, never the address or the phone number (SEC-PRIV-03).

#### `GET /api/v1/adoption-requests/{id}`

The request as above, and for the screens of FE-15: `match_score` (0 to 100, or `null`), `cooldown_until` (when
the pet may apply to this home again after Declined or Not Adopted; `null` once that has passed, or for any other
status) and `is_thread_open`. The Meet & Greet, the slots, the thread and `contacts` ride along for the screens
that follow; `contacts` is `null` until a Meet & Greet is confirmed (SEC-PRIV-02).

#### `POST /api/v1/adoption-requests/{id}/withdraw`

| Body | |
| --- | --- |
| `withdraw_reason` | Optional: `found_better_match`, `caretaker_cant_make_schedule`, `pet_no_longer_available` or `other` (`RQ-16`). Empty is no reason; anything else is **422** |

- **200:** the request, now `withdrawn`, with `closed_at`. The human is notified, and the withdrawal is written to
  the activity log with the reason. There is no cooldown after a withdrawal.
- When it was the request in process, the pet goes back to Looking for a Home, an active Meet & Greet ends, and
  the pet's requests On Hold go back to Sent with a fresh 14 days (`expires_at`); `sent_at` stays the day each
  was sent.
- **404:** anyone but the pet that sent it, the human it was sent to and an admin included (SEC-AUTHZ-04).
- **409** `request_already_closed`: it has already reached a final status.

#### Found while wiring FE-15

All fixed in the same PR (2026-10-08), with tests in
`backend/tests/Feature/AdoptionRequests/PetAdoptionRequestsTest.php`; the pet's side had only the one lifecycle
test before.

- **Applying told anyone whose home an id is.** A home with Open to Adopt off answered 409 "{name} isn't open to
  adopt right now" to every pet, though its profile answers 404. Sending now follows `HomeProfilePolicy`: 404
  unless the pet may open the home.
- **Withdrawing someone else's request answered 403**, which told the caller that the id exists. It is 404 now.
- **A request restored from On Hold was re-dated**: `sent_at` was set to the day it came back, so the pet's own
  history and the days-to-adoption figure counted from the wrong day. Only `expires_at` restarts now.
- **The list took any `tab` or `status`**: an unknown tab listed everything and an unknown status listed nothing.
  Both are 422 now (SEC-INPUT-03). **An admin got every request on the platform** from this list; the monitor
  under `/admin` is where an admin reads them.
- **The list had no counts**, so the tabs of `RQ-07` and "2 of 3 open · 1 in process" had nothing to show
  without a request per tab. `meta.status_counts` gives them in one.
- **A sent request didn't say how many are open now** (`RQ-04`); `meta.open_requests` does.
- **A row had only the home's name and city**, where `RQ-07` shows the home type and the household too.
- **This file said the cover letter is 40 to 1200 characters.** The code and the screens say 50 to 600
  (SEC-INPUT-05).
- The refusals spoke to the caretaker ("Your pet already has…") and spelled resume with accents; they speak to
  the pet now, and write resume without them (general guidelines §4).
- Validation moved into Form Requests (SEC-INPUT-01) and who may do what into `AdoptionRequestPolicy`
  (SEC-AUTHZ-01).

**Agreed (2026-10-08):** a pet that is In Process can't apply to another home (`pet_in_process`), and can't be
invited to apply either (`pet_not_looking_for_home`, `bookmarks-and-invites.md`). A pet that is only applying, with
Sent requests and none approved, can do both. The LoFi's `RQ-03` and `RQ-05` show a pet with a Meet Scheduled
request sending another; that sample data is not the rule (`project-rules/backend-guidelines.md` §4).

**Left as it is, to decide:**

- **The send, withdraw, approve and decline rules still live in the controller**, not in Actions (backend
  guidelines §3). Moving them is one change for the whole of BE-16, and wants a PR of its own.
- **The human can read `withdraw_reason`** on the request. The Withdraw dialog tells the pet so.

### The human's side (`RQ-09`…`RQ-13`, FR10)

**Status: built (BE-16), checked and corrected for FE-16 (2026-10-08).** The human's screens (FE-16) run against it
through the same `frontend/src/features/adoption-requests/api/requests.ts`, and mock mode answers the same way.

- **Who:** a signed-in **Active** human reads the requests sent to their own home, and answers them. Anyone else
  who approves or declines a request is answered **404**, like a request that doesn't exist: another human, the pet
  that sent it, an admin (`AdoptionRequestPolicy`, SEC-AUTHZ-04).
- The new status and its dates are the system's: `status`, `approved_at`, `closed_at` and the rest are ignored
  when sent (SEC-INPUT-04, FR27).

#### The inbox: `GET /api/v1/adoption-requests?tab=`

As for a pet (above), with the three tabs of `RQ-09` and `RQ-10`: `new` (Sent), `in_progress` and `closed`.
**`in_progress` is every open status that isn't Sent, On Hold included**, so the three tabs share out every
request and none is lost between them. A request's `pet` is `{ id, name, species, breed, city, status, photo_url,
approximate_age_months }`: the public summary, never the caretaker's name or number (SEC-PRIV-02).

`GET /adoption-requests/{id}` answers a human as it answers a pet; `match_score` is the score both sides see.

#### `POST /api/v1/adoption-requests/{id}/approve`

| Body | |
| --- | --- |
| `approval_message` | Optional, up to 600 characters, trimmed. Empty is no message. The pet reads it on the request |

- **200:** the request, now `approved`, with `approved_at` and a new `expires_at` 14 days on: the time the pet has
  to book a Meet & Greet. In the same transaction the pet becomes In Process and its other Sent requests go On
  Hold (their `expires_at` is cleared). The pet is notified, and so is each human whose request was paused; the
  approval and the pet's new status are written to the activity log.
- **422:** `approval_message` "Keep the message to 600 characters or fewer."
- **409**, with a `message` the dialog shows as it is:

  | `code` | When |
  | --- | --- |
  | `invalid_request_state` | The request is no longer Sent: answered already, On Hold, withdrawn or expired |
  | `request_expired` | Its 14 days are over, though the scheduled job hasn't closed it yet |
  | `pet_unavailable` | Another home approved the pet first, or it was adopted |

#### `POST /api/v1/adoption-requests/{id}/decline`

| Body | |
| --- | --- |
| `decline_reason` | Optional: `not_right_fit`, `not_adopting_now`, `another_pet_joining` or `other` (`RQ-13`). Empty is no reason; anything else is **422** |
| `decision_message` | Optional, up to 600 characters, trimmed. Empty is no message |

- **200:** the request, now `declined`, with `closed_at` and `cooldown_until` 30 days on: until then the pet can't
  apply to this home again (`request_cooldown`). The pet is notified and reads the reason and the message on the
  request; the decline is written to the activity log with the reason.
- **422:** an unknown reason, or a message over 600 characters.
- **409** `invalid_request_state`: the request has already reached a final status, or its Meet & Greet is already
  scheduled.
- The API also accepts a decline of a request that is On Hold or Approved (an Approved one frees the pet and its
  requests On Hold). The screens offer Decline on a new request only, as the LoFi does (`RQ-11`); the decision
  after a Meet & Greet has its own endpoint (BE-18).

#### Found while wiring FE-16

All fixed in the same PR (2026-10-08), with tests in
`backend/tests/Feature/AdoptionRequests/HumanAdoptionRequestsTest.php`.

- **Approving or declining someone else's request answered 403**, which told the caller that the id exists. Both
  are 404 now, as withdrawing became with FE-15.
- **A request On Hold was in none of the inbox's tabs.** `in_progress` listed Approved, Meet Scheduled and
  Awaiting Decision only, so a paused request showed under no tab while it was still counted. It lists every open
  status that isn't Sent now.
- **A row had no age**, where `RQ-09` shows the breed, the age and the city. A request's pet carries
  `approximate_age_months`.
- Validation moved into Form Requests (SEC-INPUT-01), with messages the dialogs show, and who may answer into
  `AdoptionRequestPolicy` (SEC-AUTHZ-01). The two messages are trimmed before they are counted.

**Left as it is, to decide:**

- **The request thread.** The API has it (`/messages`, open while a request is in process), but whether Pawfolio
  keeps it is still open (FE-30). No screen shows or promises it: the "thread opens once the human approves" card
  FE-15 put on the pet's request page is gone until that is decided.
- **A notification is not sent** to an account that turned "Adoption requests and invites" off, so "the pet is
  notified" means "unless it asked not to be". The screens' toasts don't claim it.

## Meet & Greet (`BE-17`, `MG-01..MG-11`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/meet-greet-slots` | `human`, `pet` (Active) | List availability slots (Human sees own slots; Pet with approved request passes `?home_profile_id=`) |
| `POST` | `/api/v1/meet-greet-slots` | `human` (Active) | Create availability slot(s) (`starts_at`, `place_type`, `place_details`, optional `repeat` / `repeat_weeks` 1–4) |
| `DELETE` | `/api/v1/meet-greet-slots/{slot}` | `human` (Active) | Soft-delete an unbooked availability slot |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet` | `pet` (Active) | Book an available slot (`slot_id` / `meet_greet_slot_id`) on an `approved` request |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/confirm` | `human` (Active) | Confirm booking -> transitions request to `meet_scheduled` and unlocks contact details (`MG-07`, `SEC-PRIV-02`) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/propose-time` | `human` (Active) | Propose an alternative slot (`proposed_slot_id`, `end_details`) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/reschedule` | `pet`, `human` (Active) | Reschedule an active Meet & Greet (`slot_id`, `end_details`) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/cancel` | `pet`, `human` (Active) | Cancel an active Meet & Greet (`end_details`), returning request to `approved` |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/didnt-happen` | `pet`, `human` (Active) | Mark a past Meet & Greet as didn't happen (`action`: `rebook` or `cancel_request`) |

## Post-Meeting Decisions & Alumni (`BE-18`, `AD-01..AD-05`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/adoption-requests/{id}/adopt` | `human` (Active) | Record final adoption after meeting time has passed -> sets request `adopted`, Pet `adopted_hired`, Home `furparent_at`, creates `Adoption` row, closes `on_hold` requests, and creates automatic `hired` post |
| `POST` | `/api/v1/adoption-requests/{id}/decline-after-meeting` | `human` (Active) | Decline after meeting (`decline_reason`, `decision_message`) -> sets `not_adopted`, releases Pet back to `looking_for_a_home`, restores `on_hold` requests to `sent` |
| `GET` | `/api/v1/adoptions/{adoption}` | `pet`, `human`, `admin` | Fetch Alumni adoption record |

## Admin Monitor & Resolution (`BE-20`, `RQ-18..RQ-19`, `MG-12`, `AD-06..AD-08`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/adoption-requests` | `admin` | Paginated platform adoption requests (`?status=`, `?overdue=1`, `?q=`) |
| `GET` | `/api/v1/admin/adoption-requests/{id}` | `admin` | Admin request detail (timeline, audit trail, message count; thread messages remain private per `RQ-19`) |
| `POST` | `/api/v1/admin/adoption-requests/{id}/remind` | `admin` | Send decision reminder notification to both parties on an `awaiting_decision` request |
| `GET` | `/api/v1/admin/meet-and-greets` | `admin` | Paginated platform Meet & Greets (`?status=`) |
| `POST` | `/api/v1/admin/adoptions/{pet}/resolve/preview` | `admin` | Preview side effects of an admin resolution action (`AD-06`) |
| `POST` | `/api/v1/admin/adoptions/{pet}/resolve` | `admin` | Execute admin resolution (`mark_adopted_to_requester`, `return_to_looking_for_a_home`, `mark_adopted_off_platform`, `remove_furparent_link`) |
| `GET` | `/api/v1/admin/alumni` | `admin` | Paginated list of platform adoptions / Alumni (`AD-08`) |

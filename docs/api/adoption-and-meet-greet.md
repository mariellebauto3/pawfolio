# Adoption Requests, Meet & Greet, Adoption & Admin Resolution API

Endpoints for Adoption Requests (`BE-16`), Meet & Greet Scheduling (`BE-17`), Post-Meeting Adoption Decisions & Alumni (`BE-18`), Scheduled Lifecycle Jobs (`BE-19`), and Admin Adoption Monitor & Resolution (`BE-20`).

## Adoption Requests (`BE-16`, `RQ-03..RQ-17`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/home-profiles/{home}/adoption-requests` | `pet` (Active) | Send an adoption request (`cover_letter` 50–600 chars, optional `caretaker_notes` up to 600). The rules and their 409 codes are listed under "The pet's side" below |
| `POST` | `/api/v1/adoption-requests` | `pet` (Active) | The same, with `home_profile_id` in the body |
| `GET` | `/api/v1/adoption-requests` | `pet`, `human` (Active) | Paginated list of the caller's own requests (`?tab=` or `?status=`), with `meta.status_counts` |
| `GET` | `/api/v1/adoption-requests/{id}` | `pet`, `human`, `admin` | Request detail (`contacts` revealed only after Meet & Greet confirmation; `meeting_passed` and `adoption` for the decision and its outcome). 404 for anyone else |
| `POST` | `/api/v1/adoption-requests/{id}/approve` | `human` (Active) | Approve a `sent` request (optional `approval_message`) -> transitions Pet to `in_process` and puts other `sent` requests `on_hold`. 404 for anyone but the human it was sent to |
| `POST` | `/api/v1/adoption-requests/{id}/decline` | `human` (Active) | Decline a request (optional `decline_reason`, `decision_message`) -> starts 30-day cooldown. 404 for anyone but the human it was sent to |
| `POST` | `/api/v1/adoption-requests/{id}/withdraw` | `pet` (Active) | Withdraw an open or in-process request (optional `withdraw_reason`); if in-process, releases Pet back to `looking_for_a_home` and restores `on_hold` requests to `sent`. 404 for anyone but the pet that sent it |

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

The request as above, and for the screens of FE-15: `match_score` (0 to 100, or `null`) and `cooldown_until`
(when the pet may apply to this home again after Declined or Not Adopted; `null` once that has passed, or for any
other status). The Meet & Greet, the open slots and `contacts` ride along on the same answer
("What a request says about its Meet & Greet", below); `contacts` is `null` until a Meet & Greet is confirmed
(SEC-PRIV-02).

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

**Decided 2026-10-09: no request thread.** The LoFi draws one (`RQ-11`, `MG-03`, `MG-07`, `AL-04`), but the
proposal keeps messaging between a pet and a human as future scope (§10), and the proposal comes first. The two
sides reach each other through the request's own steps: the approval message, the booking, "propose another
time" with a message, and each side's contact details once a Meet & Greet is confirmed. The `/messages`
endpoints, `is_thread_open`, `messages_count` and the `request_messages` table are removed (BE-29, FE-30). If it
returns, it needs a way to report a message first (`project-rules/security-guidelines.md` §12).

**Left as it is, to decide:**

- **A notification is not sent** to an account that turned "Adoption requests and invites" off, so "the pet is
  notified" means "unless it asked not to be". The screens' toasts don't claim it.

## Meet & Greet (`BE-17`, `MG-01..MG-10`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/meet-greet-slots` | `human`, `pet` (Active) | A human's own slots still ahead (`?when=upcoming`, the default) or their past Meet & Greets (`?when=past`), a page at a time; a pet with an approved request passes `?home_profile_id=` for that home's open slots |
| `POST` | `/api/v1/meet-greet-slots` | `human` (Active) | Add a slot, or the same slot weekly (`starts_at`, `place_type`, `place_details`, optional `repeat_weeks` 1–4). Always answers a list |
| `DELETE` | `/api/v1/meet-greet-slots/{slot}` | `human` (Active) | Remove an open slot of their own (soft delete) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet` | `pet` (Active) | Book an open slot (`slot_id`) on an `approved` request |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/confirm` | `human` (Active) | Confirm the booking -> the request becomes `meet_scheduled` and contact details open (`MG-07`, `SEC-PRIV-02`) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/propose-time` | `human` (Active) | Offer another open slot instead (`proposed_slot_id`, optional `message`) -> the booking ends and the pet books again |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/reschedule` | `pet`, `human` (Active) | A pet moves its booking (`slot_id`, optional `reason`); a human's reschedule is a proposal (as `propose-time`) |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/cancel` | `pet`, `human` (Active) | Cancel the booking (`reason` required, optional `details`) -> the request returns to `approved` |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/didnt-happen` | `human` (Active) | Report a Meet & Greet whose time has passed as not having happened (`reason` required, optional `details`) -> the request returns to `approved` (`MG-13`, "The decision and the adoption" below) |

### Availability, booking and the meeting (`MG-01`…`MG-10`, FR11, FR26)

**Status: built (BE-17), checked and corrected for FE-17 (2026-10-08).** The screens (FE-17) run against it through
`frontend/src/features/meet-and-greet/api/slots.ts` and `api/meetings.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/meet-and-greet.ts` answers the same way. A change here also changes those
files, the types in `frontend/src/types/meet-and-greet.ts`, and the tests on both sides in the same PR.

- **Who:** a signed-in **Active** account. Signed out: **401**. Not Active: **403** `account_not_active`. A human
  keeps slots; only the two sides of a request act on its Meet & Greet, and anyone else, an admin included, is
  answered **404** like a request that doesn't exist (`AdoptionRequestPolicy`, SEC-AUTHZ-03, SEC-AUTHZ-04).
- Whose slot or booking it is comes from the session, and every status and date is the system's: `status`,
  `home_profile_id`, `confirmed_at` and the rest are ignored when sent (SEC-AUTHZ-02, SEC-INPUT-04, FR27).
- Every write is rate-limited per account (`throttle:writes`, SEC-API-04), and runs in a transaction that locks
  the request and the slot, so one slot is never booked twice (SEC-AUTHZ-08).
- Times are stored and sent in UTC. A notification that names a time writes it in Philippine time, as the screens
  show it.

#### A slot

`{ id, home_profile_id, starts_at, place_type, place_details }`. `place_type` is `public_spot`, `shelter` or
`caretaker_location`. `place_details` is the name of the place; it is `null` only for `caretaker_location`, which
is the pet's side to place once the meeting is confirmed. A slot is **open** while it is not removed, still ahead,
and held by no booking that is booked or confirmed.

#### `GET /api/v1/meet-greet-slots`

| Query | Values |
| --- | --- |
| `when` | `upcoming` (default) or `past`. Anything else is **422** |
| `home_profile_id` | A pet only: the home whose open slots to list |
| `page`, `per_page` | default 20, at most 50 |

- **200, a human, `upcoming`:** a page of their slots still ahead, soonest first, each a slot plus `is_booked` and
  `active_booking`: `null`, or `{ id, status, adoption_request_id, pet_name }` with `status` `booked` (waiting for
  the human to confirm) or `confirmed`.
- **200, a human, `past`:** a page of their confirmed Meet & Greets whose time has come, latest first:
  `{ id, adoption_request_id, pet_name, request_status, end_reason, slot }`. `request_status` is where the request
  stands now (`awaiting_decision`, `adopted`…); `end_reason` is set when the human reported that it didn't happen
  (`MG-13`). A meeting called off before its time never took place and is not listed.
- **200, a pet with `home_profile_id`:** that home's open slots, when the pet's request with it is Approved or
  Meet Scheduled; **403** otherwise. The request itself carries the same list (`available_slots`), which is what
  the screens read.
- **403** for a pet without `home_profile_id`, and for an admin.

#### `POST /api/v1/meet-greet-slots`

| Body | |
| --- | --- |
| `starts_at` | Required: a date and time still ahead and within 12 months |
| `place_type` | Required: `public_spot`, `shelter` or `caretaker_location` |
| `place_details` | Required unless `place_type` is `caretaker_location`; up to 255 characters, trimmed |
| `repeat_weeks` | Optional, 1 to 4: the same weekday and time for that many weeks in a row (`MG-02` "Weekly for 4 weeks"). `repeat` (`none`, `weekly_2`…`weekly_4`) is read the same way |

- **201:** `{ data: [slot, …] }`, always a list, one slot or several. Logged as `meet_greet_slots_added`.
- **422**, a message per field: `starts_at` "Choose a time that is still ahead.", "Choose a date within the next
  12 months.", "You already have a slot at that time." (or "…in one of these weeks."; nothing is added then);
  `place_type`; `place_details` "Say where to meet, such as the name of the park or the shelter.".
- **403** for anyone who isn't a human.

#### `DELETE /api/v1/meet-greet-slots/{slot}`

- **200:** `{ data: { deleted: true } }`. The slot is kept for the bookings that once used it.
- **404:** removed already, never there, or another human's.
- **409** `slot_has_active_booking`: a pet has booked it. The booking is moved or cancelled on the request first.

#### What a request says about its Meet & Greet

`GET /adoption-requests/{id}`, and every call below, answers the request with:

| Field | |
| --- | --- |
| `active_meet_and_greet` | The booking that is `booked` or `confirmed` now, or `null` |
| `latest_meet_and_greet` | The newest booking whatever became of it; it says why booking reopened |
| `available_slots` | The home's open slots, soonest first (at most 50), while the request is Approved or Meet Scheduled |
| `contact_unlocked`, `contacts` | `true` and the details only while a meeting is confirmed, and once its time has passed or the pet is adopted; otherwise `false` and `null` (SEC-PRIV-02) |
| `meeting_passed` | `true` once the confirmed meeting's time is behind us and until the request ends: the human's decision is open (`MG-11`, `MG-12`). True while the status still reads `meet_scheduled`, before the scheduled job (every 15 minutes) moves it to `awaiting_decision` |
| `adoption` | `{ id, adopted_at }` on an Adopted request, for its record (`AL-04`, `AL-06`); `null` for every other request, and once an admin removed the link |

A booking is `{ id, status, booked_at, confirmed_at, ended_at, ended_by, end_reason, end_details, slot,
proposed_slot }`. `ended_by` is `pet`, `human` or `null` (its time simply came). `end_reason` is a cancel reason,
`moved_to_another_day` (rescheduled or proposed, with `proposed_slot` the slot it moved to or was offered), or what
happened instead (`MG-13`). `contacts` is `{ caretaker_name, caretaker_contact_number, human_full_name,
human_contact_number, human_street_address, human_city, human_province }`; no list ever carries it.

#### `POST /api/v1/adoption-requests/{id}/meet-and-greet`

Body: `slot_id` (required; `meet_greet_slot_id` is read the same way).

- **201:** the request, still `approved`, with `active_meet_and_greet.status` `booked`. The human is notified.
  Booking again before the human confirms moves the booking to the new slot (`MG-04`).
- **409**, with a `message` the screen shows as it is:

  | `code` | When |
  | --- | --- |
  | `invalid_request_state` | The request isn't Approved (not yet, or a meeting is already scheduled) |
  | `slot_unavailable` | The slot was removed, has passed, or isn't this home's |
  | `slot_already_booked` | Another pet holds it |
  | `slot_unchanged` | It is the slot this request already holds |

#### `POST …/meet-and-greet/confirm`

- **200:** the request, now `meet_scheduled`, with `meet_scheduled_at`, no `expires_at`,
  `active_meet_and_greet.status` `confirmed` and `contacts`. The pet is notified; the change of status is logged.
- **409** `no_pending_booking` (nothing is waiting: the pet changed or cancelled it, or it is confirmed already) or
  `slot_passed` (its time went by before the answer).

#### `POST …/meet-and-greet/propose-time`

Body: `proposed_slot_id` (required: one of the human's own open slots), `message` (optional, up to 600 characters).

- **200:** the request, `approved` with a fresh 14 days to book, `active_meet_and_greet` `null`, and
  `latest_meet_and_greet` ended by the human with `proposed_slot` and the message in `end_details`. The pet is
  notified and books the offered slot or any other. `contacts` is `null` again.
- **409** `no_active_booking`, or the slot codes of booking (`slot_unavailable`, `slot_already_booked`,
  `slot_unchanged` for the slot the pet already booked).

#### `POST …/meet-and-greet/reschedule`

A pet's body: `slot_id` (required), `reason` (optional, up to 600 characters). A human's is that of `propose-time`.

- **200:** the old booking ended, a new one `booked` on the chosen slot, and the request `approved` with a fresh 14
  days: the human confirms the new time, and `contacts` is `null` until then. The human is notified and reads the
  reason.
- **409** `no_active_booking`, or the slot codes of booking.

#### `POST …/meet-and-greet/cancel`

Body: `reason` (required: `schedule_conflict`, `pet_unwell`, `weather_or_travel` or `other`), `details` (optional,
up to 600 characters).

- **200:** the booking ended with the reason, and the request `approved` with a fresh 14 days. The other side is
  notified with the reason, and reads who cancelled and why on the request (`latest_meet_and_greet`). `contacts`
  is `null` again.
- **422:** no reason, or one that isn't on the list. **409** `no_active_booking`.

#### Found while wiring FE-17

All fixed in the same PR (2026-10-08), with tests in `backend/tests/Feature/MeetAndGreet/`; before it the Meet &
Greet had only the one lifecycle test.

- **Acting on someone else's request answered 403**, which told the caller that the id exists. Booking,
  confirming, proposing, rescheduling and cancelling are 404 now, as approving and withdrawing became with FE-15
  and FE-16.
- **A reschedule could double-book a slot.** Booking checked that nobody else held the slot; rescheduling didn't.
  Both share one check now.
- **A human could propose a slot that had passed or that another pet had booked.** Only an open slot is offered
  now. Proposing a time that isn't a slot yet (`starts_at` in the body) is gone: it is added as a slot first, so it
  passes the same checks as every slot.
- **A booking could be confirmed after its time had passed**, which scheduled a meeting in the past and opened the
  contact details for it. It is 409 `slot_passed` now.
- **A slot that was gone answered 404**, like a request that doesn't exist. It is 409 `slot_unavailable`, with a
  message the screen can show.
- **The human's list mixed past and upcoming slots, was not paginated, and had nothing for "Past Meet & Greets"**
  (`MG-01`). It is `when=upcoming` or `when=past` now, a page at a time (SEC-API-05).
- **Adding slots answered one object or `{ slots: [...] }`**, depending on the count. It is always a list.
- **Two slots could be added at the same time of day**, so one stayed "open" after the other was booked. That is
  422 now.
- **`place_details` was required for a meeting at the caretaker's**, a place the human can't name. It is optional
  for that kind only.
- **A notification told the time in UTC** ("2:00 AM" for a 10:00 AM slot). It is written in Philippine time
  (`App\Support\PhilippineTime`).
- **A cancellation didn't tell the other side the reason**, though `MG-10` promises it. The notification names who
  cancelled and why.
- **Meet Scheduled went back to Approved without a status-change entry in the activity log** (reschedule, proposal,
  cancel). `adoption_request_booking_reopened` records it (SEC-LOG-01).
- **A booking didn't say which side ended it**, only a user id. `ended_by` says `pet` or `human`.
- **`open_slots_count` on a human's own Home Profile counted every slot**, past and booked ones too. It counts
  open slots now, as the request's `available_slots` does.
- This file said the bodies were `end_details` everywhere; they are `message`, `reason` and `details` as above.
- Validation moved into Form Requests (SEC-INPUT-01), with messages the screens show, and who may act into
  `AdoptionRequestPolicy` (SEC-AUTHZ-01).

**Left as it is, to decide:**

- **A slot can't be edited** (the LoFi's `MG-01` has "Edit"): there is no update endpoint. A human removes an open
  slot and adds another.
- **An offered slot isn't held for the pet.** Another approved pet can book it first; the pet then picks another.
- **The booking rules still live in the controller**, not in Actions (backend guidelines §3), as BE-16's do.
- **A meeting can still be cancelled or rescheduled after its time**, in the minutes before the status moves to
  Awaiting Decision. The screens offer the decision instead (`meeting_passed`), and either way booking reopens.
- **A notification is not sent** to an account that turned "Meet & Greets" off; the screens' toasts don't claim it.

## Post-Meeting Decisions & Alumni (`BE-18`, `MG-11..MG-14`, `AL-01..AL-06`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/adoption-requests/{id}/adopt` | `human` (Active) | Adopt once the Meet & Greet time has passed -> the request `adopted`, the pet `adopted_hired` and linked to its one Furparent, the home a Furparent, the pet's other open requests `closed`, and the pet's own "Hired" post |
| `POST` | `/api/v1/adoption-requests/{id}/decline-after-meeting` | `human` (Active) | Decline after the meeting (optional `decision_message`, `decline_reason`) -> `not_adopted`, the pet back to `looking_for_a_home`, its requests On Hold `sent` again, 30-day cooldown |
| `POST` | `/api/v1/adoption-requests/{id}/meet-and-greet/didnt-happen` | `human` (Active) | The meeting didn't take place (`reason`, optional `details`) -> the request `approved` again, booking reopens |
| `GET` | `/api/v1/adoptions/{id}` | `pet`, `human` (the two sides), `admin` | The adoption record: the link, the request's milestones, where the two met, the days to adoption, the cover letter. 404 for anyone else |

### The decision and the adoption (`MG-11`…`MG-14`, `AL-01`…`AL-06`, FR12, FR13, FR14, FR28)

**Status: built (BE-18), checked and corrected for FE-18 (2026-10-09).** The screens (FE-18) run against it through
`frontend/src/features/adoption/api/adoptions.ts` (adopt, the record) and
`frontend/src/features/meet-and-greet/api/meetings.ts` (decline after the meeting, "It didn't happen"). In mock
mode `frontend/src/lib/api/mock/handlers/adoption.ts` and `handlers/meet-and-greet.ts` answer the same way. A
change here also changes those files, the types beside the calls, and the tests on both sides in the same PR.

- **Who:** a signed-in **Active** human decides on a request sent to their own home. Signed out: **401**. Not
  Active: **403** `account_not_active`. Anyone else, the pet that sent it and an admin included, is answered **404**
  like a request that doesn't exist (`AdoptionRequestPolicy::decide`, SEC-AUTHZ-03, SEC-AUTHZ-04).
- **When:** only once the confirmed meeting's time has passed (§5.4, FR12, NFR3): the request is Awaiting Decision,
  or still Meet Scheduled on a slot that is behind us (the job that moves the status runs every 15 minutes, and
  nobody waits on it). The request says so itself: `meeting_passed`. Before that: **409**.

  | `code` | When |
  | --- | --- |
  | `meeting_not_yet_passed` | The meeting is confirmed and still ahead. Until then it is rescheduled or cancelled (`MG-09`, `MG-10`) |
  | `invalid_request_state` | The request isn't at a decision: not approved yet, booking open, or already decided, withdrawn or closed |
  | `already_adopted` | Adopt only: the pet already has a Furparent (§5.5) |

- The new status and its dates are the system's: `status`, `closed_at`, `adopted_at` and the rest are ignored when
  sent (SEC-INPUT-04, FR27). Nobody sets "Adopted" by hand; this one action does all of it.
- Every write is rate-limited per account (`throttle:writes`, SEC-API-04), and runs in a transaction that locks the
  request and, for an adoption, the pet's row, so two decisions at once can't both pass (SEC-AUTHZ-08).

#### `POST /api/v1/adoption-requests/{id}/adopt`

| Body | |
| --- | --- |
| `decision_message` | Optional, up to 600 characters, trimmed. Empty is no message. The screens send none (`AL-01` has no field for one) |

- **200:** the request, like every other answer, now `adopted`, with `closed_at`, `adoption: { id, adopted_at }`,
  `pet.status` `adopted_hired`, `home_profile.is_furparent` `true`, and `contacts` still open, so the two sides can
  arrange the handover. In the same transaction:
  - the pet becomes Adopted — Hired and an `adoptions` row links it to this home, its one Furparent (§5.5);
  - the home is a Furparent from now on (`furparent_at`, kept from the first adoption), and **Open to Adopt turns
    off**: the human turns it on again for another pet's requests. The Adopt dialog says so;
  - the pet's other open requests, the ones On Hold included, become `closed`, and their humans are notified (FR28);
  - the pet leaves search and matches (its match scores are removed), and its own "Hired" post goes on the feed;
  - the pet is notified ("You got Hired!"), and the adoption, the pet's new status and each closed request are
    written to the activity log (SEC-LOG-01).
- **422:** `decision_message` "Keep the message to 600 characters or fewer."
- **409**, **404:** as above.

#### `POST /api/v1/adoption-requests/{id}/decline-after-meeting`

| Body | |
| --- | --- |
| `decision_message` | Optional, up to 600 characters, trimmed. Empty is no message. The pet's caretaker reads it on the request (`MG-14`) |
| `decline_reason` | Optional, one of a decline's reasons (`RQ-13`); anything else is **422**. The dialog doesn't ask for one |

- **200:** the request, now `not_adopted`, with `closed_at`, `cooldown_until` 30 days on, `contact_unlocked`
  `false` and `contacts` `null`. The pet goes back to Looking for a Home, its requests On Hold are `sent` again
  with a fresh 14 days, and its match scores are worked out again. The pet is notified, and the decision is written
  to the activity log with the reason.
- **422**, **409**, **404:** as above.

#### `POST /api/v1/adoption-requests/{id}/meet-and-greet/didnt-happen`

| Body | |
| --- | --- |
| `reason` | Required: `didnt_show_pet_side`, `didnt_show_human_side`, `moved_to_another_day` or `other` (`MG-13`). A cancel reason is not one |
| `details` | Optional, up to 600 characters, trimmed. The pet's side reads both |

- **200:** the request, `approved` again with a fresh 14 days to book (`expires_at`), `awaiting_decision_at` and
  `overdue_flagged_at` cleared, `meeting_passed` `false`, `active_meet_and_greet` `null`, and
  `latest_meet_and_greet` ended by the human with the reason and the details. `contacts` is `null` again. The pet
  stays In Process and is notified with the reason; the report and the change of status
  (`adoption_request_booking_reopened`) are written to the activity log.
- **422:** `reason` "Choose what happened.", `details` "Keep the details to 600 characters or fewer."
- **409** `meeting_not_yet_passed` or `invalid_request_state`; **404** as above.

#### `GET /api/v1/adoptions/{id}`

- **200:** `{ id, pet, home_profile, adoption_request_id, adopted_at, link_removed_at, days_to_adoption,
  cover_letter, timeline: { sent_at, approved_at, meet_scheduled_at, meet_starts_at, adopted_at }, meeting }`.
  `pet` and `home_profile` are the public summaries. `days_to_adoption` counts whole days from the day the request
  was sent, at least 1. `meeting` is the slot the two met on (`starts_at`, `place_type`, `place_details`), or
  `null`. It never carries a phone number or an address (SEC-PRIV-02): those are `contacts` on the request.
- **Who:** the pet, its Furparent and admins (`AdoptionPolicy`). Anyone else, and an id that doesn't exist, is
  answered **404** (SEC-AUTHZ-03, SEC-AUTHZ-04). Once an admin removes the link (`AL-07`) only admins read it.

#### Found while wiring FE-18

All fixed in the same PR (2026-10-09), with tests in `backend/tests/Feature/Adoption/AdoptionDecisionTest.php`;
before it the decision had only the one lifecycle test.

- **Any signed-in account could read any adoption record**, cover letter and timeline included: `GET
  /adoptions/{id}` checked nothing. It answers the two sides and admins only now (`AdoptionPolicy`); see
  `project-rules/security-guidelines.md` §12.
- **Deciding on someone else's request answered 403**, which told the caller that the id exists. Adopt, decline
  after the meeting and "It didn't happen" are 404 now, as every other action on a request became with FE-15 to
  FE-17.
- **"It didn't happen" could be reported before the meeting time**, on any Meet Scheduled request. It is 409
  `meeting_not_yet_passed` until the time has passed, as §5.4 says.
- **A decision that came too late was refused with the wrong words**: a request already decided or withdrawn
  answered "available only after the scheduled Meet & Greet time has passed". The two cases have their own codes
  and messages now.
- **Adopt answered `{ adoption_id, adopted_at, request }`**, unlike every other action. It answers the request,
  which carries its `adoption`.
- **A request didn't say whether a decision is open**, so a screen had to compare clocks, and one opened in the
  minutes before the job ran had no way to know. `meeting_passed` says it.
- **A second adoption of the same pet was stopped only by the request's status.** The pet's row is locked and
  checked too (`already_adopted`, SEC-AUTHZ-08).
- **Requests closed by an adoption, and Awaiting Decision going back to Approved, left no status-change entry**
  in the activity log. `adoption_request_closed` and `adoption_request_booking_reopened` record them (SEC-LOG-01).
- **The decision's notifications ignored "Adoption requests and invites" being off**, and spoke about the pet
  ("Mochi got Hired!"). They follow the preference and speak to the pet now ("You got Hired!").
- **A meeting ended by a decision named the human as ending it**, which read as a cancellation. Only a
  cancellation, a reschedule or "It didn't happen" names a side (`ended_by`).
- Validation moved into Form Requests (SEC-INPUT-01), with messages the dialogs show, and who may decide into
  `AdoptionRequestPolicy` (SEC-AUTHZ-01).
- `DemoSeeder` seeds a request whose meeting time has passed (Siopao with Ana Santos, with a paused request to
  Marco Cruz), so the decision can be walked on a fresh local database.

**Left as it is, to decide:**

- **The confirmation box of `AL-01` is ticked in the browser and isn't sent**, like the admin's checklist
  (`security-guidelines.md` §12): Adopt waits for it, and the adoption is logged with the human's name.
- **The decision rules still live in the controller**, not in Actions (backend guidelines §3), as BE-16's and
  BE-17's do.
- **The pet's "Hired" post and its notifications reuse existing types** (`hired`; `request_approved` and
  `request_declined` for the alerts): the notifications module (NT) names its own when it is built.
- **A notification is not sent** to an account that turned "Adoption requests and invites" or "Meet & Greets"
  off; the screens' toasts don't claim it.

## Admin Monitor & Resolution (`BE-20`, `RQ-18..RQ-19`, `MG-15..MG-16`, `AL-07..AL-09`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/adoption-requests` | `admin` | Every adoption request, newest first (`?tab=`, `?status=`, `?q=`) |
| `GET` | `/api/v1/admin/adoption-requests/{id}` | `admin` | One request's record: milestones, Meet & Greet, the two accounts, who it waits on, what admins changed |
| `POST` | `/api/v1/admin/adoption-requests/{id}/remind` | `admin` | Remind the side that has the next step, at most once a day |
| `GET` | `/api/v1/admin/meet-and-greets` | `admin` | Every Meet & Greet booking (`?status=`). No screen reads it: see below |
| `GET` | `/api/v1/admin/adoptions/{pet}/resolve` | `admin` | What can be resolved for a pet: its Furparent link, its requests, and which of the four actions each offers |
| `POST` | `/api/v1/admin/adoptions/{pet}/resolve/preview` | `admin` | What an action would change, before anything is written (`AL-08`) |
| `POST` | `/api/v1/admin/adoptions/{pet}/resolve` | `admin` | Apply an action, with a required reason (`AL-07`, FR37) |
| `GET` | `/api/v1/admin/adoption-resolutions` | `admin` | Every manual change, newest first, with who made it and why (`?pet_id=`) |
| `GET` | `/api/v1/admin/alumni` | `admin` | Adoptions with their pet and Furparent. No screen reads it: see below |

### The admin's monitor (`RQ-18`, `RQ-19`, `MG-15`, `MG-16`, FR36)

**Status: built (BE-20), checked and corrected for FE-23 (2026-10-10).** The screens (FE-23) run against it through
`frontend/src/features/adoption-requests/api/admin-requests.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/admin-adoption.ts` answers the same way. A change here also changes those
files, the types beside the calls, and the tests on both sides in the same PR.

- **Who:** a signed-in **Active** admin. Signed out: **401**. Any other role, the two sides of the request
  included, and an admin account that isn't Active: **403** (SEC-AUTHZ-06, SEC-AUTHZ-07). A request that doesn't
  exist: **404**.
- **Nothing here changes a request.** Its status is the system's (FR27). A reminder only notifies, and a fix goes
  through Resolve adoption issue, below.
- **No phone number and no address** is in any of these answers (SEC-PRIV-02): monitoring a request doesn't need
  them. The record carries the two accounts' emails, which is how an admin tells accounts apart.

#### `GET /api/v1/admin/adoption-requests`

| Query | |
| --- | --- |
| `tab` | `all` (default), `meet_and_greets` (requests that have had a booking, `MG-15`), `overdue` (`MG-16`). Anything else: **422** |
| `status` | One request status (proposal §5.3). Anything else: **422** (SEC-INPUT-03) |
| `q` | Part of the pet's name or the human's full name, up to 100 characters |
| `page`, `per_page` | 20 a page by default, 50 at most; more is **422** (SEC-API-05) |

Each row is the request as every list sends it (the pet's and the home's summaries, the cover letter, the dates of
its milestones), and:

| Field | |
| --- | --- |
| `updated_at` | When anything about it last changed |
| `is_overdue` | `true` while it is Awaiting Decision and either the scheduled job flagged it (`overdue_flagged_at`) or 7 days have passed since `awaiting_decision_at` (§5.4). A request that was flagged and then decided is not overdue |
| `latest_meet_and_greet` | Its latest booking with its `slot` (when, the kind of place, the place's name), or `null` |

The Overdue tab's count is this list's `meta.total` with `tab=overdue`; the admin sidebar asks for one row to read
it.

#### `GET /api/v1/admin/adoption-requests/{id}`

The request as its own page reads it (`match_score`, `meeting_passed`, `adoption`, `meet_and_greet`,
`latest_meet_and_greet`), **without** `contacts`, `unlocked_contact`, `contact_unlocked` and `available_slots`,
and with:

| Field | |
| --- | --- |
| `updated_at`, `is_overdue` | As in the list |
| `parties` | `{ pet_user_id, pet_email, pet_account_status, human_user_id, human_email, human_account_status }`, for the links to the two accounts (`AC-07`) |
| `reminder` | `{ waiting_on: "pet" \| "human" \| null, last_sent_at, can_send }`. `can_send` is `false` when nobody has a step to take, or a reminder went out in the last 24 hours |
| `resolutions` | What admins changed on this request by hand, oldest first: `{ id, action, reason, pet: { id, name }, adoption_request_id, home_name, admin_name, created_at }` |

#### `POST /api/v1/admin/adoption-requests/{id}/remind`

No body. One in-app notification (urgency `warning`, linking to the request) goes to the side that has the next
step, in words that name the step:

| The request is | Reminded | "Reminder: …" |
| --- | --- | --- |
| Sent | the human | "{pet} is waiting for your answer" |
| Approved, nothing booked | the pet | "book your Meet & Greet with {home}" |
| Approved, a slot booked | the human | "confirm the Meet & Greet with {pet}" |
| Meet Scheduled with its time behind it, or Awaiting Decision | the human | "decide on the request from {pet}" |

- **200:** `{ reminded: true, recipient: "pet" | "human", recipient_name }`. The reminder is written to the
  activity log with the admin's name (`admin_request_reminder_sent`, SEC-LOG-01).
- **409** `no_reminder_needed`: nobody has a step to take (On Hold, a confirmed meeting still ahead, or a request
  that ended). **409** `already_reminded`: one went out for this request in the last 24 hours. Both come with a
  message the screen shows.

### Resolve adoption issue (`AL-07`, `AL-08`, FR37)

**Status: built (BE-20), checked and corrected for FE-23 (2026-10-10).** The screens run against it through
`frontend/src/features/adoption/api/resolutions.ts`; the rules are in
`backend/app/Actions/Adoption/ResolveAdoptionIssue.php`, and the mock handler above repeats them.

The only way a pet's or a request's status changes outside the normal flow (FR27, proposal §5.2). It is one of
**four actions**, never a status that is sent, and each applies to one situation only:

| `action` | Applies to | What it does |
| --- | --- | --- |
| `cancel_adoption` | A pet that is Adopted | The Furparent link is removed (`adoptions.link_removed_at`), the adopted request becomes `closed`, the pet is Looking for a Home again and returns to search and matches. The human **keeps the Furparent label** (§5.5), and Open to Adopt stays as they left it |
| `return_to_looking_for_a_home` | A pet that is In Process | Its request in process becomes `closed`, a booked Meet & Greet ends, the pet is Looking for a Home, and its requests On Hold are `sent` again with a fresh 14 days (§5.3) |
| `close_request` | One request that is Sent or On Hold | That request becomes `closed`. Nothing else changes. A request in process is ended with the action above, which also frees the pet |
| `reopen_meet_greet_booking` | A request that is Meet Scheduled or Awaiting Decision | The request goes back to `approved` with a fresh 14 days to book; a booking that still stands ends; the overdue flag is cleared. The pet stays In Process |

- **Who:** an Active admin, as above. A pet that doesn't exist: **404**.
- **The reason is required** on the change itself (up to 1000 characters): **422** `errors.reason` without one
  (FR37, SEC-AUTHZ-07). **Both accounts read it** in a notification that says what changed in plain words, and it
  is kept in `adoption_resolutions` and in the activity log with the admin's name: `admin_adoption_resolved` (the
  pet's status before and after), `admin_request_status_changed`, and `adoption_link_removed` when a link goes
  (NFR9, SEC-LOG-01).
- The change runs in one transaction with the pet's row locked, and the rules are checked again inside it, so two
  admins can't both resolve the same issue (SEC-AUTHZ-08).

#### `GET /api/v1/admin/adoptions/{pet}/resolve`

**200:** `{ pet, furparent, requests, actions }`.

| Field | |
| --- | --- |
| `pet` | The pet's summary with its `status`, and `user_id` for the link to its account |
| `furparent` | `{ home_profile_id, full_name, adopted_at, adoption_request_id }` while the link stands, otherwise `null` |
| `requests` | The pet's latest 50 requests, newest first: `{ id, status, home_name, sent_at, closed_at }` |
| `actions` | All four, in the order above: `{ action, available, request_ids, unavailable_reason }`. `request_ids` are the requests the action can be applied to; empty while `available` means it changes the pet alone. `unavailable_reason` is a sentence the screen shows under an action it can't offer |

#### `POST /api/v1/admin/adoptions/{pet}/resolve/preview` and `POST …/resolve`

| Body | |
| --- | --- |
| `action` | Required, one of the four. Anything else: **422** |
| `adoption_request_id` | The request it is for. May be left out when the action applies to exactly one request, or to the pet alone |
| `reason` | The change only. Required, up to 1000 characters |

- **Preview, 200:** `{ pet_id, pet_name, action, request: { id, home_name } | null, before, after,
  requests_restored, meeting_ended }`, where `before` and `after` are `{ pet_status, request_status,
  furparent_name }`, `requests_restored` counts the requests On Hold that go back to Sent, and `meeting_ended` says
  whether a booking that stands ends with it. Nothing is written.
- **Change, 200:** the resolution (`{ id, action, reason, pet, adoption_request_id, home_name, admin_name,
  created_at }`) with `pet_status` and the same `change`.
- **409**, with a message the screen shows:

  | `code` | When |
  | --- | --- |
  | `resolution_not_available` | The action doesn't apply to the pet or to that request as they stand: the message is the action's `unavailable_reason`, or says that the request moved on |
  | `resolution_request_required` | The action applies to several requests and none was named |

#### `GET /api/v1/admin/adoption-resolutions`

Paginated (20 a page, 50 at most), newest first, each row a resolution as above. `?pet_id=` narrows it to one pet.

### Alumni (`AL-09`, FR38)

The Alumni tab of the accounts list (`GET /api/v1/admin/accounts?tab=alumni`, BE-23) is the screen: adopted pets
with their Furparent and the day of the adoption. FE-23 adds "Resolve issue" to each row, which opens Resolve
adoption issue on that pet.

**What FE-23 changed in BE-20:**

- **Any of the four actions could be applied to any pet and any request**, whatever their status: reopening the
  booking of a request that was Adopted or Declined set it to Approved and the pet to In Process (an adopted pet
  included); "Close request" could close an Adopted request while the pet stayed Hired and linked; and with no
  request named, the pet's newest request was taken, whichever it was. Each action now applies to one situation
  only, and anything else is **409**.
- **"Close request" freed the pet** (Looking for a Home, requests On Hold back to Sent) even when the request it
  closed wasn't the one in process, though `AL-07` says other requests are not affected. It closes one Sent or On
  Hold request now, and changes nothing else.
- **"Return pet to Looking for a Home" left the pet's requests On Hold paused** and its booked Meet & Greet
  standing, and also removed an adoption link when there was one. It ends the process the way a decline after the
  meeting does (§5.3); removing a link is "Cancel adoption" only.
- **The notification to both accounts carried the action's code** ("… adoption status (cancel_adoption)"). It
  says what changed in plain words, and links to the request.
- **The screens had nothing to ask what applies** to a pet, and nothing to list for "Recent resolutions"
  (`AL-07`). `GET …/resolve` and `GET /admin/adoption-resolutions` are new. The preview answered statuses for an
  action that wouldn't be applied that way; it now reads the same plan the change applies.
- **A request's record sent both sides' phone numbers and the human's street address to the admin** once a meeting
  was confirmed (SEC-PRIV-02). It carries none now, and says who the request waits on instead.
- **A reminder went to the wrong side or to nobody's benefit**: to the human on a confirmed meeting that was still
  ahead, and to the pet on an Approved request whose slot was already booked. Its text asked to "update the status
  of adoption request #53". It goes to the side with the next step, names the step, and is limited to one a day
  per request.
- **A request that was flagged overdue and then decided still read as overdue** in the list. `is_overdue` follows
  the Overdue tab's rule now (`AdoptionRequest::isOverdue`, `scopeOverdue`).
- **`status` took any text and a comma-separated list, and `tab` any value**; both are allow-listed now, and
  `per_page` over 50 is refused instead of trimmed (SEC-INPUT-03).
- This file listed four actions the API never had (`mark_adopted_to_requester`, `mark_adopted_off_platform`,
  `remove_furparent_link`) and an `?overdue=1` filter; the four above and `tab=overdue` are the real ones, as the
  LoFi's `AL-07` and the `adoption_resolutions` table have them.
- The rules moved out of the controller into Actions (`ResolveAdoptionIssue`, `SendRequestReminder`), as backend
  guidelines §3 ask.

**Left as it is, to decide:**

- **`GET /admin/meet-and-greets` and `GET /admin/alumni` are not read by any screen.** The LoFi's Meet & Greets
  tab lists requests with their meeting (one row per request), which the requests list answers with
  `tab=meet_and_greets`; a list of bookings would show one request several times. The Alumni tab is the accounts
  list's. Both endpoints still answer, and their filters are allow-listed.
- **The admin's reason is read by both accounts.** `AL-08` says both are notified; the form says so beside the
  field, so an admin doesn't write there what the two sides shouldn't read.
- **A cancelled adoption leaves the pet's "Hired" post on the feed**, and the human keeps the Furparent label even
  when it was their only adoption (§5.5: "the Furparent label stays").
- **A closed or declined request can't be reopened.** Only a request that reached a confirmed Meet & Greet goes
  back to booking; anything else starts with a new request.
- **Notification preferences don't hold these back.** An admin's reminder and an admin's correction always reach
  the account.

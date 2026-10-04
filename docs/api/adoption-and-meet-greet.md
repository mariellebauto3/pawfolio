# Adoption Requests, Meet & Greet, Adoption & Admin Resolution API

Endpoints for Adoption Requests (`BE-16`), Meet & Greet Scheduling (`BE-17`), Post-Meeting Adoption Decisions & Alumni (`BE-18`), Scheduled Lifecycle Jobs (`BE-19`), and Admin Adoption Monitor & Resolution (`BE-20`).

## Adoption Requests (`BE-16`, `RQ-03..RQ-17`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/home-profiles/{home}/adoption-requests` | `pet` (Active) | Send an adoption request (`cover_letter` 40–1200 chars, optional `caretaker_notes`). Enforces atomic limits: max 3 open requests (`409 open_request_limit`), 1 in process (`409 pet_in_process`), 1 open per pair (`409 request_already_open`), 30-day cooldown (`409 request_cooldown`), and Open to Adopt (`409 not_open_to_adopt`) |
| `POST` | `/api/v1/adoption-requests` | `pet` (Active) | Alias for sending an adoption request with `home_profile_id` in body |
| `GET` | `/api/v1/adoption-requests` | `pet`, `human` (Active) | Paginated list of caller's adoption requests (`?status=` filter) |
| `GET` | `/api/v1/adoption-requests/{id}` | `pet`, `human`, `admin` | Request detail (`unlocked_contact` / `contacts` revealed only after Meet & Greet confirmation; private `messages` thread visible only to the two participants per `RQ-19`) |
| `POST` | `/api/v1/adoption-requests/{id}/approve` | `human` (Active) | Approve a `sent` request -> transitions Pet to `in_process` and puts other `sent` requests `on_hold` |
| `POST` | `/api/v1/adoption-requests/{id}/decline` | `human` (Active) | Decline a `sent` request (`decline_reason`, `decision_message`) -> starts 30-day cooldown |
| `POST` | `/api/v1/adoption-requests/{id}/withdraw` | `pet` (Active) | Withdraw an open or in-process request (`withdraw_reason`); if in-process, releases Pet back to `looking_for_a_home` and restores `on_hold` requests to `sent` |
| `GET` | `/api/v1/adoption-requests/{id}/messages` | `pet`, `human` (Active) | List private thread messages on an in-process request |
| `POST` | `/api/v1/adoption-requests/{id}/messages` | `pet`, `human` (Active) | Send a message on an in-process request (`body` max 2000 chars) |

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

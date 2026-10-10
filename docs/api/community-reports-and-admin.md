# Community Feed, Reports, Account Settings, Announcements, Analytics & Activity Logs API

Endpoints for Community Feed (`BE-21`), Reports & Moderation (`BE-22`), Account Settings & Admin Accounts (`BE-23`), Announcements (`BE-24`), Analytics (`BE-25`), and Activity Logs & CSV Exports (`BE-26`).

## Community Feed (`BE-21`, `FD-01..FD-07`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/feed` | Active member | Paginated community feed, newest first (`?type=`, `?author_user_id=`, `?page=`, `?per_page=`), with the latest published announcements for the reader's role in `meta.announcements` |
| `POST` | `/api/v1/posts` | `pet`, `human` (Active) | Create a post (`body`, optional `title`, `type`, `photos[]`). Auto-flags selling/payment keywords (`GCash`, `Maya`, `rehoming fee`, currency amounts) into `reports` (`SEC-ABUSE-03`) |
| `POST` | `/api/v1/posts/adoption-story` | `human` (Furparent) | Create an Adoption Story post (`adopted_pet_id` verified against `adoptions`, `title`, `body`, `photos[]`) |
| `GET` | `/api/v1/posts/{post}` | Active member | Post detail with threaded comments (top-level + 1-level replies) |
| `PATCH` | `/api/v1/posts/{post}` | Author (Active) | Edit own post (`title`, `body`) |
| `DELETE` | `/api/v1/posts/{post}` | Author / `admin` | Soft-delete own post (`deleted_at`) |
| `POST` | `/api/v1/posts/{post}/comments` | Active member | Add comment or 1-level reply (`body`, optional `parent_comment_id`) |
| `DELETE` | `/api/v1/comments/{comment}` | Author / `admin` | Remove comment (`removed_at`) |
| `POST` | `/api/v1/posts/{post}/reactions` | Active member | Toggle heart reaction on a post |
| `POST` | `/api/v1/comments/{comment}/reactions` | Active member | Toggle heart reaction on a comment |

### The feed as the screens use it (FE-20, checked 2026-10-09)

The frontend screens (`FD-01`…`FD-07`) run against these endpoints through
`frontend/src/features/community-feed/api/feed.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/community-feed.ts` answers the same way. A change here also changes those files,
`frontend/src/types/post.ts`, and the tests on both sides (`backend/tests/Feature/CommunityFeed/FeedScreensTest.php`,
`frontend/tests/unit/features/community-feed/`) in the same PR.

- **Who:** a signed-in **Active** account. Signed out: **401**. Not Active: **403** `account_not_active`.
- **Who posts and what type a post gets are never sent.** The author is the session's account. `POST /posts` makes
  an `update` for a pet and a `post` for a human; `for_hire` and `hired` are posted by the system when a resume goes
  live and when a pet is adopted (FR27, FR28). The screens send no `type`.
- **Every write is limited** to 60 a minute per account (`throttle:writes`, SEC-API-04): **429**.
- **An account that isn't Active is hidden with its words.** The posts and comments of a suspended or
  deactivated account are left out of every list and count, and its posts and comments answer **404** by their
  own address too (SEC-ABUSE-04, SEC-PRIV-05). Nothing is deleted: they are back when the account is Active again.
- **Words are text.** `title`, `body` and a comment's `body` are trimmed and stored as written. The frontend renders
  them as text and turns nothing in them into a link (SEC-FE-01, SEC-FE-02).

#### The post

```json
{
  "id": 12,
  "type": "update",
  "title": null,
  "body": "Had my first Meet & Greet today. I wore my best bandana.",
  "author": {
    "id": 17,
    "role": "pet",
    "display_name": "Pepper",
    "avatar_url": "http://localhost:8000/storage/pets/photos/5f0c….jpg",
    "profile_id": 10,
    "breed": "Aspin",
    "city": "Marikina",
    "is_furparent": false,
    "is_profile_viewable": true
  },
  "adopted_pet": null,
  "photos": [{ "id": 31, "url": "http://localhost:8000/storage/posts/photos/9d1e….jpg", "sort_order": 1 }],
  "reactions_count": 3,
  "comments_count": 2,
  "has_reacted": false,
  "created_at": "2026-10-09T02:15:00.000000Z"
}
```

| Field | |
| --- | --- |
| `type` | `for_hire`, `hired`, `update`, `post` or `adoption_story`. The card's badge |
| `title` | Set on adoption stories and on the two automatic posts; `null` on an update or a post |
| `author.id` | The **account's** id. A post or a comment is the viewer's own when it equals the session's id; `profile_id` is the pet's id or the Home Profile's id, for the link |
| `author.breed`, `author.city`, `author.is_furparent` | The public line under the name: a pet's breed and city, a human's city and Furparent label. Never an address or a phone number (SEC-PRIV-02, SEC-PRIV-03) |
| `author.is_profile_viewable` | Whether **this viewer** may open the author's resume or Home Profile, by the same policy as `GET /pets/{id}` and `GET /home-profiles/{id}`. `false` for a Draft resume and for a home whose Open to Adopt is off: the frontend then shows the name without a link (SEC-AUTHZ-04) |
| `adopted_pet` | The pet an adoption story or a Hired post is about: `{ id, name, species, breed, city, status, photo_url }`, or `null` |
| `photos` | Up to 4, in order. Public storage (SEC-FILE-04); re-encoded and stripped of EXIF by the API (SEC-FILE-05) |
| `comments_count` | The comments and replies the post's page lists: not a removed one, not one by an account that isn't Active, and not a reply whose comment is hidden for either reason |
| `has_reacted` | Whether the viewer liked it |

A comment is `{ id, post_id, parent_comment_id, body, author, reactions_count, has_reacted, created_at }`, with the
same `author` block.

#### `GET /api/v1/feed`

Newest first. Posts of accounts that aren't Active, removed posts and deleted posts are left out.

| Query | Values |
| --- | --- |
| `author_user_id` | Only this account's posts ("More from…" on `FD-05`, "Latest activity" on `PR-01`) |
| `type` | One or more types, comma-separated |
| `page`, `per_page` | default 20, at most 50 |

`meta` carries the usual page fields and **`announcements`**: the 3 latest published announcements for Everyone and
for the reader's role, each `{ id, title, message, audience, published_at }`.

#### `GET /api/v1/posts/{post}`

The post, plus `comments`: the top-level comments, oldest first, each with `replies` (one level, oldest first).
**404** for a post that was deleted, removed by an admin, or written by an account that isn't Active, like one
that never existed. An admin still reads a removed post and a non-Active account's post, to moderate.

#### `POST /api/v1/posts` and `POST /api/v1/posts/adoption-story`

JSON, or `multipart/form-data` when there are photos (`photos[]`, each a JPG or PNG up to 5 MB, at most 4). **201**
with the post.

| Field | `POST /posts` | `POST /posts/adoption-story` |
| --- | --- | --- |
| `body` | required, up to 2,000 characters | required, up to 3,000 |
| `title` | optional, up to 160 (the screens send none) | required, up to 160 |
| `adopted_pet_id` | — | required: a pet the caller adopted on Pawfolio |
| `photos[]` | optional | optional |

- **422** by field: `body`, `title`, `adopted_pet_id`, `photos`, and `photos.0`… for a file that isn't a JPG or PNG
  or is over 5 MB. **413** when the request is larger than PHP accepts (`post_max_size`).
- Adoption story: **403** with a message to show for an account that isn't a human with a Home Profile, and for a
  pet that isn't linked to that home by an adoption. The frontend offers the form only to a human whose own Home
  Profile (`GET /me/home-profile`) lists adopted pets, and the API checks the adoption whatever was sent
  (SEC-AUTHZ-02).

#### `PATCH /api/v1/posts/{post}` and `DELETE /api/v1/posts/{post}`

- `PATCH` takes `body` (required, up to 3,000) and optionally `title`; photos can't be changed. It answers the post
  with the viewer's own like kept (`has_reacted`). **403** for anyone but the author.
- `DELETE` answers `{ "data": { "deleted": true } }`. **403** for anyone but the author or an admin. The post then
  answers **404** everywhere, and the frontend reads a `DELETE` that answers 404 as already deleted.

#### Comments and likes

| Call | Body | Answers |
| --- | --- | --- |
| `POST /posts/{post}/comments` | `body` (required, up to 1,000), optional `parent_comment_id` | **201** with the comment (no `replies` key). **404** when the post or the parent is gone or hidden; **422** `parent_comment_id` for a reply to a reply. The post's author is notified (`post_comment`, link `/posts/{id}`) |
| `DELETE /comments/{comment}` | — | `{ "deleted": true }`. Allowed to the comment's author, the author of the post it is on, and admins; **403** otherwise. Its replies stop being listed and counted with it |
| `POST /posts/{post}/reactions` | — | Toggles the caller's like: `{ "reacted": true, "reactions_count": 4 }`. **404** when the post is gone or hidden |
| `POST /comments/{comment}/reactions` | — | The same for a comment or a reply. **404** when the comment, or the post it is on, is gone or hidden |

## Reports & Moderation (`BE-22`, `RP-01..RP-05`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/reports` | Active member | Submit a report on a `profile`, `post`, `comment`, or `account`. Reporting your own content or account answers **422** with the reason under `errors.target_id` |
| `GET` | `/api/v1/admin/reports` | `admin` | Paginated reports queue (`?status=`, `?target_type=`, `?reason=`), one row per reported item, most reported first |
| `GET` | `/api/v1/admin/reports/{report}` | `admin` | Report detail with the content, every report on the item, and the reported account |
| `POST` | `/api/v1/admin/reports/{report}/actions` | `admin` | Resolve report (`remove_content`, `suspend_account`, `remove_content_and_suspend`, `dismiss`), or `restore_content` on a resolved one |

### Reports as the screens use them (FE-21, checked 2026-10-09)

Who is reporting and who is acting come from the session, and a report's `status` is the system's: none of them is
ever sent (SEC-AUTHZ-02, FR27). Writes are rate-limited (`throttle:writes`).

#### `POST /api/v1/reports` (`RP-01`)

| Field | Rules |
| --- | --- |
| `target_type` | Required. `profile`, `post`, `comment` or `account` |
| `post_id` / `comment_id` | The post or the comment, for those two target types |
| `pet_id` / `home_profile_id` | The resume or the Home Profile, for `profile` |
| `reported_user_id` | The account, for `account` |
| `reason` | Required. `fake_or_misleading_profile`, `selling_or_trading_animals`, `harassment_or_hate`, `animal_welfare_concern`, `spam_or_scam` or `something_else` |
| `details` | Up to 1000 characters. Required with `something_else` |

Whose the item is, the API reads from the record. **201** answers `{ id, target_type, reason, status: "open", created_at }`.

| Answer | When |
| --- | --- |
| **422** `errors.target_id` | It is the reporter's own post, comment, profile or account: "You cannot report your own content or account." |
| **422** `errors.reason`, `errors.details`, `errors.target_type` | A value the API doesn't know, or `something_else` without details |
| **409** `report_already_open` | This account already reported the item and that report is still open. Once it is resolved, the item can be reported again |
| **404** | The post, the comment or the account doesn't exist. An admin's account is answered the same way |

#### `GET /api/v1/admin/reports` (`RP-03`)

`?status=open` (the default) or `resolved`; `?target_type=` and `?reason=` take the values above; `?page=`,
`?per_page=` (20, at most 50). A value the API doesn't know answers **422** (SEC-INPUT-03).

One row per reported item: the reports on the same account, target type, post and comment that share the row's
status, stood for by the latest of them. Most reported first, then newest. `meta.total` counts items, which is the
sidebar's number.

```json
{
  "id": 14, "target_type": "post", "reason": "spam_or_scam", "details": null, "status": "open",
  "reports_count": 3, "post_id": 9, "comment_id": null,
  "reporter": { "id": 8, "display_name": "Ana Santos", "role": "human" },
  "reported_user": { "id": 17, "display_name": "Pepper", "role": "pet", "status": "active", "profile_id": 10 },
  "report_action": null,
  "created_at": "2026-10-09T15:41:00.000000Z"
}
```

`reports_count` is how many reports on the item share the row's status. On a resolved row, `report_action` is
`{ id, action, reason, notify_reporters, performed_by, created_at }`; `performed_by` is the admin's name.

#### `GET /api/v1/admin/reports/{report}` (`RP-04`)

The row above, and:

| Field | What |
| --- | --- |
| `reported_user.joined_at`, `reported_user.reports_against_count` | When the account was created, and every report ever filed against it |
| `content_preview.post` | `{ id, type, title, body, photos: [{ id, url }], is_removed, is_deleted, created_at }`, or `null`. A report on a comment carries the post it is under |
| `content_preview.comment` | `{ id, body, is_removed, created_at }`, or `null` |
| `sibling_reports` | Every report on the item, resolved ones included, newest first: `{ id, reporter_id, reporter_name, reason, details, status, created_at }` |

A profile or an account report has neither a post nor a comment.

#### `POST /api/v1/admin/reports/{report}/actions` (`RP-05`)

`{ action, reason, notify_reporters }`. `reason` is always required, up to 1000 characters (SEC-AUTHZ-07);
`notify_reporters` defaults to `true`. One action writes one `report_actions` row and resolves every open report
on the item; each action is written to the activity log (SEC-LOG-01). The answer is the report as it now stands,
in the shape of the detail without `sibling_reports`.

| `action` | What it does |
| --- | --- |
| `remove_content` | Hides the comment, or the post when the report is on a post. The owner is notified with the reason |
| `suspend_account` | Suspends the reported account and ends its sessions (SEC-ABUSE-04). The owner reads the reason on `AU-21` |
| `remove_content_and_suspend` | Both |
| `dismiss` | Resolves the reports. The owner is not told |
| `restore_content` | On a resolved report: makes removed content visible again. The report stays resolved |

| Answer | When |
| --- | --- |
| **422** `errors.reason` | No reason |
| **422** `errors.action` | An unknown action; a removal on a profile or an account report, which has nothing to remove; a suspension of an account that isn't Active |
| **409** `report_already_resolved` | Another admin acted first. Nothing is done twice |
| **409** `nothing_to_restore` | `restore_content` when the content isn't removed |

## Account Settings & Admin Account Management (`BE-23`, `AC-01..AC-10`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/settings` | Active member | Account info, notification preferences, and locked-detail change requests |
| `PATCH` | `/api/v1/settings` | Active member | Update contact fields (`caretaker_name`, `caretaker_contact_number` / `contact_number`, `street_address`) and `notification_preferences` |
| `POST` | `/api/v1/settings/password` | Active member | Change password (`current_password`, `password`, `password_confirmation`) |
| `POST` | `/api/v1/settings/change-requests` | Active member | Request a change to a locked field (`field`, `new_value`, `reason`, optional `document`) |
| `POST` | `/api/v1/settings/deactivate` | Active member | Self-deactivate account (`password`, optional `reason`), closing open requests and ending sessions |
| `GET` | `/api/v1/admin/accounts` | `admin` | Paginated accounts list (`?tab=`, `?role=`, `?status=`, `?q=`) |
| `GET` | `/api/v1/admin/accounts/{account}` | `admin` | Admin account detail with verification, actions, requests, reports, and change requests |
| `POST` | `/api/v1/admin/accounts/{account}/suspend` | `admin` | Suspend an Active account (`reason`): sessions end, open requests close |
| `POST` | `/api/v1/admin/accounts/{account}/reactivate` | `admin` | Reactivate a suspended account (`reason`) |
| `POST` | `/api/v1/admin/accounts/{account}/deactivate` | `admin` | Admin-deactivate account (`reason`): sessions end, open requests close |
| `GET` | `/api/v1/admin/change-requests` | `admin` | Paginated locked-detail change requests |
| `GET` | `/api/v1/admin/change-requests/{changeRequest}/document` | `admin` | The supporting document itself (JPG, PNG or PDF), never a link to it |
| `POST` | `/api/v1/admin/change-requests/{changeRequest}/review` | `admin` | Approve or deny a locked-detail change request (`decision`, `reason`; required to deny) |

### Settings and accounts as the screens use them (FE-22, checked 2026-10-10)

Whose settings they are comes from the session; an account's role and status are never taken from a request, and
an admin's action is its own endpoint, never a status that is set (SEC-AUTHZ-02, SEC-INPUT-04, FR27). Writes are
rate-limited (`throttle:writes`).

#### Owner (`AC-01`…`AC-05`)

| Call | Takes | Answers |
| --- | --- | --- |
| `GET /settings` | — | `{ account: { id, role, status, email, display_name }, locked_details, contact_details, notification_preferences: { requests_and_invites, meet_and_greets, post_activity, announcements }, change_requests }`. A pet's `locked_details` are `name`, `species`, `breed`, `approximate_age_months`; a human's `full_name`, `birthdate` (YYYY-MM-DD), `city`, `province`. A pet's `contact_details` are the caretaker's name and number, a human's their number and street address (owner only, SEC-PRIV-02) |
| `PATCH /settings` | Any of the role's contact fields, `notification_preferences: { key: bool }` | The settings as above. **422** for a number that isn't a Philippine mobile number ("Enter a mobile number like 0917 123 4567.") |
| `POST /settings/password` | `current_password`, `password`, `password_confirmation` | `{ password_changed: true }`. Every other session ends; this one stays. **422** `current_password` when wrong, `password` when it breaks the sign-up rules, is known from a leak, doesn't match its confirmation or is the current one |
| `POST /settings/change-requests` | `field`, `new_value`, `reason`, optional `document` (multipart) | **201** `{ id, field, new_value, reason, status: "pending", has_document, reviewed_at, created_at }`. `new_value` is held to the sign-up rule of `field` (species and province from their lists, an age of 1 to 360 months, a birthdate of someone 18 or older) and must differ from the current value: **422** `new_value`. **409** `change_request_pending` while one for that field waits |
| `POST /settings/deactivate` | `password`, optional `reason` (500) | `{ deactivated: true }`; the session is over. **422** `password` when wrong |

#### Admin (`AC-06`…`AC-10`)

`GET /admin/accounts`: `?tab=all|pet|human|alumni`, `?status=` (an account status), `?q=` (name or email, 100),
`?page=`, `?per_page=` (20, at most 50); an unknown value answers **422** (SEC-INPUT-03). Pets and humans only,
newest first. Each row: `{ id, role, status, email, display_name, avatar_url, profile_id, pet, home_profile,
caretaker_name, adoption: { id, furparent_name, adopted_at } | null, created_at }`. No contact number or address.

`GET /admin/accounts/{account}`, beside the row: `account_actions` (newest first: `{ id, action, reason,
performed_by, by_owner, created_at }`), `verification` (`{ status, submitted_at, reviewed_at, reviewed_by,
documents: [{ id, type }] }` or `null`), `requests` (the latest ten: `{ id, pet_name, home_name, status,
created_at }`), `reports_against` (`{ total, open, latest: [{ id, target_type, reason, status, created_at }] }`),
`detail_change_requests` (`{ id, field, current_value, new_value, reason, status, has_document, reviewed_by,
reviewed_at, created_at }`) and `recent_activity` (the latest ten log entries). An admin's own id answers **404**.

| Action | When it is refused |
| --- | --- |
| `suspend` | **422** without a reason. **409** `already_suspended`, or `cannot_suspend` when the account isn't Active (Pending and Denied are decided in Verification) |
| `reactivate` | **422** without a reason. **409** `not_suspended`: only a suspended account comes back (proposal §5.1) |
| `deactivate` | **422** without a reason. **409** `already_deactivated` |
| `change-requests/{id}/review` | **422** `reason` when denying without one. **409** `already_reviewed` |

Suspending (also from a report) and deactivating, by the owner or an admin, close the account's open requests
(proposal §5.3): a booked Meet & Greet ends, the other side is notified, and a pet that was In Process with the
account is Looking for a Home again, its requests On Hold back to Sent. All of it is in the activity log.

## Announcements (`BE-24`), Analytics (`BE-25`) & Activity Logs (`BE-26`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/announcements` | `admin` | Published and scheduled announcements, newest first, with how many Active accounts each audience is (`meta.audience_counts`) |
| `POST` | `/api/v1/admin/announcements` | `admin` | Publish an announcement now, or schedule it for a time still ahead (`title`, `message`, `audience`, optional `publish_at`) |
| `GET` | `/api/v1/stats` | `pet`, `human` (Active) | Role-specific member analytics tiles and breakdowns (`AN-01`, `AN-02`) |
| `GET` | `/api/v1/admin/dashboard` | `admin` | Platform analytics dashboard & Needs Attention queues (`AN-03`) |
| `GET` | `/api/v1/activity` | Active member | Paginated member activity history (`?type=`) |
| `GET` | `/api/v1/activity/export` | Active member | Stream CSV export of member activity (formula-injection sanitized) |
| `GET` | `/api/v1/admin/activity-logs` | `admin` | Paginated platform audit logs (`?type=`, `?actor_role=`, `?actor_user_id=`, `?q=`) |
| `GET` | `/api/v1/admin/activity-logs/export` | `admin` | Stream CSV export of platform audit logs |
| `GET` | `/api/v1/admin/activity-logs/{activityLog}` | `admin` | Read-only detail of one append-only audit log entry (`LG-04`) |

### Activity logs as the screens use them (FE-26, checked 2026-10-10)

**Status: built (BE-26), checked and corrected for FE-26 (2026-10-10).** The screens (`LG-01`…`LG-04`) run against
it through `frontend/src/features/activity-logs/api/activity-logs.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/activity-logs.ts` answers the same way. A change here also changes those
files, the types beside the calls, and the tests on both sides in the same PR.

- **Read-only.** Every endpoint is a `GET`. The log has no create, update or delete endpoint, for admins too, and
  the model refuses an update or a delete (SEC-LOG-04). Anything else on these paths is **405**.
- **Two readers, two views of an entry** (SEC-API-01). An admin reads it whole. A member reads their own activity
  with less: an admin is "An admin", there is no reason, no raw user agent and no id of anyone.
- Signed out: **401**. Not Active: **403** `account_not_active`. `/admin/...` for anyone but an Active admin:
  **403**, and the try is itself logged (`admin_access_denied`, SEC-LOG-02).
- Lists are newest first, `?page=`, `?per_page=` (20 by default, never more than 50; SEC-API-05).

#### An entry

| Field | A member's own activity | An admin |
| --- | --- | --- |
| `id`, `type`, `action`, `created_at` | Yes. `type` is one of `verification`, `account`, `status_change`, `request`, `meet_and_greet`, `adoption`, `feed`, `profile`, `moderation`, `announcement`, `security`, `system`. `action` is a name such as `adoption_request_approved`; the screens put it into words | Yes |
| `actor` | `{ display_name, role, is_you }`. `role` is `pet`, `human`, `admin` or `system`. An admin other than the reader is `"An admin"`; the system is `"System"` | The same with `id` (the account, `null` for the system) and the admin's own name |
| `subject_type`, `subject_label` | The kind of record it was about (`AdoptionRequest`) and that record in a few words: an account's, a pet's or a home's name, `"Mochi to Ana Santos"` for a request, a Meet & Greet or an adoption, `"Ana Santos to Mochi"` for an invite, an announcement's title, otherwise the kind and its number (`"Post #12"`). `null` when the entry is about nothing in particular | The same, with `subject_id` |
| `target` | `{ kind: "request", id }` when it is about one of the reader's own requests (also through its Meet & Greet or adoption); otherwise `null` | `{ kind, id }` with `kind` `account`, `request` or `report`: the admin page to open. `null` when the record has none |
| `before_value`, `after_value` | The value a change went from and to, as stored (`looking_for_a_home`, `in_process`); the screens name statuses | Yes |
| `device` | `"Edge on Windows"`, on `security` entries only (the reader's own sign-ins) | On every entry that has one |
| `reason` | **Not sent** | The reason as stored: an admin's words, a system note, or a name such as `fake_profile` |
| `user_agent`, `is_append_only` | **Not sent** | On `GET /admin/activity-logs/{id}` only |

#### `GET /api/v1/activity` and `GET /api/v1/activity/export`

The signed-in account's own activity: what it did, and what was done to the account, to its pet or Home Profile
and to its requests (the system's status changes, an admin's decisions, the other side's answers). Whose it is is
the session's to say: there is no id to send (SEC-AUTHZ-02). A report filed against the account is not part of it.

- `?type=`: one type, or several separated by commas (`?type=request,adoption`). A value that isn't a type: **422**
  `type.N`.
- **The export** is the same list with the same `?type=`, as a CSV download (`text/csv; charset=UTF-8`,
  `X-Content-Type-Options: nosniff`), the newest 1,000 entries. Columns: When (Philippine time), Who, Type, Action,
  About, Before, After, Device. No Reason column, and "An admin" for an admin.

#### `GET /api/v1/admin/activity-logs`, `…/export` and `…/{activityLog}`

Every entry on the platform.

| Query | |
| --- | --- |
| `type` | One type, or several separated by commas. Unknown: **422** `type.N` |
| `actor_role` | `admin`, `pet`, `human`, or `system` for entries nobody is the actor of. Unknown: **422** |
| `actor_user_id` | One account's own actions. Not a whole number of 1 or more: **422** |
| `q` | Up to 100 characters, looked for in the action's name (`account suspended` finds `account_suspended`), the reason and the before and after values, whatever the letter case. `%` and `_` are characters, not wildcards |

- **The export** takes the same query and answers the newest 2,000 entries as a CSV with a Reason column. A cell
  that would start a formula (`=`, `+`, `-`, `@`, also behind leading spaces) is written as text.
- **`GET …/{activityLog}`**: one entry with `user_agent` and `is_append_only: true`. **404** when there is none.

The screen (`LG-03`) sends `type` (one) and `actor_role`; `actor_user_id` and `q` are there for a later screen.

**What FE-26 changed in BE-26:**

- **A member read an admin's name** on every decision about their account (`actor.display_name`), and the
  **reason** with it: an admin's note, which can name another account. The LoFi says "Account approved by an
  admin". A member's entry now carries neither, and no ids.
- **An account with no pet and no Home Profile read every request's entries**: the list of "my requests" was built
  with no condition at all for it. Each kind of record is now matched only when the account has one
  (SEC-AUTHZ-02; Medium by `security-guidelines.md` §10.4).
- **An entry couldn't say what it was about**: `subject_type` and `subject_id` only, where the LoFi shows a
  target ("Kulit", "Mochi → Ana Santos"). `subject_label` and `target` are added, looked up a page at a time.
- **A sign-in's device was kept but never told to its owner** (the column's own comment: "sign-in device
  (LG-01)"). `device` says it in plain words; the raw user agent stays with admins.
- **Filters were taken as typed**: an unknown `type` or `actor_role` was ignored or matched nothing. They are
  checked by Form Requests and answered **422** (SEC-INPUT-01, SEC-INPUT-03). A member can ask for several types
  at once, which the page's tabs need.
- **The search depended on the database engine**: `LIKE` is case-sensitive on PostgreSQL and its escapes differ
  from SQLite's. Both sides are lowered and the escape is explicit.
- **A member's export had a Reason column and admin names**, and a formula behind leading spaces was not caught.
  The export goes through the same view as the list.

**Left as it is, to decide:**

- **No search box and no date range on `LG-03`.** The LoFi has the actor and type filters and Export. `q` and
  `actor_user_id` are ready for them.
- **The account page's "Full activity log" link (`AC-07`) opens the whole log**, not that account's entries.
  `actor_user_id` covers what the account did; what was done to it would need one more filter.
- **An export stops at its newest 1,000 (member) or 2,000 (admin) entries.** The admin screen says so when the
  list is longer and suggests narrowing it.
- **A failed sign-in for an email nobody has is an entry with no actor and no subject**: it reads as the system's.
- **The other side's Meet & Greet actions are not in a member's activity** (a human's confirm in a pet's list):
  the entry is about the meeting, not the request. The status change that follows it is listed.

### Announcements as the screens use them (FE-24, checked 2026-10-10)

**Status: built (BE-24), checked and corrected for FE-24 (2026-10-10).** The screen (`NT-04`) and its dialog
(`NT-05`) run against it through `frontend/src/features/notifications/api/announcements.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/announcements.ts` answers the same way. A change here also changes those
files, the types beside the calls, and the tests on both sides in the same PR.

- **Who:** a signed-in **Active** admin. Signed out: **401**. Any other role, or an admin account that isn't
  Active: **403** (SEC-AUTHZ-06, SEC-AUTHZ-07).
- **Written once.** There is no update and no delete: a published announcement is not edited or taken back, and a
  scheduled one is not cancelled. Each is logged with the admin's name: `announcement_published` or
  `announcement_scheduled`, and `announcement_published` by the system when a scheduled one goes out (SEC-LOG-01).
- **Who publishes and whether it is published are never the body's to say**: `admin_user_id`, `published_at` and
  `status` are ignored when sent (SEC-AUTHZ-02, SEC-INPUT-04).

#### `GET /api/v1/admin/announcements`

Published and scheduled announcements, newest first by the day they were written. `?page=`, `?per_page=` (20 by
default, 50 at most; more is **422**, SEC-API-05).

| Field | |
| --- | --- |
| `id`, `title`, `message` | As the admin wrote them. Text: the screens render them as text (SEC-FE-01) |
| `audience` | `everyone`, `pets` or `humans` |
| `status` | `published`, or `scheduled` while its time is still ahead |
| `publish_at` | When it goes out, for a scheduled one; when it was written, for one published at once |
| `published_at` | When it went out; `null` while scheduled |
| `admin_name` | Who wrote it; `null` when that account is gone |
| `created_at` | |

`meta` carries the usual page fields and **`audience_counts`**: `{ everyone, pets, humans }`, the Active Pet and
Human accounts in each audience right now, for "Everyone (312 Active accounts)" on `NT-05`. An account that turned
announcements off in its settings is counted: it gets no alert, but reads the announcement beside the feed.

#### `POST /api/v1/admin/announcements`

| Body | |
| --- | --- |
| `title` | Required, up to 160 characters, trimmed |
| `message` | Required, up to 2000 characters, trimmed |
| `audience` | Required: `everyone`, `pets` or `humans` |
| `publish_at` | Leave it out (or `null`) to publish now. To schedule: an ISO 8601 time **still ahead**, within the next 365 days. The screens send it in UTC from a date and a time typed in Philippine time |

- **201:** the announcement as above, with `recipients_notified`: how many accounts got an alert (`0` for a
  scheduled one).
  - **Published now:** every Active account of the audience that hasn't turned announcements off gets a
    notification (`type` `announcement`, category `account`, linking to `/feed`) with the title and the message, in
    the same transaction. From then on the feed carries it for that audience (`meta.announcements`, the 3 latest).
  - **Scheduled:** nothing is sent yet and the feed doesn't carry it. `PublishScheduledAnnouncementsJob` publishes
    it once its time has come: the scheduler runs it every minute (`routes/console.php`), so the scheduler and a
    queue worker have to be running (`docs/adr/deployment.md`).
- **422** `errors`, with messages the form shows:

  | Field | Message |
  | --- | --- |
  | `title` | "Enter a title." · "Keep the title to 160 characters or fewer." |
  | `message` | "Enter a message." · "Keep the message to 2000 characters or fewer." |
  | `audience` | "Choose who the announcement is for." |
  | `publish_at` | "Choose a time that is still ahead, or publish now." · "Choose a time within the next year." · "Enter a valid date and time." |

- Rate-limited per account (`throttle:writes`, SEC-API-04).

**What FE-24 changed in BE-24:**

- **A `publish_at` that had already passed was published at once**, without a word: an admin who meant to schedule
  for 10:00 and typed a time just behind the clock sent it to everyone instead, and an announcement can't be taken
  back. It is **422** now, and the form says the same before anything is sent. A time more than a year ahead is
  refused too, so a mistyped year doesn't wait unseen.
- **The dialog had no way to say how many accounts an audience is** (`NT-05`: "Everyone (312 active accounts)").
  The list's `meta.audience_counts` says it.
- Validation moved into a Form Request (`StoreAnnouncementRequest`, SEC-INPUT-01), with messages the form shows,
  and `per_page` over 50 is refused instead of trimmed.

**Left as it is, to decide:**

- **A scheduled announcement can't be cancelled or edited.** The LoFi has no control for it and the table is
  append-only. The dialog says so before "Schedule announcement" is pressed. Cancelling one would need an endpoint
  and a rule about who may.
- **Alerts for a large audience are written inside the request**, one row per account. Fine for the pilot's
  numbers; a queued job is the next step if the platform grows.
- **An announcement stays beside the feed until three newer ones push it out.** There is no end date.
- **Publishing twice sends twice.** Nothing tells two identical announcements apart; the dialog's button is ignored
  while a publish is on its way, so one press sends one.

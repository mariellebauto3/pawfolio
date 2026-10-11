# Notification endpoints

Module 9, Notifications: the Alerts dropdown (`NT-01`) and the Notifications page (`NT-02` human, `NT-03` pet),
FR15 and FR31. **Status: built (BE-10), checked and corrected for FE-19 (2026-10-09).** The frontend screens (FE-19)
run against it through `frontend/src/features/notifications/api/notifications.ts`. In mock mode
`frontend/src/lib/api/mock/handlers/notifications.ts` answers the same way. A change here also changes those files,
`frontend/src/types/notification.ts`, and the tests on both sides in the same PR.

The screens use these four. The API has more (below), which no screen calls yet.

| Method and path | Who | What it does |
| --- | --- | --- |
| `GET /notifications` | any Active account | The account's notifications, a page at a time, by tab (`NT-02`, `NT-03`; the latest 4 for `NT-01`) |
| `GET /notifications/unread-count` | any Active account | How many are unread, for the count on Alerts (`NT-01`) |
| `POST /notifications/{id}/read` | any Active account | Mark one as read, as it is opened |
| `POST /notifications/read-all` | any Active account | "Mark all as read" (`NT-01`, `NT-02`) |

- **Who:** a signed-in **Active** account, whatever its role. Signed out: **401**. Not Active: **403**
  `account_not_active`.
- **Only the account's own.** Every list and count is the caller's. Another account's notification answers **404**,
  like one that doesn't exist (SEC-AUTHZ-02, SEC-AUTHZ-04).
- **No websockets.** The frontend asks `unread-count` when a member page loads, every 60 seconds while the tab is
  visible, and when the window is looked at again (at most once per 10 seconds). It asks for the list only when
  Alerts is opened or the count has moved.

## The notification

```json
{
  "id": "01K74M0Y3Z8Q1F2D7N5H6B9XRT",
  "type": "invite_sent",
  "category": "requests",
  "title": "Ana Santos invited you to apply!",
  "body": "Ana Santos in Quezon City invited Mochi to apply for their home.",
  "data": { "category": "Requests", "invite_id": 4, "link": "/invites" },
  "is_read": false,
  "is_dismissed": false,
  "urgency": "info",
  "action_url": "/invites",
  "sender": "Mochi",
  "created_at": "2026-10-09T02:15:00+00:00"
}
```

| Field | |
| --- | --- |
| `id` | A ULID (a string), not a number |
| `type` | What happened: `invite_sent`, `request_received`, `request_approved`, `request_declined`, `request_under_review`, `meet_greet_booked`, `meet_greet_cancelled`, `verification_approved`, `verification_denied`, `account_action`, `announcement`, `post_comment`. Senders reuse types (a booking reminder is `meet_greet_booked`), so screens read `title` and `category`, not `type` |
| `category` | The tab it is listed under: `requests`, `meet_and_greets`, `account`, or `feed` (no tab; read under All). `null` only for a row no sender filed |
| `title`, `body` | Written by the sender. `body` can carry other people's words (an invite's note, the start of a comment): the frontend renders both as text (SEC-FE-01) |
| `is_read` | `false` until it is opened or "Mark all as read" |
| `urgency` | `info`, `warning` or `urgent`. The last two mean someone must act; the screens draw the icon in blue and read it out as "Important" |
| `action_url` | The page it is about, as a path of the app: `/requests/{id}`, `/invites`, `/posts/{id}`, `/me`, `/settings`, `/feed`, `/requests`. May be `null` |
| `created_at` | ISO 8601, UTC |
| `data`, `is_dismissed`, `sender` | Sent, and read by no screen. `sender` is the recipient's own name |

**`action_url` is not trusted by the frontend.** `POST /notifications` (below) lets an account write its own, with
any URL. The screens follow it only when it is a path on this site among the member pages
(`frontend/src/lib/utils/notification-href.ts`, SEC-FE-07); anything else, and a link back to `/notifications`
itself, is shown as a row without a link.

## `GET /api/v1/notifications`

Newest first. Dismissed notifications are left out. **Nothing is left out for its age**: every notification the
account ever got is listed, a page at a time, for as long as the account exists. There is no job that prunes them.

| Query | Values |
| --- | --- |
| `category` | `requests`, `meet_and_greets`, `account`. Leave it out (or send `all`) for everything. `meet-and-greets` and the tab labels (`Meet & Greets`) are read as the same thing |
| `period` | `recent`: the last 7 days. `earlier`: everything before them, however long ago. Leave it out (or send `all`) for both (added 2026-10-10) |
| `page`, `per_page` | default 20, at most 50 |

- **200:** a page of notifications (above), with `meta` and `links` as every list (`README.md`).
- **422** with `errors.category` for a `category` that is no tab, and with `errors.period` for a `period` that is
  none of the three (SEC-INPUT-03).
- The page shows them in sections by age (Today, Yesterday, This week, Earlier this month, then one per month),
  worked out from `created_at`; "This week" ends where `recent` does.
- An empty page is the empty state of the tab.

## `GET /api/v1/notifications/unread-count`

- **200:** `{ "data": { "unread_count": 3 } }`. Dismissed notifications aren't counted.

## `POST /api/v1/notifications/{id}/read`

`PATCH` is accepted as well; the frontend sends `POST`, as for every state change.

- **200:** the notification, now with `is_read: true`. Marking one that is already read is not an error.
- **404** for another account's notification or an id that doesn't exist.

## `POST /api/v1/notifications/read-all`

- **200:** `{ "data": { "marked_read_count": 3 } }`: every unread notification of the account, on every tab.

## `GET /api/v1/announcements`

The Announcements tab of the Notifications page (`NT-02`, `NT-03`, added 2026-10-10): what the Pawfolio team
published for the caller's role, newest first.

- **Who:** a signed-in **Active** account. 401 signed out, 403 `account_not_active` otherwise.
- **Query:** `page`, `per_page` as every list: default 20, max 50 (SEC-API-05).
- **200:**

  ```json
  {
    "data": [
      { "id": 3, "title": "Pawfolio Adoption Week starts Oct 10!", "message": "A week of adoption stories on the feed. Share yours.", "published_at": "2026-09-25T02:00:00.000000Z" }
    ],
    "meta": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 1 },
    "links": { "first": "…", "last": "…", "prev": null, "next": null }
  }
  ```

- Only **published** announcements whose audience is Everyone or the caller's own role (a pet never reads one for
  humans; an admin reads Everyone's). Scheduled ones are not listed. **Only these four fields:** the admin's name
  and the audience stay out (SEC-API-01).
- It doesn't depend on an alert: an account approved after an announcement went out, or one that turned
  announcement alerts off, still reads it here. The feed (`GET /feed`) carries the latest three of the same list.

An `announcement` notification carries the announcement's title as `title` and its whole message as `body`, so a
row shows a preview and the screens open it in full where the list is, instead of following `action_url`.

## Who is told what

Each of these writes one notification for the other side, with the link shown. A sender checks the recipient's
notification preferences first (`requests_and_invites`, `meet_and_greets`, `post_activity`, `announcements`); account
and verification notices are always sent.

| Event | Recipient | Category | `action_url` |
| --- | --- | --- | --- |
| A human invites a pet to apply (`RQ-01`) | the pet | `requests` | `/invites` |
| A request is sent, approved, declined, withdrawn, put On Hold or expires | the other side | `requests` | `/requests/{id}` |
| A Meet & Greet is booked, confirmed, rescheduled or cancelled; reminders 1 day and 1 hour before | the other side, or both | `meet_and_greets` | `/requests/{id}` |
| The meeting time has passed and a decision is due; daily reminders | the human | `meet_and_greets` | `/requests/{id}` |
| Adopt, decline after the meeting, "It didn't happen" | the pet, and the humans whose requests closed | `requests` | `/requests/{id}` |
| An admin approves an account (`AU-25`) | the account | `account` | `/me` |
| An admin denies a submission (`AU-26`) | the account (it reads it once it is Active) | `account` | `/account/edit` |
| Reactivation, a change request's answer, a moderation action, an admin resolving an adoption issue | the account | `account` | `/me`, `/settings` or `/requests` |
| A report is resolved, when reporters are told | each reporter | `account` | `/notifications` |
| An announcement is published (`NT-05`) | its audience | `account` | `/feed` |
| Someone comments on a post | the post's author | `feed` | `/posts/{id}` |

## Corrected for FE-19

- **No notification could be written on PostgreSQL.** The model gives ids as ULIDs and the column was `uuid`:
  SQLite stores that as text, PostgreSQL refuses it, and an action that notifies inside its transaction (approving
  an account, sending an invite) failed with it. The column is a string now
  (`2026_10_09_000002_store_notification_ids_as_text`).
- **The tabs answered 500 on PostgreSQL.** They filtered on `data->category`, a JSON path on a text column. Each
  notification now carries its `category` in a column of its own, set as the row is written from what its sender
  named in `data.category`, or from its type when it named none; rows written before are filled in by the
  migration (`2026_10_09_000003_add_category_to_notifications_table`).
- **A row could sit under two tabs.** The old filter also matched by type, so a decision reminder (a request type,
  filed under Meet & Greets) showed under Requests as well. Every row has one category now.
- **A `category` that is no tab** was answered with an empty list; it is **422** now.
- **A comment's notification linked to `/post/{id}`**, a page the app doesn't have. It links to `/posts/{id}`.
- **`category` is sent on the notification**, so the screens don't read it out of `data`.

## Not used by the screens

`GET /notifications/{id}`, `PATCH /notifications/{id}/unread`, `DELETE /notifications/{id}` and
`PATCH /notifications/{id}/dismiss` (both hide it from the list), `PATCH /notifications/{id}/resend` and `/retry`,
`POST /notifications`, and `GET`/`PATCH /notifications/preferences` (the Settings screen, `AC-01`, reads preferences
through `GET /settings`). The admin's side of announcements (`NT-04`, `NT-05`) is in
`community-reports-and-admin.md`.

## Known gap

- **The reminder jobs still look up `data->reminder_key`** to avoid sending a reminder twice
  (`SendMeetAndGreetRemindersJob`, `ProcessApprovedUnbookedRequestsJob`, `ProcessPassedMeetingsAndDecisionsJob`).
  It is the same JSON path on a text column, so those three scheduled jobs fail on PostgreSQL. Not part of FE-19;
  it needs its own fix (a `reminder_key` column, as `category` got).

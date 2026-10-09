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
| `POST` | `/api/v1/reports` | Active member | Submit a report on a `profile`, `post`, `comment`, or `account` |
| `GET` | `/api/v1/admin/reports` | `admin` | Paginated reports queue (`?status=`, `?target_type=`, `?reason=`), open reports prioritized by `reporters_count` |
| `GET` | `/api/v1/admin/reports/{report}` | `admin` | Report detail with target preview, all sibling reporters, and account history |
| `POST` | `/api/v1/admin/reports/{report}/actions` | `admin` | Resolve report (`remove_content`, `restore_content`, `suspend_account`, `remove_content_and_suspend`, `dismiss`) |

## Account Settings & Admin Account Management (`BE-23`, `AC-01..AC-06`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/settings` | Active member | Account info, notification preferences, and locked-detail change requests |
| `PATCH` | `/api/v1/settings` | Active member | Update contact fields (`caretaker_name`, `caretaker_contact_number` / `contact_number`, `street_address`) and `notification_preferences` |
| `POST` | `/api/v1/settings/password` | Active member | Change password (`current_password`, `password`, `password_confirmation`) |
| `POST` | `/api/v1/settings/change-requests` | Active member | Request a change to a locked field (`field`, `new_value`, `reason`, optional `document`) |
| `POST` | `/api/v1/settings/deactivate` | Active member | Self-deactivate account (`current_password`, optional `reason`), closing open requests and ending sessions |
| `GET` | `/api/v1/admin/accounts` | `admin` | Paginated accounts list (`?role=`, `?status=`, `?q=`) |
| `GET` | `/api/v1/admin/accounts/{account}` | `admin` | Admin account detail with verification, actions, reports, and change requests |
| `POST` | `/api/v1/admin/accounts/{account}/suspend` | `admin` | Suspend account (`reason`) and invalidate sessions |
| `POST` | `/api/v1/admin/accounts/{account}/reactivate` | `admin` | Reactivate suspended/deactivated account (`reason`) |
| `POST` | `/api/v1/admin/accounts/{account}/deactivate` | `admin` | Admin-deactivate account (`reason`) |
| `GET` | `/api/v1/admin/change-requests` | `admin` | Paginated locked-detail change requests |
| `POST` | `/api/v1/admin/change-requests/{changeRequest}/review` | `admin` | Approve or deny a locked-detail change request (`decision`, `reason`) |

## Announcements (`BE-24`), Analytics (`BE-25`) & Activity Logs (`BE-26`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/announcements` | `admin` | Paginated platform announcements |
| `POST` | `/api/v1/admin/announcements` | `admin` | Publish or schedule an announcement (`title`, `message`, `audience`, optional `publish_at`) |
| `GET` | `/api/v1/stats` | `pet`, `human` (Active) | Role-specific member analytics tiles and breakdowns (`AN-01`, `AN-02`) |
| `GET` | `/api/v1/admin/dashboard` | `admin` | Platform analytics dashboard & Needs Attention queues (`AN-03`) |
| `GET` | `/api/v1/activity` | Active member | Paginated member activity history (`?type=`) |
| `GET` | `/api/v1/activity/export` | Active member | Stream CSV export of member activity (formula-injection sanitized) |
| `GET` | `/api/v1/admin/activity-logs` | `admin` | Paginated platform audit logs (`?type=`, `?actor_role=`, `?actor_user_id=`, `?q=`) |
| `GET` | `/api/v1/admin/activity-logs/export` | `admin` | Stream CSV export of platform audit logs |
| `GET` | `/api/v1/admin/activity-logs/{activityLog}` | `admin` | Read-only detail of one append-only audit log entry (`LG-04`) |

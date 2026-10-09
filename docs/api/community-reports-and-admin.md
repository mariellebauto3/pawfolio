# Community Feed, Reports, Account Settings, Announcements, Analytics & Activity Logs API

Endpoints for Community Feed (`BE-21`), Reports & Moderation (`BE-22`), Account Settings & Admin Accounts (`BE-23`), Announcements (`BE-24`), Analytics (`BE-25`), and Activity Logs & CSV Exports (`BE-26`).

## Community Feed (`BE-21`, `FD-01..FD-07`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/feed` | Active member | Paginated community feed (`?type=`, `?tab=adopted`, `?author_user_id=`) with latest published announcement banner |
| `POST` | `/api/v1/posts` | `pet`, `human` (Active) | Create a post (`body`, optional `title`, `type`, `photos[]`). Auto-flags selling/payment keywords (`GCash`, `Maya`, `rehoming fee`, currency amounts) into `reports` (`SEC-ABUSE-04`) |
| `POST` | `/api/v1/posts/adoption-story` | `human` (Furparent) | Create an Adoption Story post (`adopted_pet_id` verified against `adoptions`, `title`, `body`, `photos[]`) |
| `GET` | `/api/v1/posts/{post}` | Active member | Post detail with threaded comments (top-level + 1-level replies) |
| `PATCH` | `/api/v1/posts/{post}` | Author (Active) | Edit own post (`title`, `body`) |
| `DELETE` | `/api/v1/posts/{post}` | Author / `admin` | Soft-delete own post (`deleted_at`) |
| `POST` | `/api/v1/posts/{post}/comments` | Active member | Add comment or 1-level reply (`body`, optional `parent_comment_id`) |
| `DELETE` | `/api/v1/comments/{comment}` | Author / `admin` | Remove comment (`removed_at`) |
| `POST` | `/api/v1/posts/{post}/reactions` | Active member | Toggle heart reaction on a post |
| `POST` | `/api/v1/comments/{comment}/reactions` | Active member | Toggle heart reaction on a comment |

## Reports & Moderation (`BE-22`, `RP-01..RP-05`)

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/reports` | Active member | Submit a report on a `profile`, `post`, `comment`, or `account`. Reporting your own content or account answers **422** with the reason under `errors.target_id` |
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

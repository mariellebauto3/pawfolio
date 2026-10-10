# Auth & session endpoints

Module 1, Authentication & Verification. **Status: built (BE-03, BE-04, BE-06, BE-08)** and checked against the
frontend in live mode on 2026-10-04. The frontend uses these through `frontend/src/lib/auth/` and `src/features/auth/api/`; the mock handlers in
`frontend/src/lib/api/mock/handlers/` (`auth.ts`, `sign-up.ts`, `account-status.ts`, `admin-verification.ts`) answer
the same way for mock mode. If anything here changes, update this
file, the backend tests (`backend/tests/Feature/Auth/`), the mock and the types in the same PR.

All writes need the Sanctum CSRF cookie first (`GET /sanctum/csrf-cookie`, see [README](README.md)). An expired or
missing CSRF token answers **419** `{ "code": "session_expired" }`; the frontend refreshes the token and retries once.

## `GET /api/v1/auth/me`

The signed-in account. Used by `SessionProvider` and `proxy.ts`.

- **Who:** any signed-in account, **whatever its status**: Pending, Denied and Suspended accounts need it to see
  their status screen. It is exempt from the Active-only middleware (SEC-AUTHZ-06).
- **200:**

  ```json
  {
    "data": {
      "id": 1,
      "role": "pet",
      "status": "active",
      "email": "mochi@example.com",
      "display_name": "Mochi",
      "avatar_url": null,
      "profile_id": 1
    }
  }
  ```

  `role`: `pet` | `human` | `admin`. `status`: `pending_verification` | `active` | `denied` | `suspended` |
  `deactivated`. `display_name`: the pet's name, the human's full name, or the admin's name. `profile_id`: the pet
  id (role `pet`), the Home Profile id (role `human`), or `null` (admin). No contact details or documents (NFR4).
- **401:** signed out.

## `POST /api/v1/auth/sign-in`

- **Body:** `{ "email": string, "password": string, "remember"?: boolean }`. `remember` is "Keep me signed in"
  (`AU-02`): a remember-me cookie keeps the account signed in after the browser closes. The email is compared trimmed
  and lower-case.
- **200:** same body as `GET /auth/me`. The account is signed in on the session and the session ID is regenerated
  (SEC-AUTH-07).
- **422** `errors.email`, one message for the form (`AU-03`):
  - `"That email and password don't match. Try again."` for a wrong password or an unknown email alike (SEC-AUTH-05).
  - `"This account was closed."` for a **deactivated** account, and only after the right password, so it reveals
    nothing to someone guessing.
- **429** `{ "code": "rate_limited" }` with `Retry-After` in seconds: 5 failed attempts for one email from one IP pause
  that pair for 15 minutes (SEC-AUTH-04), even with the right password. Other accounts on the same IP are not
  affected. A separate flood guard allows 20 sign-in requests a minute per IP.
- Pending, Denied and Suspended accounts *can* sign in. They land on the account-status screen (FR2, FR19).
- Successful, failed and locked-out attempts are written to `activity_logs` as `security` with the user agent
  (SEC-LOG-02). Failures for unknown emails are logged without the address.

## `POST /api/v1/auth/sign-out`

- **204**, also when already signed out. The session is invalidated and the CSRF token regenerated (SEC-AUTH-07).

## `POST /api/v1/auth/forgot-password`

`AU-04` → `AU-05`.

- **Body:** `{ "email": string }`
- **200** `{ "message": "If an account exists for that email, we've sent a link to reset the password. It expires in
  30 minutes." }`, **the same whether the account exists or not**, and also when a link was sent less than a minute
  ago (SEC-AUTH-05). "Resend email" calls this again.
- **422:** missing or invalid email.
- **429** with `Retry-After`: 5 requests per 15 minutes per IP (SEC-AUTH-04).
- **The emailed link** opens the frontend's `AU-06` screen:

  ```
  {FRONTEND_URL}/reset-password#token=<token>&email=<email>
  ```

  Token and email are **after the `#`**, which browsers never send to a server, so neither lands in server logs or
  `Referer` headers (SEC-FE-04). The page reads them into memory and clears the address bar. The link is single use
  and expires after **30 minutes** (SEC-AUTH-08). `FRONTEND_URL` is set in the backend `.env`.

## `POST /api/v1/auth/reset-password`

`AU-06`.

- **Body:** `{ "token": string, "email": string, "password": string, "password_confirmation": string }`
- **200** `{ "message": "Your password has been reset. Sign in with your new password." }`. The visitor is **not**
  signed in: the frontend sends them to sign in with a "Password reset" toast. Every session of the account ends and
  its remember-me cookie stops working, so other devices are signed out (SEC-AUTH-07). Written to `activity_logs`.
- **422** `errors.password` (SEC-AUTH-03), first failing rule:
  `"Use at least 8 characters."`, `"Include at least one letter."`, `"Include at least one number."`,
  `"The passwords don't match."`, `"This password has appeared in a data leak. Choose a different one."`
  (checked against Have I Been Pwned by hash prefix; the password itself never leaves the server).
- **422** `errors.token`: `"This reset link is invalid or has expired. Ask for a new one."` for a wrong, used or
  expired token, or an unknown email alike.
- **429** with `Retry-After`: 10 requests per 15 minutes per IP.

## Sign-up: `POST /api/v1/auth/sign-up/pet` and `POST /api/v1/auth/sign-up/human`

`AU-08`…`AU-17`, FR1, FR18. **Status: built (BE-04).** The frontend wizards (FE-07) run against it, and the mock
(`frontend/src/lib/api/mock/handlers/sign-up.ts`) answers the same way. A change here also changes the mock, the
client checks (`frontend/src/features/auth/schemas/sign-up-schemas.ts`, `frontend/src/lib/auth/sign-up-rules.ts`)
and the tests on both sides in the same PR.

- **Who:** visitors only. A signed-in account gets **403** `"You're already signed in. Log out to create another
  account."`
- **One endpoint per role**, so the role never comes from the body. `role`, `status` and every other field not listed
  below are ignored (SEC-INPUT-04, SEC-AUTHZ-05). Admin accounts are never created here (SEC-AUTH-10).
- **Body:** `multipart/form-data` (it carries files). Text is trimmed and the email lower-cased before validation
  (SEC-INPUT-06).

### Fields

Both endpoints:

| Field | Rules | 422 message |
| --- | --- | --- |
| `email` | required, valid email, max 255, not already an account | `"Enter your email."`, `"Enter a valid email address."`, `"An account with this email already exists. Sign in, or use a different email."` |
| `password` | required; the SEC-AUTH-03 rules and messages of `reset-password`, including the leaked-password check | `"Enter a password."`, then the first failing rule |
| `password_confirmation` | must equal `password`; the error is reported on `password` | `"The passwords don't match."` |
| `terms_accepted` | must be `1` (`AU-12`, `AU-17`) | `"Confirm the details and agree to the Terms and Community Guidelines to continue."` |

`POST /auth/sign-up/pet` (`pets`, `verification_documents`):

| Field | Rules | 422 message |
| --- | --- | --- |
| `name` | required, max 50 | `"Enter the pet's name."` |
| `species` | `dog` \| `cat` \| `other` | `"Choose a species."` |
| `breed` | required, max 80 | `"Enter the breed, or "Mixed" if you're not sure."` |
| `approximate_age_months` | whole number, 1 to 360 | `"Enter the pet's approximate age."`, `"Enter a whole number, 1 or more. Use months for a pet under a year old."`, `"Enter an age of 30 years or less."` |
| `currently_at` | required, max 120 (where the pet is staying) | `"Enter where the pet is staying."` |
| `city` | required, max 80 | `"Enter the city."` |
| `province` | one of the 83 values in `frontend/src/constants/provinces.ts` (82 provinces and Metro Manila) | `"Choose a province."` |
| `photos[]` | 1 to 3 files, each JPG or PNG, max 5 MB. A file's own error is keyed `photos.<index>` | `"Add at least one clear photo of the pet."`, `"Add up to 3 photos."`, `"Upload a JPG or PNG photo."`, `"Each file must be 5 MB or smaller."` |
| `caretaker_name` | required, max 120 | `"Enter the caretaker's full name."` |
| `caretaker_contact_number` | Philippine mobile number, sent as `09XXXXXXXXX` | `"Enter a mobile number."`, `"Enter a mobile number like 0917 123 4567."` |
| `valid_id` | required file: JPG, PNG or PDF, max 5 MB | `"Upload a photo of the valid ID."`, `"Upload a JPG, PNG or PDF file."`, `"Each file must be 5 MB or smaller."` |
| `vet_record` | optional file: JPG, PNG or PDF, max 5 MB (vet record or shelter certificate) | as `valid_id` |

`POST /auth/sign-up/human` (`home_profiles`, `verification_documents`):

| Field | Rules | 422 message |
| --- | --- | --- |
| `full_name` | required, max 120 | `"Enter your full name."` |
| `birthdate` | `YYYY-MM-DD`, a real past date, **18 or older today** (proposal §5.1, SEC-INPUT-05) | `"Enter your birthdate."`, `"Enter a valid birthdate."`, `"You must be 18 or older to adopt on Pawfolio."` |
| `contact_number` | as `caretaker_contact_number` | same |
| `city`, `province` | as for pets | same |
| `street_address` | required, max 255 | `"Enter your street address."` |
| `id_type` | `drivers_license` \| `passport` \| `umid` \| `national_id_philsys` \| `postal_id` | `"Choose the type of ID."` |
| `valid_id` | as for pets | same |

### Answers

- **201** with the same body as `GET /auth/me`: the new account, `status: "pending_verification"`, and for a pet
  `avatar_url: null` (its photos are private until an admin approves the account). The account is
  **signed in** on the session (session ID regenerated, SEC-AUTH-07), so the frontend goes straight to the
  account-status screen (`AU-18`), the only page a Pending account can open (FR2, FR19). A `verification_submissions`
  row with `status: "pending"` puts it in the admin queue (`AU-22`).
- **422** `errors` by field, with the messages above. The wizard returns to the first step that has one.
- **413** when the upload is larger than the server accepts.
- **429** with `Retry-After`: sign-ups are rate limited per IP (SEC-AUTH-04).

### For BE-04

- Files are checked by content, renamed, and images re-encoded without EXIF (SEC-FILE-01…05). The ID, the vet record
  and the sign-up photos go to the **private** disk (SEC-PRIV-01, SEC-FILE-04); the frontend's own file checks are
  for quick feedback only.
- **Sign-up photos become the gallery on approval.** They are `pet_photo` verification documents on the private
  disk, like the ID. When an admin approves the account they are copied to the public disk as the pet's first
  gallery photos (the first one is its avatar); the private copies stay as what the admin saw. A denied or still
  pending account has nothing public.
- **Not as written yet (found 2026-10-04):**
  - A file's content is checked after every other field has passed, so a wrong file type or size comes back in a
    422 of its own, not together with the other fields' errors.
  - A text field over its length answers with Laravel's default wording. The wizard's inputs stop at the limit,
    so the frontend never sends one.
- **Pet photos are JPG or PNG only.** The LoFi's `AU-10` caption says "JPG, PNG, PDF", but SEC-FILE-01 keeps PDF for
  documents, so a PDF is refused as a photo.
- **The "email already exists" message tells a visitor that an email has an account.** SEC-AUTH-05 names sign-in
  and forgot-password, not sign-up, and without it nobody could finish the form; the rate limit keeps it from being
  used to list accounts. If the team wants it closed, the fix is email confirmation, a decision for
  `security-guidelines.md` §12.
- The sign-up is written to `activity_logs` (SEC-LOG-01) without the password, the ID or the contact number
  (SEC-LOG-03).

## Account status: `GET /api/v1/account-status`

`AU-18`, `AU-20`, `AU-21`, FR2, FR19, proposal §5.1. **Status: built (BE-06).** The frontend screens (FE-08) run
against it, and the mock (`frontend/src/lib/api/mock/handlers/account-status.ts`) answers the same way. A change
here also changes the mock, the types (`frontend/src/types/account-status.ts`) and the tests on both sides in the
same PR.

- **Who:** any signed-in account, **whatever its status**. Like `GET /auth/me`, it is exempt from the Active-only
  middleware (SEC-AUTHZ-06): it is how a blocked account learns why.
- **200:**

  ```json
  {
    "data": {
      "status": "denied",
      "denial_reason": "id_photo_unreadable",
      "reason": "The ID photo is blurry and the name can't be read. Please upload a clearer photo.",
      "submitted_at": "2026-09-27T02:15:00.000000Z",
      "is_resubmission": false,
      "documents": [
        {
          "document_type": "valid_id",
          "id_type": "umid",
          "mime_type": "image/jpeg",
          "size_bytes": 1887437,
          "uploaded_at": "2026-09-27T02:15:00.000000Z"
        }
      ]
    }
  }
  ```

  | Field | Meaning |
  | --- | --- |
  | `status` | The account status, as in `GET /auth/me` |
  | `denial_reason` | Denied only: the latest submission's `denial_reason` (`id_photo_unreadable`, `name_mismatch`, `id_expired`, `under_18` or `other`, `AU-25`). Otherwise `null` |
  | `reason` | Denied: the latest submission's `message_to_owner`. Suspended: the latest `account_actions` reason. Deactivated: `"This account was closed."`. Otherwise `null`. Shown as plain text (SEC-FE-01) |
  | `submitted_at` | `submitted_at` of the latest `verification_submissions` row; `null` for accounts that never signed up (admins) |
  | `is_resubmission` | `true` when that row isn't the account's first (sent again after a denial or an edit) |
  | `documents` | The latest submission's `verification_documents`. `document_type` is `valid_id`, `pet_photo` or `vet_record_or_certificate`; `id_type` is set on a human's valid ID |

- **Documents are described, never linked.** No `file_path`, URL or file name: the files are served to admins only
  (SEC-PRIV-01, NFR4). `AU-19` in the LoFi shows the owner their ID photo; the frontend shows its kind, format and
  date instead (`security-guidelines.md` §12).
- **401:** signed out.

## Submitted details: `GET` and `PATCH /api/v1/account/submission`

`AU-19`, FR2, FR19. **Status: built (BE-06)** (see above).

- **Who:** a signed-in pet or human account that is **Pending Verification or Denied**. It is exempt from the
  Active-only middleware (SEC-AUTHZ-06). Anyone else (Active, Suspended, Deactivated, admins) gets **403**
  `"Only accounts waiting for verification can edit their submitted details."` The account comes from the session,
  never from an id in the request (SEC-AUTHZ-02).

### `GET`

- **200**, the account's own details from `pets` or `home_profiles`, with `role` telling which:

  ```json
  {
    "data": {
      "role": "pet",
      "name": "Kulit",
      "species": "cat",
      "breed": "Puspin",
      "approximate_age_months": 8,
      "currently_at": "With the finder",
      "city": "Pasig",
      "province": "Metro Manila",
      "caretaker_name": "Joy Lim",
      "caretaker_contact_number": "09170000014",
      "documents": []
    }
  }
  ```

  A human gets `role: "human"`, `full_name`, `birthdate` (`YYYY-MM-DD`), `contact_number`, `city`, `province`,
  `street_address` and `documents`. `documents` has the same shape and the same rule as in `GET /account-status`.
  The contact number and street address are the owner's own; no other endpoint reveals them before a confirmed
  Meet & Greet (SEC-PRIV-02).

### `PATCH`

"Save and resubmit". A state change through an action, not a `status` field (FR27): the account becomes Pending
Verification and re-enters the admin queue (`AU-22`).

- **Body:** `multipart/form-data` with the same fields, rules and 422 messages as the role's sign-up endpoint above,
  **without** `email`, `password`, `password_confirmation` and `terms_accepted`. `role`, `status` and any other field
  are ignored (SEC-INPUT-04, SEC-AUTHZ-05).
- **The files are optional.** A file that is left out keeps the one already sent:
  - `valid_id` replaces the current ID. A human's `id_type` is still required and describes the ID on file.
  - `vet_record` (pets) adds or replaces the vet record or shelter certificate.
  - `photos[]` (pets): 1 to 3 photos that replace **all** the current ones.
- **Sent as `POST` with `_method=PATCH`** in the form (Laravel method spoofing), because PHP reads a multipart body
  only on `POST`. `frontend/src/features/auth/api/account-status.ts` adds the field.
- **200** with the same body as `GET /auth/me`, `status: "pending_verification"` (`display_name` follows an edited
  name). The frontend returns to the status screen (`AU-18`) with a toast.
- **422** `errors` by field (`photos.<index>` for one photo). **403** as above. **413** when the upload is larger
  than the server accepts. **429** with `Retry-After`: resubmissions are rate limited per account (SEC-AUTH-04).

### For BE-06

- A save creates a **new** `verification_submissions` row (`status: "pending"`, `submitted_at` now); earlier rounds
  stay as history, so `AU-24` can show the previous denial reason. Documents that weren't replaced are carried over
  to the new row.
- A Pending account that saves stays Pending and goes to the back of the queue, as the LoFi says ("Saving puts it
  back in the review queue").
- Files follow the sign-up rules: checked by content, renamed, images re-encoded without EXIF, private disk
  (SEC-FILE-01…05, SEC-PRIV-01).
- The save is written to `activity_logs` with the status before and after (SEC-LOG-01), without the ID or the
  contact number (SEC-LOG-03).

## Admin verification: `/api/v1/admin/verifications`

`AU-22`…`AU-26`, FR33, NFR4, NFR9. **Status: built (BE-08).** The frontend screens (FE-09) run against it, and the
mock (`frontend/src/lib/api/mock/handlers/admin-verification.ts`) answers the same way. A change here also changes
the mock, the types (`frontend/src/types/verification-review.ts`), the shared rules
(`frontend/src/lib/auth/verification-review.ts`) and the tests on both sides in the same PR.

- **Who:** Active admins only, on every endpoint below (SEC-AUTHZ-07). Signed out: **401**. Not Active: **403**
  `account_not_active`. A pet or a human: **403** `"This page is for admins only."`, written to the security log
  (SEC-LOG-02).
- **`{accountId}`** is the `users.id` of a pet or human account. Every endpoint works on that account's **latest**
  `verification_submissions` row. An id that doesn't exist, an admin's id, or an account that never submitted
  answers **404** (SEC-AUTHZ-04). The record is loaded and checked on the server, never trusted from the id
  (SEC-AUTHZ-02).

| Method and path | What it does |
| --- | --- |
| `GET /admin/verifications` | The queue: accounts waiting for review (`AU-22`) |
| `GET /admin/verifications/{accountId}` | One account's submission, to review or look back on (`AU-23`, `AU-24`) |
| `GET /admin/verifications/{accountId}/documents/{documentId}` | A submitted file, streamed |
| `POST /admin/verifications/{accountId}/approve` | Approve: the account becomes Active (`AU-26`) |
| `POST /admin/verifications/{accountId}/deny` | Deny with a reason the owner sees (`AU-25`, `AU-20`) |

### `GET /admin/verifications`

Submissions with `status: "pending"`, one row per account, **newest first** by `submitted_at` (the
`status, submitted_at` index; changed from oldest first on 2026-10-10, so a new sign-up is the first thing an admin
sees). The order is fixed; there is no sort parameter. An account that edited its details while Pending has several
rows; only its latest counts, so an edit sends it to the top of the queue.

| Query | Rules |
| --- | --- |
| `role` | `pet` \| `human`; leave out for both. Anything else: **422** `"Choose Pet or Human."` (allow-list, SEC-INPUT-03) |
| `search` | Up to 100 characters, trimmed; longer: **422** `"Search for 100 characters or fewer."` Matches part of the pet's name, the human's full name or the caretaker's name, whatever the case, as a bound parameter (SEC-INPUT-02). `%` and `_` are searched for as typed |
| `page`, `per_page` | As every list: default 20, max 50 (SEC-API-05) |

- **200:**

  ```json
  {
    "data": [
      {
        "account_id": 4,
        "role": "pet",
        "display_name": "Kulit",
        "caretaker_name": "Joy Lim",
        "submitted_at": "2026-09-29T06:48:00.000000Z",
        "is_resubmission": false,
        "documents": [
          { "document_type": "valid_id", "id_type": null, "mime_type": "image/jpeg", "size_bytes": 1887437, "uploaded_at": "2026-09-29T06:48:00.000000Z" }
        ]
      }
    ],
    "meta": { "current_page": 1, "last_page": 2, "per_page": 20, "total": 23, "from": 1, "to": 20, "path": "/api/v1/admin/verifications" },
    "links": { "first": "…", "last": "…", "prev": null, "next": "…" }
  }
  ```

  `caretaker_name` is `null` for humans. `is_resubmission` and `documents` mean what they mean in
  `GET /account-status`: the documents are described, never linked.
- `meta.total` is how many accounts are waiting. The admin sidebar's number is something else: how many arrived
  since that admin last opened the section (`GET /admin/sidebar`, in `community-reports-and-admin.md`).

### `GET /admin/verifications/{accountId}`

- **200:**

  ```json
  {
    "data": {
      "account_id": 5,
      "display_name": "Carla Mendoza",
      "account_status": "pending_verification",
      "status": "pending",
      "submitted_at": "2026-10-03T01:05:00.000000Z",
      "is_resubmission": true,
      "previous_denial": {
        "denial_reason": "id_photo_unreadable",
        "message_to_owner": "The ID photo is blurry and the name can't be read. Please upload a clearer photo.",
        "reviewed_at": "2026-09-28T03:40:00.000000Z"
      },
      "reviewed_at": null,
      "reviewed_by": null,
      "denial_reason": null,
      "message_to_owner": null,
      "details": {
        "role": "human",
        "full_name": "Carla Mendoza",
        "birthdate": "1994-11-22",
        "contact_number": "09170000015",
        "city": "Pasig",
        "province": "Metro Manila"
      },
      "documents": [
        { "id": 51, "document_type": "valid_id", "id_type": "umid", "mime_type": "image/jpeg", "size_bytes": 1887437, "uploaded_at": "2026-09-27T02:15:00.000000Z" }
      ],
      "queue": { "position": 23, "total": 23, "next_account_id": 4 }
    }
  }
  ```

  | Field | Meaning |
  | --- | --- |
  | `account_status` | The account's status, as in `GET /auth/me` |
  | `status` | The submission's: `pending` \| `approved` \| `denied`. Only a `pending` one can be approved or denied |
  | `previous_denial` | The last round an admin decided before this one, when it was a denial (`AU-24`); otherwise `null`. Rows the owner replaced by editing before anyone reviewed them don't count as rounds |
  | `reviewed_at`, `reviewed_by`, `denial_reason`, `message_to_owner` | Set once decided. `reviewed_by` is the admin's display name, `null` if that admin's row is gone |
  | `details` | What the owner submitted. A pet: `role: "pet"`, `name`, `species`, `breed`, `approximate_age_months`, `currently_at`, `city`, `province`, `caretaker_name`, `caretaker_contact_number`. A human: the fields above |
  | `documents` | As in the queue, plus the `id` that opens the file below |
  | `queue.position` | 1 for the newest waiting account, as the queue lists them; `null` once this one is decided |
  | `queue.total` | How many accounts are waiting now |
  | `queue.next_account_id` | The waiting account listed under this one (submitted just before it), or the newest when this is the oldest; `null` when no other is waiting |

- **A human's `street_address` is not sent.** The review compares the name, the age and the ID; the LoFi shows the
  city only (SEC-PRIV-04). The contact number is shown to admins because verifying the account needs it
  (SEC-PRIV-02).
- **404** as above.

### `GET /admin/verifications/{accountId}/documents/{documentId}`

The file itself, read from the **private** disk and streamed through this endpoint. There is no public URL, signed
URL or path for a verification document anywhere in the API (SEC-PRIV-01, SEC-FILE-04, NFR4).

- **200** with the file as the body and:
  - `Content-Type`: the stored `mime_type`, which is `image/jpeg`, `image/png` or `application/pdf` and nothing else
    (SEC-FILE-01). The frontend refuses any other type (SEC-FE-09).
  - `Content-Disposition: inline`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
- **404** when the document isn't one of that account's latest submission, the same answer as a document that
  doesn't exist.
- Errors are JSON like everywhere else. The frontend reads the file with `api.getFile()` (the session cookie, over
  the CORS rules of every other endpoint) and shows it from memory.

### `POST /admin/verifications/{accountId}/approve`

- **Body:** none. Approving needs no reason (SEC-AUTHZ-07 lists the actions that do).
- **200** with the same body as the `GET` above, now `status: "approved"`, `account_status: "active"`,
  `reviewed_at`, `reviewed_by`, and `queue.position: null`. A pet's sign-up photos become its gallery (see sign-up
  above).
- **409** `{ "code": "verification_already_reviewed", "message": "This account was already approved by admin.mark." }`
  when the submission is no longer pending (another admin decided first), or `"This account isn't waiting for review
  any more."` when the account left Pending Verification some other way. The frontend shows the message and reloads
  the page.
- **404** as above.

### `POST /admin/verifications/{accountId}/deny`

- **Body** (JSON). `status`, `reviewed_by` and any other field are ignored (SEC-INPUT-04, SEC-AUTHZ-05):

  | Field | Rules | 422 message |
  | --- | --- | --- |
  | `denial_reason` | required: `id_photo_unreadable` \| `name_mismatch` \| `id_expired` \| `under_18` \| `other` (FR33, SEC-AUTHZ-07) | `"Choose a reason."` |
  | `message_to_owner` | text, trimmed, max 500; **required when the reason is `other`**, otherwise optional (`null` or left out) | `"Write a message so the owner knows what to correct."`, `"Keep the message to 500 characters or fewer."` |

- **200** with the same body as the `GET`, now `status: "denied"`, `account_status: "denied"`, `denial_reason`,
  `message_to_owner`, `reviewed_at` and `reviewed_by`. The owner reads the reason and the message on their Denied
  screen (`GET /account-status`, `AU-20`), and can correct their details and resubmit (`AU-19`).
- **409** and **404** as for approve.

### For BE-08

- Approve and deny are Actions in one transaction that locks the submission row, so two admins can't both decide
  it: the second gets the 409. Each sets the submission's `status`, `reviewed_by_user_id` and `reviewed_at`, and the
  account's status (FR27: no endpoint takes a `status`).
- Each decision notifies the owner and writes an `activity_logs` entry: the admin, the action, the account, the
  status before and after, and for a denial the reason (SEC-LOG-01, NFR9), without the documents or the contact
  number (SEC-LOG-03). The logs are append-only (SEC-LOG-04).
- The checklist on the review screen (`AU-23`) is the admin's working aid. It isn't sent or stored
  (`security-guidelines.md` §12).
- A human who turned 18 after signing up, or whose birthdate doesn't match the ID, is the admin's call: the age on
  the screen is worked out from the submitted `birthdate`.
- `DemoSeeder` seeds Pending accounts for local development and the demo. Their IDs are pictures the seeder draws,
  marked "SAMPLE ID - NOT A REAL DOCUMENT" (SEC-PRIV-06), so the document viewer has something to open.

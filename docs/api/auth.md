# Auth & session endpoints

Module 1, Authentication & Verification. **Status: built (BE-03)**, except the two sign-up endpoints (planned for
BE-04) and the account-status endpoints at the end (BE-06, in progress). The frontend uses these through
`frontend/src/lib/auth/` and `src/features/auth/api/`; the mock handlers in
`frontend/src/lib/api/mock/handlers/` (`auth.ts`, `sign-up.ts`, `account-status.ts`) answer the same way for mock
mode. If anything here changes, update this
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

`AU-08`…`AU-17`, FR1, FR18. **Status: planned (BE-04), not built yet.** The frontend wizards (FE-07) are built against
this contract through the mock (`frontend/src/lib/api/mock/handlers/sign-up.ts`); BE-04 implements it, or changes
this section, the mock, the client checks (`frontend/src/features/auth/schemas/sign-up-schemas.ts`,
`frontend/src/lib/auth/sign-up-rules.ts`) and their tests in the same PR.

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

- **201** with the same body as `GET /auth/me`: the new account, `status: "pending_verification"`. The account is
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
- **Pet photos are JPG or PNG only.** The LoFi's `AU-10` caption says "JPG, PNG, PDF", but SEC-FILE-01 keeps PDF for
  documents, so a PDF is refused as a photo.
- **The "email already exists" message tells a visitor that an email has an account.** SEC-AUTH-05 names sign-in
  and forgot-password, not sign-up, and without it nobody could finish the form; the rate limit keeps it from being
  used to list accounts. If the team wants it closed, the fix is email confirmation, a decision for
  `security-guidelines.md` §12.
- The sign-up is written to `activity_logs` (SEC-LOG-01) without the password, the ID or the contact number
  (SEC-LOG-03).

## Account status: `GET /api/v1/account-status`

`AU-18`, `AU-20`, `AU-21`, FR2, FR19, proposal §5.1. **Status: BE-06, not built yet.** The frontend screens (FE-08)
are built against this contract through the mock (`frontend/src/lib/api/mock/handlers/account-status.ts`); BE-06
implements it, or changes this section, the mock, the types (`frontend/src/types/account-status.ts`) and their tests
in the same PR.

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

`AU-19`, FR2, FR19. **Status: BE-06, not built yet** (see above).

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

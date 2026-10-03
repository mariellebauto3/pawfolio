# Auth & session endpoints

Module 1, Authentication & Verification. **Status: built (BE-03).** The frontend uses these through
`frontend/src/lib/auth/` and `src/features/auth/api/`; the mock handlers in
`frontend/src/lib/api/mock/handlers/auth.ts` answer the same way for mock mode. If anything here changes, update this
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

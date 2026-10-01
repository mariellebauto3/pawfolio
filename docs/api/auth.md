# Auth & session endpoints

Module 1, Authentication & Verification. **Status: planned (BE-03).** This is the contract the frontend is built
against (`frontend/src/lib/auth/`, `src/types/account.ts`). The mock handlers in
`frontend/src/lib/api/mock/handlers/auth.ts` answer the same way until the real endpoints land. If BE-03 changes
anything here, update this file, the mock and the types in the same PR.

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

- **Body:** `{ "email": string, "password": string }`
- **200:** same body as `GET /auth/me`. The session ID is regenerated (SEC-AUTH-07).
- **422:** wrong email or password. Send one generic message on `email` whether or not the account exists
  (SEC-AUTH-05, `AU-03`).
- **429:** too many failed attempts (5 per 15 minutes per account + IP, SEC-AUTH-04), with `Retry-After`.
- Pending, Denied and Suspended accounts *can* sign in. They land on the account-status screen (FR2, FR19).

## `POST /api/v1/auth/sign-out`

- **204.** The session is invalidated and the CSRF token regenerated (SEC-AUTH-07).

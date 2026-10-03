# Discovery endpoints

Module 3, Discovery & Search. **Status: planned (BE-14).** The frontend is built against this contract; the mock
handlers in `frontend/src/lib/api/mock/handlers/discovery.ts` answer the same way until the real endpoints land. If
BE-14 changes anything here, update this file, the mock and the types in the same PR.

## `GET /api/v1/public/recently-hired`

The "Recently Hired" strip on the landing page (`AU-01`).

- **Who:** anyone, signed in or not. No session or CSRF token needed.
- **200:** the most recently Hired pets, newest first, **at most 8**. It is a fixed showcase rather than a list to
  page through, so it has no pagination; the cap of 8 does the job of SEC-API-05.

  ```json
  {
    "data": [
      { "name": "Luna", "photo_url": "https://…/alumni/luna.jpg", "hired_at": "2026-09-24T08:00:00.000000Z" }
    ]
  }
  ```

  `name` and `photo_url` are the pet's, `hired_at` is when the Adopt action was confirmed. **Only these three
  fields:** no id, breed, location, caretaker or Furparent, since anyone on the internet can read this (NFR4,
  SEC-PRIV-03). `photo_url` is `null` when the pet has no public photo.
- Pets whose account is suspended or deactivated, or whose profile is hidden, are left out.
- **Empty:** `{ "data": [] }` before the first adoption. The page shows an empty state.

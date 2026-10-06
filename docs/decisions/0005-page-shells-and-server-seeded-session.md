# 0005. Page shells per route group, with the session loaded on the server

- **Status:** accepted
- **Date:** 2026-10-01

## Context
FE-05 adds the four page shells from the LoFi (ui-guidelines §1): Guest, Account-status, Member and Admin. The member
top bar depends on the role: pets see "Homes for You", humans "Pets for You", and the Me menu differs too. In ADR 0004
the browser loads the session after the page appears, so a role-aware bar would first render without the role and
then change (a flash of wrong links, and the row of tabs jumping).

## Decision
1. **One shell per route group.** `(public)`, `(account-status)`, `(member)` and `admin` each have a `layout.tsx`
   that renders their shell from `src/components/layout/`. The landing page (`app/page.tsx`) wraps itself in the
   guest shell. Shells are server components; only the parts that need the session or the current path (top bar,
   Me menu, admin sidebar, Log out) are client components.
2. **The root layout loads the session on the server** (`lookUpAccount`, shared with `proxy.ts`) and passes it to
   `SessionProvider` as `initialAccount`. The first paint already has the right navigation. If the API doesn't
   answer within 2 s, the provider loads the session in the browser as before.
3. **Each group has its own `error.tsx` and `loading.tsx`**, so failures and loading states stay inside the shell.
   `(member)` and `admin` have a `not-found.tsx` for `notFound()`. The app-wide `not-found.tsx` (unknown URLs) picks
   the shell from the session (`SessionShell`).
4. **Log out does a full page load** to the landing page after `POST /auth/sign-out`, so no signed-in data stays in
   React state or the router cache.
5. **Counts are props.** The member shell takes unread counts for Requests and Alerts, and the admin shell takes queue
   sizes. The tasks that own those numbers (RQ, NT-01, admin screens) fill them in; no endpoint is invented here.

## Consequences
- Reading cookies in the root layout makes every route dynamic (no static prerendering, landing page included).
  That's acceptable for an app where almost every page is personal.
- A full page load of a signed-in page now makes two `/auth/me` calls (proxy and root layout). Client-side navigation
  doesn't re-render the root layout, so it adds nothing there. Revisit together with ADR 0004's note on caching.
- **Update (2026-10-06):** the caching note above is partly answered. The layout's lookup is memoized for the render
  (`renderAccount`), so a page that needs the account shares the layout's call instead of making a third one. `proxy.ts`
  still makes its own, and still gives up after 2 s. The shell now waits as long as the page does, so an API that is
  down leaves a signed-in page on its loading state until the call times out rather than for 2 s.
- Visitors without a Laravel session cookie cost no API call, as in the proxy.

import { cache } from "react";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { createServerApiClient } from "@/lib/api/server";
import { needsAccountLookup } from "@/lib/auth/lookup-account";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";

/**
 * What asking the API who the current visitor is produced. `ok: false` keeps the reason, because callers differ in
 * what they do about it: the shell can be rendered without the account, while a page that exists only for a signed-in
 * visitor shows the error screen. "We couldn't check" is never the same as "signed out".
 */
export type RenderAccount = { ok: true; account: Account | null } | { ok: false; error: unknown };

/**
 * The signed-in account for the current render, asked for once per request.
 *
 * The root layout, the sign-in page, the guest-only guard, and pages that need the account all ask the same question
 * while one page is rendered. Every ask is a call to Laravel, and the calls are answered one after another — the dev
 * server serves one request at a time — so a render that asks three times spends three round trips of latency before
 * it can paint, and the last would-be call can outlive the server call timeout and turn a page that had all the data
 * it needed into an error screen. `cache` collapses those asks into one call and hands the same answer to everyone.
 */
export const renderAccount = cache(async (): Promise<RenderAccount> => {
  const cookie = (await cookies()).toString() || null;

  if (!needsAccountLookup(cookie)) return { ok: true, account: null };

  // The configured origin, not the request's: behind a reverse proxy that can be an internal address that Sanctum
  // doesn't recognise as our SPA, which would make every signed-in visitor look signed out.
  try {
    const client = createServerApiClient({ cookie, origin: env.appUrl });
    return { ok: true, account: await fetchSession(client) };
  } catch (error) {
    return { ok: false, error };
  }
});

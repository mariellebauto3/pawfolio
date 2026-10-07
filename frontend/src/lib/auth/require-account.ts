import { redirect } from "next/navigation";
import { signInPath } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";
import type { Account } from "@/types/account";

/**
 * The signed-in account, for a page that reads differently by role (Browse, a resume, a Home Profile). It shares the
 * root layout's lookup, so a render still makes one /auth/me call. Signed out: on to sign-in, then back to
 * `returnTo`. When the API couldn't say, the error is thrown for the route's error screen: "we couldn't check" is
 * not "signed out". The role only chooses what to show; the API checks every request itself (SEC-FE-05).
 */
export async function requireAccount(returnTo: string): Promise<Account> {
  const lookup = await renderAccount();
  if (!lookup.ok) throw lookup.error;
  if (!lookup.account) redirect(signInPath(returnTo));
  return lookup.account;
}

import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";

/**
 * For pages only visitors use (sign-up): someone already signed in goes to their own home instead. A convenience,
 * like proxy.ts (SEC-FE-06); the sign-up endpoints refuse signed-in accounts themselves.
 */
export async function redirectSignedInAccount(): Promise<void> {
  const lookup = await renderAccount();
  if (lookup.ok && lookup.account) redirect(homePathFor(lookup.account));
}

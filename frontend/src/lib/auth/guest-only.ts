import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lookUpAccount } from "@/lib/auth/lookup-account";
import { homePathFor } from "@/lib/auth/redirects";

/**
 * For pages only visitors use (sign-up): someone already signed in goes to their own home instead. A convenience,
 * like proxy.ts (SEC-FE-06); the sign-up endpoints refuse signed-in accounts themselves.
 */
export async function redirectSignedInAccount(): Promise<void> {
  const account = await lookUpAccount((await cookies()).toString() || null);
  if (account) redirect(homePathFor(account));
}

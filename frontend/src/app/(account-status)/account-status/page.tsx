import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getAccountStatus } from "@/features/auth/api/account-status";
import { AccountStatusScreen } from "@/features/auth/components/account-status-screen";
import { getServerApi } from "@/lib/api/server";
import { homePathFor, signInPath } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account status" };

// AU-18 Pending approval, AU-20 Account denied, AU-21 Account suspended, and the closed-account message. An account
// that is Active (approved since it last looked) goes to its home instead.
export default async function AccountStatusPage() {
  const api = await getServerApi();
  const account = await fetchSession(api);
  if (!account) redirect(signInPath(ROUTES.accountStatus));

  const info = await getAccountStatus(api);
  if (info.status === "active") redirect(homePathFor({ ...account, status: info.status }));

  return <AccountStatusScreen account={account} info={info} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { getSettings } from "@/features/accounts/api/settings";
import { SettingsScreen } from "@/features/accounts/components/settings-screen";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Settings" };

// AC-01 Settings (pet) and AC-02 Settings (human), one page. Whose settings they are comes from the session: the
// API answers the signed-in account's own and nobody else's (SEC-AUTHZ-02). An admin has no member settings.
export default async function SettingsPage() {
  const account = await requireAccount(ROUTES.settings);
  if (account.role === "admin") redirect(homePathFor(account));

  return <SettingsScreen settings={await getSettings(await getServerApi())} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAccount } from "@/features/accounts/api/admin-accounts";
import { AccountDetailScreen } from "@/features/accounts/components/account-detail-screen";
import { accountIdFromUrl } from "@/features/accounts/schemas/accounts";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";

// The account's name stays out of the tab title and the browser history.
export const metadata: Metadata = { title: "Account" };

type Props = {
  params: Promise<{ accountId: string }>;
};

// AC-07 Account detail, with the Suspend, Reactivate and Deactivate dialogs (AC-08…AC-10) and the review of a
// change to a verified detail (AC-03) on it. The API checks the admin role and loads the record itself, and answers
// an admin's own id like one that doesn't exist (SEC-AUTHZ-02, SEC-AUTHZ-04, SEC-AUTHZ-07).
export default async function AccountPage({ params }: Props) {
  // Only a plain account id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  const id = accountIdFromUrl((await params).accountId);
  if (id === null) notFound();

  const account = await getAccount(await getServerApi(), id).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  return <AccountDetailScreen account={account} />;
}

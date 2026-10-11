import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVerificationReview } from "@/features/auth/api/verification-review";
import { VerificationReviewScreen } from "@/features/auth/components/verification-review-screen";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";

// The account's name stays out of the tab title and the browser history.
export const metadata: Metadata = { title: "Review account" };

type Props = {
  params: Promise<{ accountId: string }>;
};

// AU-23 Review pet account, AU-24 Review human account, and the same page once decided (AU-26). The API checks the
// admin role and loads the record itself (SEC-AUTHZ-02, SEC-AUTHZ-07).
export default async function VerificationReviewPage({ params }: Props) {
  const { accountId } = await params;
  // Only a plain account id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(accountId)) notFound();

  const api = await getServerApi();
  const review = await getVerificationReview(api, Number(accountId)).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  return <VerificationReviewScreen review={review} />;
}

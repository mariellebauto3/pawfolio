import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ROUTES } from "@/constants/routes";
import { getAccountStatus, getSubmission } from "@/features/auth/api/account-status";
import { AdminReason } from "@/features/auth/components/admin-reason";
import { HumanSubmissionForm } from "@/features/auth/forms/human-submission-form";
import { PetSubmissionForm } from "@/features/auth/forms/pet-submission-form";
import { getServerApi } from "@/lib/api/server";
import { canEditSubmission } from "@/lib/auth/account-status";
import { homePathFor, signInPath } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit submitted details" };

// AU-19 Edit submitted details, for Pending and Denied accounts. Anyone else goes to their own home: the feed or
// dashboard when Active, the status screen when Suspended or closed.
export default async function EditSubmissionPage() {
  const api = await getServerApi();
  const account = await fetchSession(api);
  if (!account) redirect(signInPath(ROUTES.accountEdit));
  if (!canEditSubmission(account)) redirect(homePathFor(account));

  const [submission, info] = await Promise.all([getSubmission(api), getAccountStatus(api)]);
  const denied = info.status === "denied";

  return (
    <>
      <PageHeader
        title="Edit submitted details"
        description={
          denied
            ? "Correct your details and resubmit. Saving puts your account back in the review queue as Pending Verification."
            : "Your account stays in Pending Verification while you edit. Saving puts it back in the review queue."
        }
      />
      {denied && <AdminReason info={info} className="mb-5" />}
      {submission.role === "pet" ? <PetSubmissionForm submission={submission} /> : <HumanSubmissionForm submission={submission} />}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { getOwnPet } from "@/features/profiles/api/resume";
import { ResumeWizard } from "@/features/profiles/forms/resume-wizard";
import { stepFromParam } from "@/features/profiles/schemas/resume-schemas";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Edit resume" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// PR-03…PR-10: the edit resume wizard. `?step=2` opens a step (1 to 6), so "Continue editing" on a Draft and a
// reload land where they should. Only a pet has a resume; the API checks that itself (SEC-FE-05).
export default async function EditResumePage({ searchParams }: Props) {
  const account = await requireAccount(ROUTES.resumeEdit);
  const api = await getServerApi();
  if (account.role !== "pet") redirect(homePathFor(account));

  const [pet, params] = await Promise.all([getOwnPet(api), searchParams]);

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title="Edit resume"
        description="Details marked Locked were verified by an admin. Everything else goes live when you save."
        actions={
          <Link prefetch={false} href={ROUTES.me} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
            Preview resume
          </Link>
        }
      />
      <ResumeWizard pet={pet} initialStep={stepFromParam(params.step) ?? 0} />
    </div>
  );
}

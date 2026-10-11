import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { getOwnHomeProfile } from "@/features/profiles/api/home-profile";
import { HomeProfileWizard } from "@/features/profiles/forms/home-profile-wizard";
import { quizStepFromParam } from "@/features/profiles/schemas/home-profile-schemas";
import { getServerApi } from "@/lib/api/server";
import { homePathFor, signInPath } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home Profile & lifestyle quiz" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// PR-14…PR-20: the Home Profile & lifestyle quiz. `?step=2` opens a step (1 to 6), so "Continue the quiz" and a
// reload land where they should. Only a human has a Home Profile; the API checks that itself (SEC-FE-05).
export default async function EditHomeProfilePage({ searchParams }: Props) {
  const api = await getServerApi();
  const account = await fetchSession(api);
  if (!account) redirect(signInPath(ROUTES.homeProfileEdit));
  if (account.role !== "human") redirect(homePathFor(account));

  const [home, params] = await Promise.all([getOwnHomeProfile(api), searchParams]);

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title="Home Profile & lifestyle quiz"
        description="Pets read this like a job posting. It takes about 5 minutes."
        actions={
          <Link href={ROUTES.me} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
            View my profile
          </Link>
        }
      />
      <HomeProfileWizard home={home} initialStep={quizStepFromParam(params.step) ?? 0} />
    </div>
  );
}

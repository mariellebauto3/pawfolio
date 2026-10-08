import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES, homeProfilePath } from "@/constants/routes";
import type { ApplyBlocker } from "../schemas/apply-state";
import { ApplyBlockedDetails, applyBlockedHeading, applyBlockedWayOut } from "./apply-blocked-details";

type Props = {
  home: { id: number; full_name: string };
  /** The rule in the way, or "not_accepting" when the home turned Open to Adopt off. */
  reason: ApplyBlocker | "not_accepting";
};

// The Send request page of a pet that can't apply to this home right now (RQ-03): it got here from an old link or
// by typing the address. It reads what the dialogs RQ-05 and RQ-06 say, in place of a form whose letter the API
// would refuse.
export function ApplyUnavailable({ home, reason }: Props) {
  const back = (
    <Link href={homeProfilePath(home.id)} className={buttonClasses()}>
      Back to the Home Profile
    </Link>
  );

  if (reason === "not_accepting") {
    return (
      <EmptyState
        icon="ban"
        titleAs="h1"
        title={`${home.full_name} isn’t taking requests right now`}
        description="This home turned Open to Adopt off. If it turns it back on, you can apply then."
        action={
          <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
            See Homes for You
          </Link>
        }
        secondaryAction={back}
      />
    );
  }

  const { title, subtitle } = applyBlockedHeading(reason, home.full_name);
  const wayOut = applyBlockedWayOut(reason);

  return (
    <section className="mx-auto flex w-full max-w-narrow flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-primary-soft text-primary">
          <Icon name="clock" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl wrap-break-word">{title}</h1>
          <p className="text-ink-muted">{subtitle}</p>
        </div>
      </div>
      <ApplyBlockedDetails blocker={reason} homeName={home.full_name} />
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
        {back}
        <Link href={wayOut.href} className={buttonClasses({ variant: "primary" })}>
          {wayOut.label}
        </Link>
      </div>
    </section>
  );
}

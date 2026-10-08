import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import type { IneligibleReason } from "../types/matching";

export type SetupStep = { label: string; done: boolean };

type Props = {
  /** Why the API has no matches for this account yet. */
  reason: IneligibleReason;
  /** MT-04: what the human has set up so far, when it could be read. */
  setup?: SetupStep[];
  /** Where the quiz (MT-04) or the resume (MT-05) is picked up again: the first step with something left to do. */
  continueHref: string;
};

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  return (
    <ul aria-label="Setup so far" className="flex flex-col gap-2 text-left">
      {steps.map(({ label, done }) => (
        <li key={label} className="flex items-center gap-3">
          {done ? (
            <Icon name="circle-check" className="size-5 shrink-0 text-primary" />
          ) : (
            <span aria-hidden="true" className="size-5 shrink-0 rounded-pill border-[1.5px] border-line-strong" />
          )}
          <span className={done ? undefined : "text-ink-muted"}>
            {label}
            <span className="sr-only">{done ? ": done" : ": not done yet"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// What /matches shows to an account the API has no matches for yet: MT-04 until a human finishes the Home Profile &
// quiz, MT-05 while a pet's resume is a Draft, and a pet that has been Hired, which isn't looking any more. Each
// says why the list is empty and offers the step that fills it (ui-guidelines §5).
export function MatchesNotReady({ reason, setup, continueHref }: Props) {
  if (reason === "quiz_incomplete") {
    return (
      <Card>
        <EmptyState
          icon="compass"
          title="Finish your Home Profile to see your matches"
          description="Pets for You compares your lifestyle quiz with each pet’s resume. It takes about 5 minutes."
          action={
            <div className="flex flex-col items-center gap-5">
              {setup && <SetupChecklist steps={setup} />}
              <Link href={continueHref} className={buttonClasses({ variant: "primary" })}>
                Take the lifestyle quiz
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  if (reason === "already_adopted") {
    return (
      <Card>
        <EmptyState
          icon="heart"
          title="You’ve been Hired"
          description="Homes for You is for pets that are still looking for a home. Your resume is an alumni profile now, linked to your Furparent."
          action={
            <Link href={ROUTES.me} className={buttonClasses({ variant: "primary" })}>
              View my profile
            </Link>
          }
          secondaryAction={
            <Link href={ROUTES.memberHome} className={buttonClasses()}>
              Back to the feed
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <EmptyState
        icon="pencil"
        title="Finish your resume to see Homes for You"
        description="Your resume is still a Draft. Homes for You compares it with each human’s Home Profile, so it starts once the resume is published."
        action={
          <Link href={continueHref} className={buttonClasses({ variant: "primary" })}>
            Continue resume
          </Link>
        }
      />
    </Card>
  );
}

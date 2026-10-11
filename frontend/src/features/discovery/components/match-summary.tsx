import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { DEALBREAKER_FAILED_LABELS } from "@/constants/matching";
import type { MatchEvaluation } from "../types/discovery";

type Props = {
  /** Who the viewer is being matched with: the pet's or the human's name. */
  name: string;
  /** From the profile endpoint; undefined when the API worked out no match. */
  match: MatchEvaluation | undefined;
  /** What to say, and where to send the viewer, when there is no match to show. */
  missing: { text: string; action?: { href: string; label: string } };
  /** Under a score: the way into the full breakdown (MT-03), which the Matching module owns. */
  breakdown?: ReactNode;
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <Card title="Your match" as="section">
      {children}
    </Card>
  );
}

// "Your match" beside a resume or a Home Profile (DS-05, DS-07): the score with its top reasons, never the number
// alone (ui-guidelines §6). A failed dealbreaker is said plainly instead of showing a 0. The full breakdown
// (MT-03) belongs to the Matching module; the page passes its button in.
export function MatchSummary({ name, match, missing, breakdown }: Props) {
  if (!match) {
    return (
      <Frame>
        <p className="text-sm">{missing.text}</p>
        {missing.action && (
          <Link href={missing.action.href} className="text-sm font-bold text-primary underline hover:text-primary-hover">
            {missing.action.label}
          </Link>
        )}
      </Frame>
    );
  }

  if (!match.passed_dealbreakers) {
    return (
      <Frame>
        <p className="font-bold">You and {name} aren’t a match.</p>
        <p className="text-sm text-ink-muted">These are checked before any score is worked out:</p>
        <ul className="flex flex-col gap-2 text-sm">
          {match.failed_dealbreakers.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Icon name="circle-x" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              {DEALBREAKER_FAILED_LABELS[key]}
            </li>
          ))}
        </ul>
      </Frame>
    );
  }

  return (
    <Frame>
      <Meter value={match.score} label={`Match with ${name}`} size="lg" />
      {match.reasons.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {match.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-primary" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {breakdown}
      <p className="text-sm text-ink-muted">You both see the same score. It updates when the quiz or the resume changes.</p>
    </Frame>
  );
}

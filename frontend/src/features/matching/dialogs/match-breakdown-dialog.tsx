"use client";

import type { ReactNode } from "react";
import { Alert } from "@/components/feedback/alert";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Meter } from "@/components/ui/meter";
import { Tag } from "@/components/ui/tag";
import { CRITERION_LABELS, DEALBREAKER_FAILED_LABELS, DEALBREAKER_PASSED_LABELS } from "@/constants/matching";
import { DEALBREAKERS } from "@/types/match";
import { useMatchBreakdown } from "../hooks/use-match-breakdown";
import type { MatchBreakdown } from "../types/matching";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The other side of the pair: the pet's id for a human, the Home Profile's id for a pet. */
  profileId: number;
  /** Who the viewer is matched with: the pet's or the human's name. */
  name: string;
  /** The score the page already shows, for the title while the breakdown loads. */
  score?: number;
};

function Step({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-lg">
        {title}
        {note && <span className="font-sans text-sm font-normal text-ink-muted">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

function Checks({ breakdown }: { breakdown: MatchBreakdown }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {DEALBREAKERS.map((key) =>
        breakdown.failed_dealbreakers.includes(key) ? (
          <li key={key}>
            <Tag icon={<Icon name="circle-x" className="text-ink-muted!" />}>{DEALBREAKER_FAILED_LABELS[key]}</Tag>
          </li>
        ) : (
          <li key={key}>
            <Tag icon={<Icon name="check" />}>{DEALBREAKER_PASSED_LABELS[key]}</Tag>
          </li>
        ),
      )}
    </ul>
  );
}

function Breakdown({ breakdown }: { breakdown: MatchBreakdown }) {
  const failed = breakdown.failed_dealbreakers.length;
  const total = breakdown.criteria.reduce((sum, criterion) => sum + criterion.max_points, 0);

  return (
    <>
      <Step title="Step 1: Dealbreakers" note={failed === 0 ? "All passed" : `${failed} of ${DEALBREAKERS.length} not passed`}>
        <Checks breakdown={breakdown} />
      </Step>

      {breakdown.passed_dealbreakers ? (
        <Step title="Step 2: Weighted score">
          <ul className="flex flex-col gap-3">
            {breakdown.criteria.map((criterion) => {
              const label = CRITERION_LABELS[criterion.key] ?? criterion.label;
              return (
                <li key={criterion.key} className="grid gap-1 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:gap-4">
                  <span className="text-sm">{label}</span>
                  <Meter value={criterion.points} max={criterion.max_points} label={label} size="sm" format="fraction" />
                </li>
              );
            })}
          </ul>
          <p className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <span className="font-bold">Total</span>
            <span className="font-display text-2xl leading-none font-bold tabular-nums">
              {breakdown.score}
              <span className="text-base text-ink-muted"> / {total}</span>
            </span>
          </p>
        </Step>
      ) : (
        <p className="text-sm text-ink-muted">
          A score is only worked out when all four dealbreakers pass, so there is none to show here.
        </p>
      )}

      {breakdown.passed_dealbreakers && breakdown.reasons.length > 0 && (
        <Step title="Top reasons">
          <ul className="flex flex-col gap-2 text-sm">
            {breakdown.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-primary" />
                {reason}
              </li>
            ))}
          </ul>
        </Step>
      )}
    </>
  );
}

function Loading() {
  return (
    <SkeletonGroup label="Loading the breakdown" className="flex flex-col gap-4">
      <Skeleton className="h-5 w-48" />
      <span className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-7 w-36 rounded-pill" />
        ))}
      </span>
      <Skeleton className="mt-2 h-5 w-48" />
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </SkeletonGroup>
  );
}

// MT-03 Match breakdown: why a score is what it is. The dealbreakers that were checked first, then the seven
// weighted criteria with the points each one earned, the total out of 100 and the top reasons. Read from the API
// when the dialog opens, so it explains the score as the server works it out now (the server is the source of
// truth for a match; nothing here is calculated in the browser).
export function MatchBreakdownDialog({ open, onClose, profileId, name, score }: Props) {
  const state = useMatchBreakdown(profileId, open);
  const breakdown = state.status === "ready" ? state.breakdown : null;
  const shown = breakdown ? breakdown.score : score;

  function close() {
    // A breakdown that failed to load is asked for again the next time the dialog opens.
    if (state.status === "error" && !state.gone) state.retry();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={
        breakdown && !breakdown.passed_dealbreakers
          ? `You and ${name} aren’t a match`
          : typeof shown === "number"
            ? `${Math.round(shown)}% match with ${name}`
            : `Your match with ${name}`
      }
      subtitle="The same score is shown to both sides. It updates when the quiz or the resume changes."
      footer={
        <Button variant="primary" onClick={close}>
          Got it
        </Button>
      }
    >
      {state.status === "ready" && <Breakdown breakdown={state.breakdown} />}
      {(state.status === "loading" || state.status === "idle") && <Loading />}
      {state.status === "error" && (
        <Alert
          tone={state.gone ? "info" : "error"}
          announce
          title={state.gone ? "There is no score for this match any more" : "The breakdown didn’t load"}
          action={
            !state.gone && (
              <Button size="sm" onClick={state.retry}>
                Try again
              </Button>
            )
          }
        >
          {state.gone ? "A resume or a Home Profile changed since this page loaded. Reload the page to see your current matches." : state.message}
        </Alert>
      )}
    </Modal>
  );
}

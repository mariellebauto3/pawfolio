"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  ACTIVITY_LEVEL_LABELS,
  HOME_TYPE_LABELS,
  OUTDOOR_SPACE_LABELS,
  PET_EXPERIENCE_LABELS,
  SPECIAL_NEEDS_WILLINGNESS_LABELS,
  hoursAwaySummary,
  householdSummary,
  otherPetsSummary,
  preferredPetSummary,
} from "@/constants/home-profiles";
import { MATCH_WEIGHTS, QUIZ_STEPS, quizStepsDone } from "../schemas/home-profile-schemas";
import type { OwnHomeProfile } from "../types/own-home-profile";

type Props = {
  home: OwnHomeProfile;
  /** Opens a step from a summary row, to change an answer or to give one that is still missing. */
  onGoToStep: (step: number) => void;
};

/** The saved answers of each question step in one line, in step order; null where the step isn't answered yet. */
function summaries(home: OwnHomeProfile): (string | null)[] {
  const household = householdSummary(home);
  const outdoor = home.outdoor_space && (home.outdoor_space === "none" ? "No outdoor space" : OUTDOOR_SPACE_LABELS[home.outdoor_space]);
  return [
    household && `${household} · Other pets: ${otherPetsSummary(home).toLowerCase()}`,
    home.home_type && outdoor && `${HOME_TYPE_LABELS[home.home_type]} · ${outdoor} · ${home.city}`,
    home.activity_level && home.hours_away && `${ACTIVITY_LEVEL_LABELS[home.activity_level]} · Away ${hoursAwaySummary(home.hours_away)}`,
    home.pet_experience &&
      home.special_needs_willingness &&
      `${PET_EXPERIENCE_LABELS[home.pet_experience]} · Special needs: ${SPECIAL_NEEDS_WILLINGNESS_LABELS[home.special_needs_willingness].toLowerCase()}`,
    preferredPetSummary(home),
  ];
}

// PR-19 Review: the answers as they are saved, each with a way back to its step, and what the match score is made
// of. Saving is the wizard's last button.
export function QuizReviewStep({ home, onGoToStep }: Props) {
  const done = quizStepsDone(home);
  const lines = summaries(home);
  const total = MATCH_WEIGHTS.reduce((sum, weight) => sum + weight.points, 0);

  return (
    <>
      <ul aria-label="Your answers" className="flex flex-col divide-y divide-line rounded-card border border-line">
        {lines.map((line, step) => (
          <li key={QUIZ_STEPS[step]} className="flex items-center gap-3 px-4 py-3">
            <Icon
              name={done[step] ? "circle-check" : "triangle-alert"}
              className={done[step] ? "size-5 shrink-0 text-primary" : "size-5 shrink-0 text-danger"}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm text-ink-muted">
                {QUIZ_STEPS[step]}
                <span className="sr-only">{done[step] ? ": answered" : ": still needed"}</span>
              </span>
              <span>{(done[step] && line) || "Not answered yet"}</span>
            </span>
            <Button variant="tertiary" size="sm" onClick={() => onGoToStep(step)}>
              {done[step] ? "Edit" : "Answer"}
              <span className="sr-only"> {QUIZ_STEPS[step]}</span>
            </Button>
          </li>
        ))}
      </ul>

      <section aria-labelledby="quiz-weights" className="flex flex-col gap-4 rounded-card bg-surface-sunken p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <h3 id="quiz-weights" className="text-xl">
            How your answers are scored
          </h3>
          <p className="max-w-[65ch] text-sm text-ink-muted">
            A pet first has to pass the dealbreakers: a species you accept, your kids, your other pets and your province. Then your
            answers are compared with its resume for up to {total} points.
          </p>
        </div>

        {/* The whole score as one strip: each piece is as wide as its share of the points. The list below says the same in words. */}
        <div aria-hidden="true" className="flex h-3 gap-0.5">
          {MATCH_WEIGHTS.map((weight) => (
            <span key={weight.key} className="rounded-badge bg-primary" style={{ flexGrow: weight.points }} />
          ))}
        </div>

        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {MATCH_WEIGHTS.map((weight) => (
            <div key={weight.key} className="flex items-baseline gap-3">
              <dd className="w-8 shrink-0 text-right text-lg font-bold tabular-nums">{weight.points}</dd>
              <dt className="flex min-w-0 flex-col">
                <span className="font-bold">{weight.label}</span>
                <span className="text-sm text-ink-muted">Compared with {weight.against}</span>
              </dt>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-sm text-ink-muted">
        Your answers are saved as you go, and your matches are worked out again whenever one changes. Pets for You unlocks once every
        step above is answered.
      </p>
    </>
  );
}

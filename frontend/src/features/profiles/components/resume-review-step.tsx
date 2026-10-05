"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PET_SIZE_LABELS } from "@/constants/pets";
import { formatAgeMonths } from "@/lib/utils/format-age";
import { REQUIREMENT_LABELS, REQUIREMENT_STEP } from "../schemas/resume-schemas";
import { type OwnPet, RESUME_REQUIREMENTS } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  /** Opens a step from a checklist item that still needs work. */
  onGoToStep: (step: number) => void;
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// PR-08 Review & publish: a summary of the saved resume and the checklist the API keeps. Publish is the wizard's
// last button; it moves a Draft to Looking for a Home on the server (FR27).
export function ResumeReviewStep({ pet, onGoToStep }: Props) {
  const { completeness } = pet;
  const draft = pet.status === "draft";
  const facts = [pet.breed, formatAgeMonths(pet.approximate_age_months), pet.size && PET_SIZE_LABELS[pet.size], pet.city].filter(Boolean);
  const summary = [
    count(pet.photos.length, "photo", "photos"),
    count(pet.temperament_tags.length, "temperament tag", "temperament tags"),
    count(pet.skills.length, "skill", "skills"),
    pet.health_notes ? "Health notes added" : "No health notes yet",
  ];

  return (
    <>
      <div className="flex items-center gap-4 rounded-card border border-line p-4">
        <Avatar name={pet.name} src={pet.photos[0]?.url} alt="" size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-xl font-bold">{pet.name}</span>
          <span className="text-sm text-ink-muted">{facts.join(" · ")}</span>
          <span className="text-sm">{summary.join(" · ")}</span>
        </div>
      </div>

      <ul aria-label="Publishing checklist" className="flex flex-col divide-y divide-line rounded-card border border-line">
        {RESUME_REQUIREMENTS.map((requirement) => {
          const done = completeness.steps[requirement];
          return (
            <li key={requirement} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <Icon name={done ? "circle-check" : "triangle-alert"} className={done ? "size-5 shrink-0 text-primary" : "size-5 shrink-0 text-danger"} />
              <span className="flex-1">
                {REQUIREMENT_LABELS[requirement]}
                <span className="sr-only">{done ? ": done" : ": still needed"}</span>
              </span>
              {!done && (
                <Button variant="tertiary" size="sm" onClick={() => onGoToStep(REQUIREMENT_STEP[requirement])}>
                  Finish<span className="sr-only"> {REQUIREMENT_LABELS[requirement]}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {completeness.missing.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-ink-muted">
          {completeness.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted">
        {draft
          ? "Publishing moves your status from Draft to Looking for a Home automatically and posts a “For Hire” update to the feed."
          : "Your resume is live. What you saved on each step is already showing."}
      </p>
    </>
  );
}

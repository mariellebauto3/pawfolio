import type { ComponentType } from "react";
import { Icon } from "@/components/ui/icon";
import { LANDING_SECTIONS } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { HiredCardArt, MatchArt, MeetArt, ResumeArt } from "./landing-illustrations";
import { CURSOR_TARGET_ATTR } from "./landing-motion";
import { TargetCursor } from "./target-cursor";

type Step = { title: string; body: string; Art: ComponentType<{ className?: string }> };

const STEPS: Step[] = [
  { title: "Build a resume", body: "Photos, bio, temperament, skills and health, written in the pet's own words.", Art: ResumeArt },
  { title: "Match with homes", body: "Humans take a lifestyle quiz. Both sides see a match score and the reasons behind it.", Art: MatchArt },
  { title: "Apply and meet", body: "The pet sends an adoption request, then books a Meet & Greet with the human.", Art: MeetArt },
  { title: "Get Hired", body: "The human chooses Adopt. The pet gets the Hired badge and the human becomes a Furparent.", Art: HiredCardArt },
];

// AU-01 "How it works": four illustrated tiles in order, so they're numbered. The number chips use the badge
// language: dashed while the pet is still on its way, solid yellow at Hired. With a mouse, the pointer becomes a
// spinning bracket cursor that frames each tile it's over (target-cursor.tsx); the section hides the normal cursor
// only while that cursor is showing.
export function HowItWorks() {
  return (
    <section
      id={LANDING_SECTIONS.howItWorks}
      aria-labelledby="how-it-works-title"
      className="scroll-mt-16 bg-surface px-gutter py-16 md:py-24 data-[target-cursor=on]:cursor-none data-[target-cursor=on]:**:cursor-none"
    >
      <TargetCursor />
      <div className="mx-auto max-w-content">
        <h2 id="how-it-works-title" className="text-3xl md:text-4xl">
          How it works
        </h2>
        <p className="mt-3 max-w-[50ch] text-lg text-ink-muted">From resume to Hired, the way a job hunt goes.</p>

        <ol className="mt-10 grid gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map(({ title, body, Art }, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <li
                key={title}
                {...{ [CURSOR_TARGET_ATTR]: isLast ? "hired" : "step" }}
                className="grid grid-cols-[6.5rem_1fr] content-start items-start gap-4 rounded-dialog border border-line bg-surface p-3 md:grid-cols-1 md:gap-0 md:p-4"
              >
                <div
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-card md:aspect-4/3",
                    isLast ? "bg-accent-soft" : "bg-sky-soft",
                  )}
                >
                  <Art className="w-[88%]" />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-2 left-2 grid size-8 place-items-center rounded-pill border-[1.5px] font-display text-base font-bold md:size-9",
                      isLast
                        ? "border-accent-edge bg-accent text-accent-ink"
                        : "border-dashed border-line-strong bg-surface text-ink",
                    )}
                  >
                    {isLast ? <Icon name="check" className="size-4" /> : index + 1}
                  </span>
                </div>
                <div className="md:mt-4 md:px-1 md:pb-2">
                  <h3 className="text-xl">
                    <span className="sr-only">Step {index + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-1.5 text-ink-muted">{body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stepper } from "./stepper";

export type WizardStep = {
  label: string;
  content: ReactNode;
};

type Props = {
  steps: WizardStep[];
  /** Controlled zero-based step. Leave out to let the wizard keep its own. */
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Validate the current step. Return false to stay on it (show inline errors first). */
  onNext?: (step: number, form: HTMLFormElement) => boolean | Promise<boolean>;
  onFinish: (form: HTMLFormElement) => void | Promise<void>;
  /** Final button, e.g. "Submit for review". Wizards are the one place a generic "Submit" is allowed. */
  finishLabel?: string;
  /** Shows "Save draft" when given (resume, Home Profile). */
  onSaveDraft?: (form: HTMLFormElement) => void | Promise<void>;
  /** Short note next to Save draft, e.g. "Draft saved at 10:42 AM". Announced politely. */
  draftStatus?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
};

// Multi-step form shell for sign-up (5 steps), resume (6) and Home Profile & quiz (6), NFR1.
// Every step stays mounted (inactive ones are hidden), so typed answers survive Back/Next and FormData sees them all.
export function Wizard({
  steps,
  step,
  defaultStep = 0,
  onStepChange,
  onNext,
  onFinish,
  finishLabel = "Submit",
  onSaveDraft,
  draftStatus,
  headingLevel: Heading = "h2",
  className,
}: Props) {
  const baseId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const [inner, setInner] = useState(defaultStep);
  const [busy, setBusy] = useState<"next" | "draft" | null>(null);

  const current = Math.min(Math.max(step ?? inner, 0), steps.length - 1);
  const last = current === steps.length - 1;

  // After Back/Next, move focus to the new step's heading so keyboard and screen-reader users start at the top.
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [current]);

  function goTo(next: number) {
    moved.current = true;
    if (step === undefined) setInner(next);
    onStepChange?.(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy("next");
    try {
      if (last) {
        await onFinish(form);
      } else if ((await onNext?.(current, form)) !== false) {
        goTo(current + 1);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveDraft(form: HTMLFormElement | null) {
    if (!form || !onSaveDraft || busy) return;
    setBusy("draft");
    try {
      await onSaveDraft(form);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Stepper steps={steps.map((s) => s.label)} current={current} />
          <Heading
            ref={headingRef}
            id={`${baseId}-heading`}
            tabIndex={-1}
            className="flex flex-col gap-0.5"
          >
            <span className="font-display text-lg font-semibold text-primary">
              Step {current + 1} of {steps.length}
            </span>
            <span className="text-3xl">{steps[current].label}</span>
          </Heading>
        </div>

        {steps.map((s, i) => (
          <div
            key={s.label}
            role="group"
            aria-labelledby={i === current ? `${baseId}-heading` : undefined}
            hidden={i !== current}
            className="flex flex-col gap-5"
          >
            {s.content}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {current > 0 && (
            <Button variant="secondary" onClick={() => goTo(current - 1)} disabled={busy !== null}>
              Back
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            {onSaveDraft && (
              <>
                <p aria-live="polite" className="text-sm text-ink-muted">
                  {draftStatus}
                </p>
                <Button
                  variant="tertiary"
                  loading={busy === "draft"}
                  loadingLabel="Saving draft"
                  onClick={(event) => handleSaveDraft(event.currentTarget.form)}
                >
                  Save draft
                </Button>
              </>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={busy === "next"}
              loadingLabel={last ? "Submitting" : "Checking this step"}
            >
              {last ? finishLabel : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

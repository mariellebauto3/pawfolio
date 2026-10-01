"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldContext } from "./field-context";
import { FieldMessages } from "./field-messages";

type Props = {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

// A labelled group of controls (choice chips, radio cards, a list of checkboxes). The legend names the group for
// screen readers; hint and error are linked to the group.
export function Fieldset({
  legend,
  hint,
  error,
  required = false,
  optional = false,
  disabled = false,
  className,
  children,
}: Props) {
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider
      value={{ controlId: `${baseId}-control`, describedBy, invalid: Boolean(error), required, disabled }}
    >
      <fieldset
        aria-describedby={describedBy}
        aria-required={required || undefined}
        disabled={disabled}
        className={cn("flex min-w-0 flex-col gap-1", className)}
      >
        <legend className="mb-1.5 text-sm font-bold text-ink">
          {legend}
          {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
        </legend>
        {children}
        <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
      </fieldset>
    </FieldContext.Provider>
  );
}

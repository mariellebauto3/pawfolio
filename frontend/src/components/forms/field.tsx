"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils/cn";
import { FieldContext } from "./field-context";
import { FieldMessages } from "./field-messages";

type Props = {
  label: ReactNode;
  /** Helper text under the control, e.g. "Only your city is shown publicly." */
  hint?: ReactNode;
  /** Inline error. Its presence marks the control aria-invalid and links the message with aria-describedby. */
  error?: ReactNode;
  required?: boolean;
  /** Adds "(optional)" after the label. Most Pawfolio fields are required, so only the exceptions are marked. */
  optional?: boolean;
  disabled?: boolean;
  /** Text inside the label after its name, such as the Locked marker. Never put interactive content here. */
  labelSuffix?: ReactNode;
  /** Use when the control needs a specific id; otherwise one is generated. */
  id?: string;
  className?: string;
  /** One control: Input, Textarea, Select or FileUpload. Group controls use Fieldset instead. */
  children: ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  disabled = false,
  labelSuffix,
  id,
  className,
  children,
}: Props) {
  const baseId = useId();
  const controlId = id ?? `${baseId}-control`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ controlId, describedBy, invalid: Boolean(error), required, disabled }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={controlId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-ink">
          <span>
            {label}
            {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
          </span>
          {labelSuffix}
        </label>
        {children}
        <FieldMessages hintId={hintId} errorId={errorId} hint={hint} error={error} />
      </div>
    </FieldContext.Provider>
  );
}

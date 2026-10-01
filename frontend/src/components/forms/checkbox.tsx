"use client";

import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useFieldState } from "./field-context";
import { FieldMessages } from "./field-messages";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  /** Inline error, e.g. "Agree to the Terms to create your account." */
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

// The whole label row is the hit area (at least 44 px tall), so the 20 px box is easy to tap.
export function Checkbox({ label, description, error, className, id, disabled, ...props }: Props) {
  const baseId = useId();
  const group = useFieldState();
  const inputId = id ?? `${baseId}-input`;
  const descId = `${baseId}-desc`;
  const errorId = `${baseId}-error`;
  const invalid = Boolean(error) || group.invalid;
  const isDisabled = disabled ?? group.disabled;
  const describedBy = [error ? errorId : null, description ? descId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "group/control relative flex min-h-11 items-start gap-3 py-2.5 text-base text-ink",
          isDisabled && "cursor-not-allowed text-ink-muted",
        )}
      >
        <input
          {...props}
          id={inputId}
          type="checkbox"
          disabled={isDisabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-badge border-[1.5px] border-line-strong bg-surface",
            "text-primary-ink transition-colors duration-200 ease-out group-hover/control:border-ink-muted",
            "peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:focus-ring",
            "peer-aria-[invalid=true]:border-danger",
            "peer-disabled:border-line peer-disabled:bg-surface-sunken peer-disabled:peer-checked:bg-line-strong",
          )}
        >
          <Icon
            name="check"
            strokeWidth={3}
            className="size-3.5 opacity-0 transition-opacity duration-100 group-has-checked/control:opacity-100"
          />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{label}</span>
          {description && (
            <span id={descId} className="text-sm text-ink-muted">
              {description}
            </span>
          )}
        </span>
      </label>
      {error && <FieldMessages hintId={descId} errorId={errorId} error={error} />}
    </div>
  );
}

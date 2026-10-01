"use client";

import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { cn } from "@/lib/utils/cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  label: ReactNode;
  description?: ReactNode;
  /** "end" puts the label after the switch (LoFi default); "start" puts it first, as in settings rows. */
  labelPosition?: "start" | "end";
  ref?: Ref<HTMLInputElement>;
};

// An on/off switch for settings that apply right away, such as Open to Adopt. A native checkbox with role="switch",
// so it is announced as on/off and toggles with Space.
export function Toggle({ label, description, labelPosition = "end", className, id, disabled, ...props }: Props) {
  const baseId = useId();
  const inputId = id ?? `${baseId}-input`;
  const descId = `${baseId}-desc`;

  const text = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span>{label}</span>
      {description && (
        <span id={descId} className="text-sm text-ink-muted">
          {description}
        </span>
      )}
    </span>
  );

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "group/control relative flex min-h-11 items-center gap-3 py-2 text-base text-ink",
        labelPosition === "start" && "justify-between",
        disabled && "cursor-not-allowed text-ink-muted",
        className,
      )}
    >
      {labelPosition === "start" && text}
      <input
        {...props}
        id={inputId}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-describedby={description ? descId : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-pill border-[1.5px] border-line-strong bg-surface",
          "transition-colors duration-200 ease-out group-hover/control:border-ink-muted",
          "peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:focus-ring",
          "peer-disabled:border-line peer-disabled:bg-surface-sunken",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 size-4 -translate-y-1/2 rounded-pill bg-ink-muted",
            "transition-transform duration-200 ease-out",
            "group-has-checked/control:translate-x-5 group-has-checked/control:bg-primary-ink",
          )}
        />
      </span>
      {labelPosition === "end" && text}
    </label>
  );
}

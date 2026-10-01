"use client";

import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Fieldset } from "./fieldset";

export type RadioCardOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
};

type Props = {
  legend: ReactNode;
  options: RadioCardOption[];
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Two columns from md up, for short options such as household types. */
  columns?: 1 | 2;
  className?: string;
};

// One choice among a few options that each need a line of explanation (report actions, Meet & Greet slots).
export function RadioCards({
  legend,
  options,
  hint,
  error,
  required,
  disabled,
  name,
  value,
  defaultValue,
  onChange,
  columns = 1,
  className,
}: Props) {
  const generatedName = useId();
  const [inner, setInner] = useState(defaultValue);
  const selected = value !== undefined ? value : inner;

  function pick(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  return (
    <Fieldset legend={legend} hint={hint} error={error} required={required} disabled={disabled} className={className}>
      <div className={cn("grid gap-2", columns === 2 && "md:grid-cols-2")}>
        {options.map((option) => {
          const descId = `${generatedName}-${option.value}-desc`;
          return (
            <label
              key={option.value}
              className={cn(
                "group/control relative flex min-h-11 items-start gap-3 rounded-card border border-line-strong bg-surface p-4",
                "transition-colors duration-200 ease-out hover:border-ink-muted",
                "has-checked:border-primary has-checked:bg-primary-soft has-checked:ring-1 has-checked:ring-primary",
                "has-focus-visible:focus-ring",
                Boolean(error) && "border-danger",
                "has-disabled:cursor-not-allowed has-disabled:border-line has-disabled:bg-surface-sunken",
              )}
            >
              <input
                type="radio"
                name={name ?? generatedName}
                value={option.value}
                checked={selected === option.value}
                onChange={() => pick(option.value)}
                required={required || undefined}
                aria-describedby={option.description ? descId : undefined}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill border-[1.5px] border-line-strong bg-surface peer-checked:border-primary"
              >
                <span className="size-2.5 scale-0 rounded-pill bg-primary transition-transform duration-200 ease-out group-has-checked/control:scale-100" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-bold text-ink">{option.label}</span>
                {option.description && (
                  <span id={descId} className="text-sm text-ink-muted">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </Fieldset>
  );
}

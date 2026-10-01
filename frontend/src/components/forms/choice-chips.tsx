"use client";

import { type ReactNode, useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { Fieldset } from "./fieldset";

export type ChoiceOption = string | { value: string; label: string };

type CommonProps = {
  legend: ReactNode;
  options: ChoiceOption[];
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  /** Form field name. Generated when left out. */
  name?: string;
  className?: string;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
};

type MultipleProps = CommonProps & {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
};

type Props = SingleProps | MultipleProps;

function normalize(option: ChoiceOption) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

// Pill-shaped choices for quiz and résumé answers. Single choice uses radios (arrow keys move between them);
// multiple choice uses checkboxes. A selected chip shows a check as well as the blue fill.
export function ChoiceChips(props: Props) {
  const { legend, options, hint, error, required, optional, disabled, className } = props;
  const generatedName = useId();
  const name = props.name ?? generatedName;
  const type = props.multiple ? "checkbox" : "radio";

  const initial = props.multiple ? (props.defaultValue ?? []) : props.defaultValue ? [props.defaultValue] : [];
  const [inner, setInner] = useState<string[]>(initial);
  const controlled = props.value !== undefined;
  const selected = controlled ? (props.multiple ? props.value! : [props.value!]) : inner;

  function toggle(value: string) {
    if (props.multiple) {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
      if (!controlled) setInner(next);
      props.onChange?.(next);
    } else {
      if (!controlled) setInner([value]);
      props.onChange?.(value);
    }
  }

  return (
    <Fieldset
      legend={legend}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      disabled={disabled}
      className={className}
    >
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const { value, label } = normalize(option);
          return (
            <label key={value} className="group/control relative inline-flex">
              <input
                type={type}
                name={name}
                value={value}
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
                required={type === "radio" && required ? true : undefined}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-pill border-[1.5px] border-line-strong bg-surface px-4",
                  "text-sm font-bold text-ink transition-colors duration-200 ease-out md:min-h-9",
                  "group-hover/control:border-ink-muted peer-focus-visible:focus-ring",
                  "peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary-soft-ink",
                  Boolean(error) && "border-danger",
                  "peer-disabled:cursor-not-allowed peer-disabled:border-line peer-disabled:text-ink-muted",
                )}
              >
                <Icon name="check" strokeWidth={2.5} className="hidden size-4 shrink-0 group-has-checked/control:block" />
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </Fieldset>
  );
}

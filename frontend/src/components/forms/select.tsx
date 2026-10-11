"use client";

import type { Ref, SelectHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { CONTROL_CLASSES } from "./control-styles";
import { useFieldControl } from "./field-context";

type Option = string | { value: string; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: Option[];
  /** First, empty choice such as "Choose a species". Selected until the user picks something. */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
};

// Native select (keyboard, screen-reader and phone pickers for free) with a token-styled chevron.
// Never use it to set a pet or request status (FR27).
export function Select({ options, placeholder, className, defaultValue, value, ...props }: Props) {
  const field = useFieldControl(props);
  const initial = value === undefined && defaultValue === undefined && placeholder ? "" : defaultValue;

  return (
    <div className={cn("relative", className)}>
      <select
        {...props}
        {...field}
        value={value}
        defaultValue={initial}
        className={cn(CONTROL_CLASSES, "appearance-none pr-10")}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => {
          const { value: v, label } = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={v} value={v}>
              {label}
            </option>
          );
        })}
      </select>
      <Icon
        name="chevron-down"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

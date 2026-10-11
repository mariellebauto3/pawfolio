"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  icon: IconName;
  /** What the button does, read by screen readers and shown as a tooltip: "Close", "Post options". Required. */
  label: string;
  /** `inverse` sits on dark or coloured fills (toasts). */
  tone?: "default" | "inverse";
  ref?: Ref<HTMLButtonElement>;
};

const TONES = {
  default: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  inverse: "text-current hover:bg-ink-inverse/15",
};

// Square, round, 44 × 44 px on every screen size (touch target). For text buttons use Button.
export function IconButton({ icon, label, tone = "default", type = "button", className, ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-200 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

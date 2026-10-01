"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { type ButtonSize, type ButtonVariant, buttonClasses } from "./button-styles";
import { Icon } from "./icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows a spinner and ignores clicks while an action runs (ui-ux-pro-max: loading-buttons). */
  loading?: boolean;
  /** Read by screen readers while loading, e.g. "Sending request". Defaults to "Working". */
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  block,
  loading = false,
  loadingLabel = "Working",
  icon,
  type = "button",
  className,
  onClick,
  children,
  ...rest
}: Props) {
  // While loading the button stays focusable (aria-disabled, not disabled) so keyboard focus isn't dropped mid-action.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <Icon name="spinner" className="size-4 shrink-0 animate-spin" /> : icon}
      {children}
      {loading && <span className="sr-only">, {loadingLabel}</span>}
    </button>
  );
}

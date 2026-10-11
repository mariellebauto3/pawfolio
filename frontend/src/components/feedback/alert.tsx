import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type AlertTone = "info" | "success" | "warning" | "error";

type Props = {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** A small button or link that helps fix the problem, shown under the text. */
  action?: ReactNode;
  /**
   * Set when the alert appears after something the user did (a failed save), so screen readers read it out.
   * Errors interrupt (role="alert"); the others wait their turn (role="status"). Leave off for alerts present on load.
   */
  announce?: boolean;
  className?: string;
};

// Success stays on the blue axis (no green); the icon and the words carry the meaning, never colour alone.
const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: "bg-primary-soft text-primary-soft-ink", icon: "info" },
  success: { box: "bg-success-soft text-success-soft-ink", icon: "circle-check" },
  warning: { box: "bg-accent-soft text-accent-soft-ink", icon: "triangle-alert" },
  error: { box: "bg-danger-soft text-danger-soft-ink", icon: "alert" },
};

// A message inside a card or form: "Couldn't save your changes", "Your ID photo is blurry". For a message about the
// whole page use Banner; for a short confirmation after an action use a toast.
export function Alert({ tone = "info", title, children, action, announce = false, className }: Props) {
  const { box, icon } = TONES[tone];
  const role = announce ? (tone === "error" ? "alert" : "status") : undefined;

  return (
    <div role={role} className={cn("flex gap-3 rounded-card px-4 py-3", box, className)}>
      <Icon name={icon} className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        {title && <p className="text-base font-bold">{title}</p>}
        {children && <div className="text-ink">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { BadgeTone } from "@/constants/status-badges";
import { cn } from "@/lib/utils/cn";

// Tone utilities are defined in globals.css from the badge tokens.
const TONES: Record<BadgeTone, string> = {
  progress: "badge-progress",
  celebrate: "badge-celebrate",
  attention: "badge-attention",
  closed: "badge-closed",
};

type Props = {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
};

// For statuses prefer <StatusBadge status="Hired" />. Use Badge directly for labels that aren't a status name,
// such as "Decision needed" or "Overdue 4 days". The text is always visible, so colour never carries meaning alone.
export function Badge({ tone, children, className }: Props) {
  return (
    <span
      className={cn(
        TONES[tone],
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

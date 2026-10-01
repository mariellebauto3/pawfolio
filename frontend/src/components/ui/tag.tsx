import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  children: ReactNode;
  /** Optional leading icon, e.g. <Icon name="check" /> for "Species accepted". */
  icon?: ReactNode;
  className?: string;
};

// A descriptive label (personality trait, match reason). Not interactive and not a status; statuses use Badge.
export function Tag({ children, icon, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-0.5 text-sm text-ink",
        "[&_svg]:size-4 [&_svg]:text-primary",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

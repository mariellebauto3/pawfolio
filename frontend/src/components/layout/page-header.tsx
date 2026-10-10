import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** The page's one h1, e.g. "Verification queue". */
  title: ReactNode;
  /** One line on what the page is for: "New Human and Pet accounts waiting for review. Newest first." */
  description?: ReactNode;
  /** Page-level actions or a search box, on the right on desktop and below the title on phones. */
  actions?: ReactNode;
  className?: string;
};

// The title block at the top of a page inside a shell (AU-22, RQ-07…).
export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {description && <p className="max-w-[65ch] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

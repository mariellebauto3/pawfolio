import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  /** Shown at the top right of the card, e.g. a small tertiary button. */
  action?: ReactNode;
  /** Heading level for the title, so the card fits the page outline. */
  titleAs?: "h2" | "h3";
  as?: "section" | "article" | "div";
  /** "none" for cards whose content runs to the edge, such as a photo on a match card. */
  padding?: "md" | "none";
  className?: string;
  children?: ReactNode;
};

// Cards sit on the canvas with a 1 px line and no shadow; shadows are only for things that float (HiFi rule 5).
export function Card({
  title,
  description,
  action,
  titleAs: Heading = "h2",
  as: Element = "section",
  padding = "md",
  className,
  children,
}: Props) {
  const hasHead = title || description || action;

  return (
    <Element
      className={cn(
        "flex flex-col gap-4 rounded-card border border-line bg-surface",
        padding === "md" && "p-4 md:p-5",
        padding === "none" && "overflow-hidden",
        className,
      )}
    >
      {hasHead && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {title && <Heading className="text-xl">{title}</Heading>}
            {description && <p className="text-sm text-ink-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Element>
  );
}

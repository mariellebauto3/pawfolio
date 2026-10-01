import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type Props = {
  icon?: IconName;
  /** Why it's empty, in plain words: "No requests yet". */
  title: ReactNode;
  /** What to do about it: "Pets you invite or approve will show up here." */
  description?: ReactNode;
  /** The next step, usually one primary button or link: "Take the lifestyle quiz". */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  titleAs?: "h2" | "h3";
  className?: string;
};

// An empty list is an invitation to act (ui-guidelines §5): say why it's empty and offer the next step.
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  secondaryAction,
  titleAs: Heading = "h2",
  className,
}: Props) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-10 text-center", className)}>
      <span className="mb-1 grid size-16 place-items-center rounded-pill bg-primary-soft text-primary">
        <Icon name={icon} className="size-7" />
      </span>
      <Heading className="text-xl">{title}</Heading>
      {description && <p className="text-ink-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

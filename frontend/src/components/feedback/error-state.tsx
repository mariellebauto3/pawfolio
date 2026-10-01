import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type ErrorKind = "network" | "not-found" | "forbidden" | "server";

// Fixed, friendly copy per kind. The component never shows an error's own message, code or stack
// (ui-guidelines §5, SEC-API-02): those can leak internals and mean nothing to the user.
const COPY: Record<ErrorKind, { icon: IconName; title: string; description: string }> = {
  network: {
    icon: "wifi-off",
    title: "Can't reach Pawfolio",
    description: "Check your internet connection, then try again.",
  },
  // Also used for records the user may not see (SEC-AUTHZ-04), so it doesn't say which of the two it is.
  "not-found": {
    icon: "search",
    title: "This page isn't available",
    description: "It may have been moved or removed. Check the link, or go back and try again.",
  },
  forbidden: {
    icon: "lock",
    title: "You can't open this page",
    description: "Your account doesn't have access to it.",
  },
  server: {
    icon: "alert",
    title: "Something went wrong on our side",
    description: "Try again in a moment. If it keeps happening, contact the Help center.",
  },
};

/** Picks the kind from an HTTP status. No status (the request never got an answer) counts as a network problem. */
export function errorKindFromStatus(status?: number): ErrorKind {
  if (!status) return "network";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "server";
}

type Props = {
  kind?: ErrorKind;
  /** Overrides for a specific screen. Keep them plain: what happened and how to recover. */
  title?: ReactNode;
  description?: ReactNode;
  /** Shows "Try again". In an `error.tsx` boundary, pass Next's `retry` prop (it re-fetches and re-renders). */
  onRetry?: () => void;
  /** Another way out, e.g. a link back to Home. */
  action?: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
};

// A view that failed to load: a list, a page, a panel. For a failed action inside a form, use Alert.
export function ErrorState({
  kind = "server",
  title,
  description,
  onRetry,
  action,
  titleAs: Heading = "h2",
  className,
}: Props) {
  const copy = COPY[kind];

  return (
    <div
      role="alert"
      className={cn("mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-10 text-center", className)}
    >
      <span className="mb-1 grid size-16 place-items-center rounded-pill bg-surface-sunken text-ink-muted">
        <Icon name={copy.icon} className="size-7" />
      </span>
      <Heading className="text-xl">{title ?? copy.title}</Heading>
      <p className="text-ink-muted">{description ?? copy.description}</p>
      {(onRetry || action) && (
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button variant="primary" icon={<Icon name="refresh" className="size-4" />} onClick={onRetry}>
              Try again
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}

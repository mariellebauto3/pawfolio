import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** `line` for text, `block` for photos and cards, `circle` for avatars. Size it with className (h-*, w-*, size-*). */
  shape?: "line" | "block" | "circle";
  className?: string;
};

const SHAPES = {
  line: "h-4 rounded-badge",
  block: "rounded-card",
  circle: "rounded-pill",
};

// Grey placeholder in the shape of what's loading, so the page doesn't jump when it arrives
// (ui-ux-pro-max: content-jumping). Reduced motion stops the pulse globally.
export function Skeleton({ shape = "line", className }: Props) {
  return <span aria-hidden="true" className={cn("block animate-pulse bg-surface-sunken", SHAPES[shape], className)} />;
}

/** A paragraph of placeholder lines, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 && lines > 1 ? "w-3/5" : "w-full"} />
      ))}
    </span>
  );
}

type GroupProps = {
  /** Read by screen readers instead of the shapes: "Loading your matches". */
  label: string;
  children: ReactNode;
  className?: string;
};

/** The default `loading.tsx` body inside a shell: a page title and two content blocks. */
export function PageSkeleton() {
  return (
    <SkeletonGroup label="Loading page" className="flex flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <Skeleton shape="block" className="h-40" />
      <Skeleton shape="block" className="h-40" />
    </SkeletonGroup>
  );
}

// Wrap a set of skeletons in one of these so screen readers hear a single "Loading…" message.
export function SkeletonGroup({ label, children, className }: GroupProps) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

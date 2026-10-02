"use client";

import { type FocusEvent, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type ToastTone = "success" | "info" | "error";

export type ToastData = {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
};

const TONES: Record<ToastTone, { box: string; icon: IconName; iconClass?: string }> = {
  // Yellow means good news; on the dark toast it marks success without needing green.
  success: { box: "bg-surface-inverse text-ink-inverse", icon: "circle-check", iconClass: "text-accent" },
  info: { box: "bg-surface-inverse text-ink-inverse", icon: "info" },
  error: { box: "bg-danger text-danger-ink", icon: "alert" },
};

type ViewportProps = {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
};

// Bottom-left on desktop, full width at the bottom on phones (ui-guidelines §5), always above the member tab bar
// (--pf-bottom-offset). Rendered by ToastProvider; screen reader announcements come from the provider's live regions,
// so they're read once, not with the buttons.
export function ToastViewport({ toasts, onDismiss }: ViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <section
      aria-label="Notifications"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-(--pf-bottom-offset) z-(--pf-z-toast) flex flex-col gap-2",
        "px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "md:right-auto md:bottom-[calc(var(--pf-bottom-offset)+1.5rem)] md:left-6 md:w-toast md:p-0",
      )}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </section>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(toast.duration);
  const paused = hovered || focused;

  // Auto-dismiss after ~5 s. The clock stops while the pointer or keyboard focus is on the toast (WCAG 2.2.1).
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, toast.id, onDismiss]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  const tone = TONES[toast.tone];

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      className={cn(
        "pointer-events-auto flex animate-toast-in items-center gap-3 rounded-card py-1.5 pr-1.5 pl-4 shadow-toast",
        tone.box,
      )}
    >
      <Icon name={tone.icon} className={cn("size-5 shrink-0", tone.iconClass)} />
      <p className="min-w-0 flex-1 py-2">{toast.message}</p>
      <IconButton icon="x" label="Dismiss notification" tone="inverse" onClick={() => onDismiss(toast.id)} />
    </div>
  );
}

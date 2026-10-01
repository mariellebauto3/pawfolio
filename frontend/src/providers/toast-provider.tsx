"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { type ToastData, type ToastTone, ToastViewport } from "@/components/overlays/toast";

const TOAST_DURATION_MS = 5000;
const MAX_TOASTS = 3;

type ToastOptions = {
  /** `success` (default) for a completed action, `info` for neutral news, `error` when an action failed. */
  tone?: ToastTone;
  duration?: number;
};

type ToastApi = {
  /** One short sentence that names what happened: "Saved to Bookmarks.", "Request withdrawn." */
  show: (message: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

// Mounted once in the root layout. Any client component calls `useToast().show("…")`.
// Toasts sit below an open modal dialog (the dialog owns the top layer), so show them after the dialog closes;
// inside a dialog, use an Alert instead.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [announcement, setAnnouncement] = useState<ToastData | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    nextId.current += 1;
    const toast: ToastData = {
      id: nextId.current,
      message,
      tone: options.tone ?? "success",
      duration: options.duration ?? TOAST_DURATION_MS,
    };
    // Keep the newest few; older ones make way.
    setToasts((list) => [...list, toast].slice(-MAX_TOASTS));
    setAnnouncement(toast);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const isError = announcement?.tone === "error";

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {/* Live regions exist from the first render so screen readers pick up what's added later. The key makes a
          repeated message count as new. Errors interrupt; everything else waits its turn. */}
      <div aria-live="polite" className="sr-only">
        {announcement && !isError && <p key={announcement.id}>{announcement.message}</p>}
      </div>
      <div aria-live="assertive" className="sr-only">
        {announcement && isError && <p key={announcement.id}>{announcement.message}</p>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() needs a <ToastProvider> above it (see src/app/layout.tsx).");
  return api;
}

"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { getFocusable, trapTab } from "./focus";

export type DialogProps = {
  /** Controlled: the parent owns the state and closes the dialog in `onClose`. */
  open: boolean;
  /** Called by the close button, Escape and a click on the backdrop. */
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Actions. Cancel first (left), the primary action last (right) — ui-guidelines §5. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Field or button to focus on open. Default: the first focusable element in the body, then the footer. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** False while an action runs: Escape, the backdrop and the close button do nothing. */
  dismissible?: boolean;
  /** False for dialogs holding typed input, so a stray click can't throw it away. */
  closeOnBackdrop?: boolean;
  /** Wraps body and footer in a form, so Enter submits and footer buttons can be `type="submit"`. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

type FrameProps = DialogProps & {
  placement: "center" | "side";
  size?: "md" | "lg";
  role?: "dialog" | "alertdialog";
};

// Phone: centre dialogs are bottom sheets (full width, within thumb reach); side drawers fill the screen.
// From md: centred dialog 520/640 px wide, drawer 460 px on the right.
const PLACEMENT = {
  center:
    "mx-0 mt-auto mb-0 w-full max-w-full max-h-[92dvh] rounded-t-dialog animate-sheet-in " +
    "md:m-auto md:max-h-[calc(100dvh-3rem)] md:rounded-dialog md:animate-dialog-in",
  side: "m-0 ml-auto h-dvh max-h-dvh w-full max-w-full animate-drawer-in md:max-w-drawer md:rounded-l-dialog",
};

const SIZE = { md: "md:max-w-dialog", lg: "md:max-w-dialog-wide" };

// Shared by Modal and Drawer. Built on the native <dialog> with showModal(): the page behind becomes inert, the
// dialog sits in the top layer (no z-index fights), and Escape is handled here so the parent's state stays the truth.
export function DialogFrame({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  initialFocusRef,
  dismissible = true,
  closeOnBackdrop = true,
  onSubmit,
  placement,
  size = "md",
  role = "dialog",
}: FrameProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const subtitleId = `${baseId}-subtitle`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    // Whatever had focus when the dialog opened gets it back on close (WCAG 2.4.3).
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();

    const first = (el: HTMLElement | null) => (el ? getFocusable(el)[0] : undefined);
    const target =
      initialFocusRef?.current ?? first(bodyRef.current) ?? first(footerRef.current) ?? first(dialog) ?? dialog;
    target.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      // Cancelling the keydown stops the browser's own close, so the dialog only closes through onClose.
      event.preventDefault();
      event.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    trapTab(event, event.currentTarget);
  }

  // Other close requests, such as the Android back gesture.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (dismissible) onClose();
  }

  // If the browser closed the dialog anyway, bring the parent's state in line.
  function handleNativeClose() {
    if (!dialogRef.current?.open) onClose();
  }

  // Only a press that starts and ends on the backdrop closes, so selecting text and releasing outside doesn't.
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedBackdrop.current = event.target === event.currentTarget;
  }
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget || !pressedBackdrop.current) return;
    if (closeOnBackdrop && dismissible) onClose();
  }

  const content = (
    <>
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5 md:px-6"
      >
        {children}
      </div>
      {footer && (
        <div
          ref={footerRef}
          className={cn(
            "flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 pt-4 md:px-6",
            "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4",
            // Phone: footer buttons share the width, still cancel left and primary right.
            "*:flex-1 md:*:flex-none",
          )}
        >
          {footer}
        </div>
      )}
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        "overflow-hidden bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim backdrop:animate-fade-in",
        PLACEMENT[placement],
        placement === "center" && SIZE[size],
      )}
    >
      <div className={cn("flex flex-col", placement === "side" ? "h-full" : "max-h-[inherit]")}>
        <div className="flex items-start gap-3 border-b border-line py-3 pr-3 pl-5 md:pl-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
            <h2 id={titleId} className="text-xl md:text-2xl">
              {title}
            </h2>
            {subtitle && (
              <p id={subtitleId} className="text-sm text-ink-muted">
                {subtitle}
              </p>
            )}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} disabled={!dismissible} />
        </div>

        {onSubmit ? (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </dialog>
  );
}

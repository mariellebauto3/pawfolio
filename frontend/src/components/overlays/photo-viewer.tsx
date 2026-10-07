"use client";

import Image from "next/image";
import { type KeyboardEvent, type PointerEvent, type SyntheticEvent, useEffect, useId, useRef } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { trapTab } from "./focus";

export type ViewerPhoto = {
  id: number | string;
  src: string;
  /** Describes the picture: "Mochi: Beach day". */
  alt: string;
  caption?: string | null;
};

type Props = {
  /** Controlled, like Modal: the parent owns the state and closes the viewer in `onClose`. */
  open: boolean;
  onClose: () => void;
  /** Names the viewer: "Mochi's photos". */
  title: string;
  photos: ViewerPhoto[];
  /** Which photo is showing, 0-based. */
  index: number;
  onIndexChange: (index: number) => void;
};

/** A swipe has to travel this far sideways, and further sideways than up or down. */
const SWIPE_PX = 48;

// The dark disc keeps an arrow readable when it lies over a light photo.
const ARROW = "absolute top-1/2 -translate-y-1/2 bg-surface-inverse/70";

// Full-size photos on a dark surface (DS-06): the photo, previous and next, a strip of thumbnails and Close. Built
// on the native <dialog> like Modal, so the page behind is inert and the viewer sits in the top layer. ← and → move
// between photos (and wrap around), Home and End jump to the ends, Escape closes, a sideways swipe moves on touch
// screens, and focus goes back to the photo that opened it.
export function PhotoViewer({ open, onClose, title, photos, index, onIndexChange }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  const total = photos.length;
  const current = Math.min(Math.max(index, 0), total - 1);
  const photo = photos[current];
  if (!open || !photo) return null;

  const several = total > 1;
  const show = (target: number) => onIndexChange((target + total) % total);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      // Cancelling the keydown stops the browser's own close, so the viewer only closes through onClose.
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const target =
      event.key === "ArrowRight" ? current + 1
      : event.key === "ArrowLeft" ? current - 1
      : event.key === "Home" ? 0
      : event.key === "End" ? total - 1
      : null;
    if (target !== null && several) {
      event.preventDefault();
      show(target);
      return;
    }
    trapTab(event, event.currentTarget);
  }

  // Other close requests, such as the Android back gesture.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    swipeStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !several) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) show(dx < 0 ? current + 1 : current - 1);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
      onClose={() => {
        // If the browser closed the dialog anyway, bring the parent's state in line.
        if (!dialogRef.current?.open) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-full max-w-full animate-fade-in bg-surface-inverse p-0 text-ink-inverse"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 py-2 pr-2 pl-4 md:pl-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
            <h2 id={titleId} className="truncate text-lg md:text-xl">
              {title}
            </h2>
            {/* Read out when the photo changes, since nothing else on the screen says so. */}
            <p aria-live="polite" aria-atomic="true" className="text-sm tabular-nums">
              Photo {current + 1} of {total}
            </p>
          </div>
          <IconButton ref={closeRef} icon="x" label="Close" tone="inverse" onClick={onClose} />
        </div>

        {/* The photo gets the whole width on a phone, with the arrows over its edges; from md they sit beside it. */}
        <div className="relative min-h-0 flex-1">
          <div
            // Up and down still scroll or dismiss as the browser likes; only a sideways drag is ours.
            className="absolute inset-0 touch-pan-y md:inset-x-16"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            <Image
              key={photo.id}
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="100vw"
              preload
              draggable={false}
              className="object-contain select-none"
            />
          </div>
          {several && (
            <>
              <IconButton icon="chevron-left" label="Previous photo" tone="inverse" onClick={() => show(current - 1)} className={cn(ARROW, "left-1 md:left-3")} />
              <IconButton icon="chevron-right" label="Next photo" tone="inverse" onClick={() => show(current + 1)} className={cn(ARROW, "right-1 md:right-3")} />
            </>
          )}
        </div>

        <p className="min-h-6 px-4 pt-3 text-center text-sm">{photo.caption}</p>

        {several && (
          <ul className="flex shrink-0 justify-start gap-2 overflow-x-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:justify-center">
            {photos.map((item, i) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  aria-label={`Photo ${i + 1} of ${total}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => onIndexChange(i)}
                  className={cn(
                    "relative block h-14 w-[4.75rem] overflow-hidden rounded-control border-2 transition-opacity duration-200 ease-out",
                    i === current ? "border-ink-inverse" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <Image src={item.src} alt="" fill sizes="76px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

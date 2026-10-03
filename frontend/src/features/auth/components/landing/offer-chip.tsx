"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { HEART_RESET_MS, OFFER_SEND_MS, OFFER_SENT_MS, OFFER_START_MS } from "./landing-motion";
import { useStoryCycle } from "./use-story-cycle";

type Status = "idle" | "sending" | "sent";

type Props = {
  /** The bold part, like Call Chip's tool name: "Every pet deserves". */
  name: string;
  /** The rest, like Call Chip's argument: "a job offer." */
  argument: string;
};

const formatMs = (ms: number) => (ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

/** Icon roll, as in Call Chip: the new glyph rises in from below out of a blur, the old one leaves upwards. */
const GLYPH = "absolute inset-0 grid place-items-center transition-[translate,opacity,filter] ease-out";
const GLYPH_IN = "translate-y-0 opacity-100 blur-none duration-240";
const GLYPH_OUT = "-translate-y-[70%] opacity-0 blur-[3px] duration-160";
const GLYPH_WAITING = "translate-y-[70%] opacity-0 blur-[3px] duration-160";

/**
 * A sentence as a tool-call status chip, after reactbits.dev "Call Chip" (AU-01). While the offer is sending, a
 * briefcase shows, a faint blue wash fills the chip at a steady pace (holding at 90 %) and a timer counts up. On "sent"
 * the briefcase rolls out, a yellow check rolls in, the wash turns yellow and sweeps away, and the edge turns gold.
 * It replays with the hero's story (use-story-cycle.ts). The words are plain text; the rest is decorative.
 */
export function OfferChip({ name, argument }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const root = useRef<HTMLSpanElement>(null);
  const timer = useRef<HTMLSpanElement>(null);

  useStoryCycle(root, {
    steps: [
      [0, () => setStatus("idle")],
      [OFFER_START_MS, () => setStatus("sending")],
      [OFFER_SENT_MS, () => setStatus("sent")],
      [HEART_RESET_MS, () => setStatus("idle")],
    ],
    end: () => {
      if (timer.current) timer.current.textContent = formatMs(OFFER_SEND_MS);
      setStatus("sent");
    },
  });

  // The timer runs only while sending, then stays on the time it took.
  useEffect(() => {
    if (status === "idle" && timer.current) timer.current.textContent = formatMs(0);
    if (status !== "sending") return;
    const startedAt = performance.now();
    let frame = 0;
    const tick = () => {
      if (timer.current) timer.current.textContent = formatMs(performance.now() - startedAt);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const sent = status === "sent";
  return (
    <span
      ref={root}
      className={cn(
        "relative isolate inline-flex max-w-full items-center gap-[0.4em] overflow-hidden rounded-[0.45em] border-[1.5px] bg-surface",
        "px-[0.55em] py-[0.32em] text-left shadow-raised transition-colors duration-(--pf-duration-slow) ease-out sm:whitespace-nowrap",
        sent ? "border-accent-edge" : "border-line",
      )}
    >
      {/* The wash: fills linearly while sending, then turns yellow and sweeps away upwards once sent. */}
      <span
        aria-hidden="true"
        style={status === "sending" ? { transitionDuration: `${OFFER_SEND_MS}ms` } : undefined}
        className={cn(
          "absolute inset-0 -z-10 origin-left [clip-path:inset(0_0_0_0)]",
          status === "idle" && "scale-x-0 bg-primary-soft transition-none",
          status === "sending" && "scale-x-90 bg-primary-soft transition-[scale] ease-linear",
          sent &&
            "scale-x-100 bg-accent-soft [clip-path:inset(100%_0_0_0)] transition-[scale,background-color,clip-path] delay-[0ms,0ms,200ms] duration-[200ms,120ms,400ms] ease-out",
        )}
      />
      <span aria-hidden="true" className="relative size-[1.2em] shrink-0 overflow-hidden">
        <span className={cn(GLYPH, "text-primary", sent ? GLYPH_OUT : GLYPH_IN)}>
          <Icon name="briefcase" className="size-[0.8em]" />
        </span>
        <span className={cn(GLYPH, sent ? GLYPH_IN : GLYPH_WAITING)}>
          <span className="grid size-[1.05em] place-items-center rounded-pill bg-accent text-accent-ink">
            <Icon name="check" strokeWidth={3.5} className="size-[0.62em]" />
          </span>
        </span>
      </span>
      <span>
        <span className="font-bold text-ink">{name}</span> <span className="text-primary">{argument}</span>
      </span>
      <span
        ref={timer}
        aria-hidden="true"
        className="hidden min-w-[6.5ch] text-right font-sans text-[length:max(0.8125rem,0.5em)] font-normal text-ink-muted tabular-nums sm:inline"
      >
        0 ms
      </span>
    </span>
  );
}

"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { HEART_BEAT_DURATION_MS, HEART_BEAT_MS, HEART_RESET_MS, HEART_SWAP_AT } from "./landing-motion";
import { useStoryCycle } from "./use-story-cycle";

/** One beat, as in reactbits.dev "Pulse Heart": the heart shrinks to a dot, swaps state there, and swells back. */
const BEAT_MS = HEART_BEAT_DURATION_MS;
const SWAP_AT = HEART_SWAP_AT;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

type Props = {
  /** The word in the pill, e.g. "loved." */
  children: string;
};

/**
 * A word in a heart pill, after reactbits.dev "Pulse Heart" (AU-01): "The job is being [♥ loved.]". A dark-blue pill
 * with an outline heart; each time the hero's story reaches it (use-story-cycle.ts) the heart beats and turns solid
 * yellow, then quietly resets for the next run. Once the visitor clicks it, the loop stops and it's theirs to toggle.
 * No count: a number here would be made up.
 */
export function LoveHeart({ children }: Props) {
  const [loved, setLoved] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const heart = useRef<HTMLSpanElement>(null);
  const touched = useRef(false);
  /** Where the heart is heading: a click mid-beat toggles from here, not from what's on screen yet. */
  const target = useRef(false);
  const swap = useRef(0);

  function beat(next: boolean) {
    target.current = next;
    // A new beat replaces one still running.
    window.clearTimeout(swap.current);
    heart.current?.getAnimations().forEach((animation) => animation.cancel());
    pill.current?.getAnimations().forEach((animation) => animation.cancel());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !heart.current || !pill.current) {
      setLoved(next);
      return;
    }
    heart.current.animate(
      [
        { scale: 1, easing: "cubic-bezier(0.33, 1, 0.68, 1)" },
        { scale: 0.3, offset: SWAP_AT, easing: EASE },
        { scale: 1.16, offset: 0.78 },
        { scale: 1 },
      ],
      { duration: BEAT_MS },
    );
    pill.current.animate([{ scale: 1 }, { scale: 0.97, offset: SWAP_AT }, { scale: 1 }], { duration: BEAT_MS });
    swap.current = window.setTimeout(() => setLoved(next), BEAT_MS * SWAP_AT);
  }

  useStoryCycle(pill, {
    steps: [
      [HEART_BEAT_MS, () => beat(true)],
      [
        HEART_RESET_MS,
        () => {
          target.current = false;
          setLoved(false);
        },
      ],
    ],
    end: () => {
      target.current = true;
      setLoved(true);
    },
    stopped: touched,
  });

  return (
    <button
      ref={pill}
      type="button"
      aria-pressed={loved}
      onClick={() => {
        touched.current = true;
        beat(!target.current);
      }}
      className="group inline-flex items-center gap-[0.3em] rounded-pill bg-surface-brand py-[0.14em] pr-[0.6em] pl-[0.38em] align-baseline whitespace-nowrap text-ink-on-brand active:scale-97"
    >
      <span
        ref={heart}
        aria-hidden="true"
        className={cn(
          "grid transition-colors duration-160 ease-out",
          loved ? "text-accent" : "text-blue-300 group-hover:text-blue-200",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-[0.85em]" focusable="false">
          <path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
            className={cn("stroke-current transition-[fill] duration-160", loved ? "fill-current" : "fill-transparent")}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {children}
    </button>
  );
}

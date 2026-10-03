"use client";

import { type RefObject, useEffect, useRef } from "react";
import { CYCLE_MS } from "./landing-motion";

type Step = readonly [atMs: number, run: () => void];

type Options = {
  /** What happens in each cycle, by time from its start. */
  steps: readonly Step[];
  /** The finished state, shown at once with reduced motion. */
  end: () => void;
  /** Stop replaying, e.g. once the visitor has taken over. */
  stopped?: RefObject<boolean>;
};

/**
 * Plays the hero's story (landing-motion.ts) on load and replays it every CYCLE_MS, but only while `target` is on
 * screen and the tab is visible: a cycle that would start off screen is skipped. With reduced motion it shows the end
 * state once and never loops.
 */
export function useStoryCycle(target: RefObject<Element | null>, { steps, end, stopped }: Options) {
  const latest = useRef({ steps, end });
  useEffect(() => {
    latest.current = { steps, end };
  });

  useEffect(() => {
    const timers: number[] = [];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timers.push(window.setTimeout(() => latest.current.end(), 0));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    let onScreen = true;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    if (target.current) observer.observe(target.current);

    const play = () => {
      if (stopped?.current || !onScreen || document.hidden) return;
      for (const [at, run] of latest.current.steps) {
        timers.push(window.setTimeout(() => !stopped?.current && run(), at));
      }
    };
    play();
    const loop = window.setInterval(play, CYCLE_MS);

    return () => {
      window.clearInterval(loop);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [target, stopped]);
}

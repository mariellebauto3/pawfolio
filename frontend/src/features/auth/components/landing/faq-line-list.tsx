"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils/cn";
import { PawMark } from "./landing-illustrations";

type Item = { question: string; answer: string };

type Props = {
  items: readonly Item[];
};

/** How far from the pointer an item still reacts, in px, and how the effect fades with distance (smoothstep). */
const RADIUS = 110;
const falloff = (p: number) => p * p * (3 - 2 * p);
/** Easing time constant: the effect catches up with the pointer over about this many ms. */
const SMOOTHING_MS = 100;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The FAQ as a line list, after reactbits.dev "Line Sidebar" (AU-01). Each question has a short marker line to its
 * left and a tick between rows. As a mouse moves over the list, questions near it slide right and turn blue, and their
 * lines grow, fading with distance. Clicking a question opens its answer below it as a speech bubble from a paw
 * avatar, one at a time; the open question keeps the full effect.
 *
 * Accessibility follows the WAI-ARIA accordion pattern: each question is a button in an h3 with aria-expanded and
 * aria-controls, closed answers are inert, and Up/Down/Home/End move between questions. With touch or reduced motion
 * only the open question is lit, without the hover slide.
 */
export function FaqLineList({ items }: Props) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(0);
  const list = useRef<HTMLUListElement>(null);
  const answers = useRef<Array<HTMLDivElement | null>>([]);
  const rows = useRef<Array<HTMLLIElement | null>>([]);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const targets = useRef<number[]>([]);
  const current = useRef<number[]>([]);
  const openRef = useRef(open);
  const frame = useRef(0);
  const last = useRef(0);

  // Eases each row's --effect towards max(proximity, open ? 1 : 0), and stops once everything has settled.
  const step = useCallback(function step(now: number) {
    const dt = Math.min((now - last.current) / 1000, 0.05);
    last.current = now;
    const k = 1 - Math.exp(-dt / (SMOOTHING_MS / 1000));
    let moving = false;
    rows.current.forEach((row, i) => {
      if (!row) return;
      const target = Math.max(targets.current[i] ?? 0, openRef.current === i ? 1 : 0);
      const from = current.current[i] ?? 0;
      const value = from + (target - from) * k;
      const settled = Math.abs(target - value) < 0.002;
      current.current[i] = settled ? target : value;
      row.style.setProperty("--effect", current.current[i].toFixed(4));
      if (!settled) moving = true;
    });
    frame.current = moving ? requestAnimationFrame(step) : 0;
  }, []);

  const start = useCallback(() => {
    if (frame.current) return;
    last.current = performance.now();
    frame.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(() => {
    openRef.current = open;
    if (!reducedMotion()) {
      start();
      return;
    }
    // No easing: the open row lights up at once.
    rows.current.forEach((row, i) => row?.style.setProperty("--effect", open === i ? "1" : "0"));
    current.current = rows.current.map((_, i) => (open === i ? 1 : 0));
  }, [open, start]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // The list keeps one height whichever answer is open: all the questions plus the tallest answer. Measured again
  // whenever the width changes (answers wrap differently), so the section below never jumps.
  useEffect(() => {
    const listEl = list.current;
    if (!listEl) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
      const questions = buttons.current.reduce((sum, button) => sum + (button?.offsetHeight ?? 0), 0);
      const tallest = Math.max(0, ...answers.current.map((answer) => answer?.scrollHeight ?? 0));
      listEl.style.minHeight = `${questions + gap * (items.length - 1) + tallest}px`;
    };
    measure();
    let width = listEl.offsetWidth;
    const resize = new ResizeObserver(() => {
      if (listEl.offsetWidth === width) return;
      width = listEl.offsetWidth;
      measure();
    });
    resize.observe(listEl);
    document.fonts?.ready.then(measure);
    return () => resize.disconnect();
  }, [items.length]);

  function onPointerMove(event: PointerEvent<HTMLUListElement>) {
    if (event.pointerType !== "mouse" || reducedMotion()) return;
    buttons.current.forEach((button, i) => {
      if (!button) return;
      // Measured from the question line, not the whole row, so an open answer doesn't pull the centre down.
      const box = button.getBoundingClientRect();
      targets.current[i] = falloff(Math.max(0, 1 - Math.abs(event.clientY - (box.top + box.height / 2)) / RADIUS));
    });
    start();
  }

  function onPointerLeave() {
    targets.current = targets.current.map(() => 0);
    start();
  }

  // Up/Down/Home/End move focus between questions (WAI-ARIA accordion pattern).
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = items.length - 1;
    const next = { ArrowDown: i === last ? 0 : i + 1, ArrowUp: i === 0 ? last : i - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  }

  return (
    <ul
      ref={list}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ "--marker": "clamp(1.5rem, 4vw, 3rem)", "--row-gap": "0.75rem" } as CSSProperties}
      className="flex flex-col gap-(--row-gap) pl-[calc(var(--marker)+0.75rem)]"
    >
      {items.map(({ question, answer }, i) => {
        const isOpen = open === i;
        const buttonId = `${id}-q${i}`;
        const panelId = `${id}-a${i}`;
        return (
          <li
            key={question}
            ref={(row) => {
              rows.current[i] = row;
            }}
            className={cn(
              "relative",
              // Tick between rows, under the marker line; it stretches a little with the row's effect.
              i < items.length - 1 &&
                "after:absolute after:top-[calc(100%+var(--row-gap)/2)] after:left-[calc(-1*var(--marker)-0.75rem)] " +
                  "after:h-px after:w-[calc(var(--marker)*0.5)] after:origin-left after:bg-line-strong after:opacity-50 " +
                  "after:scale-[calc(0.7+var(--effect,0)*0.6)_1]",
            )}
          >
            <h3 className="font-sans">
              <button
                ref={(button) => {
                  buttons.current[i] = button;
                }}
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                onKeyDown={(event) => onKeyDown(event, i)}
                className="relative flex min-h-11 w-full items-center py-2 text-left"
              >
                {/* The marker line, level with the question; longer and blue as the effect grows. */}
                <span
                  aria-hidden="true"
                  className={
                    "absolute top-1/2 left-[calc(-1*var(--marker)-0.75rem)] h-0.5 w-(--marker) origin-left -translate-y-1/2 rounded-pill " +
                    "bg-[color-mix(in_srgb,var(--pf-primary)_calc(var(--effect,0)*100%),var(--pf-line-strong))] " +
                    "scale-[calc(0.7+var(--effect,0)*0.5)_1]"
                  }
                />
                <span
                  className={
                    "text-lg font-bold [translate:calc(var(--effect,0)*clamp(0.5rem,2vw,1.5rem))_0] " +
                    "text-[color-mix(in_srgb,var(--pf-primary)_calc(var(--effect,0)*100%),var(--pf-ink))]"
                  }
                >
                  {question}
                </span>
              </button>
            </h3>
            {/* The answer opens below its question (grid rows 0fr → 1fr) as a speech bubble from a paw avatar, lined up
                with the slid-out question. The bubble's tail points up at the question. */}
            <div
              id={panelId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-(--pf-duration-slow) ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div
                  ref={(answer) => {
                    answers.current[i] = answer;
                  }}
                  className="flex items-start gap-2.5 pt-2 pb-4 pl-[clamp(0.5rem,2vw,1.5rem)]">
                  <span
                    aria-hidden="true"
                    className="mt-1 grid size-8 shrink-0 place-items-center rounded-pill bg-primary text-primary-ink"
                  >
                    <PawMark className="size-4 fill-current" />
                  </span>
                  <p
                    className={cn(
                      "relative max-w-[58ch] rounded-card rounded-tl-badge bg-sky-soft px-4 py-3 text-ink-muted",
                      "origin-top-left transition-[scale] duration-(--pf-duration-slow) ease-out",
                      // Tail on the bubble's top-left corner, pointing back at the avatar.
                      "before:absolute before:top-0 before:-left-1.5 before:size-3 before:bg-sky-soft",
                      "before:[clip-path:polygon(100%_0,100%_100%,0_0)]",
                      isOpen ? "scale-100" : "scale-95",
                    )}
                  >
                    {answer}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { CURSOR_TARGET_ATTR } from "./landing-motion";

const CORNER = 12;
const BORDER = 3;
const SPIN_DEG_PER_MS = 360 / 2000;
/** Idle corners around the dot (top-left of each 12 px corner, relative to the cursor's centre). */
const IDLE = [
  [-CORNER * 1.5, -CORNER * 1.5],
  [CORNER * 0.5, -CORNER * 1.5],
  [CORNER * 0.5, CORNER * 0.5],
  [-CORNER * 1.5, CORNER * 0.5],
] as const;

const CORNER_CLASSES = [
  "border-t-[3px] border-l-[3px]",
  "border-t-[3px] border-r-[3px]",
  "border-r-[3px] border-b-[3px]",
  "border-b-[3px] border-l-[3px]",
];

/**
 * A spinning bracket cursor for the How it works section (AU-01), after reactbits.dev "Target Cursor", without GSAP.
 * Inside its parent section the pointer becomes four corners and a dot that spin; over a step tile the spin stops and
 * the corners spring out to frame the tile, trailing the pointer a little as it moves. Blue, or gold on the Hired step.
 * Only on fine pointers without reduced motion; elsewhere, and outside the section, the normal cursor stays.
 * Decorative: the tiles themselves carry the content.
 */
export function TargetCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const corners = useRef<Array<HTMLSpanElement | null>>([]);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursorEl = cursor.current;
    const section = cursorEl?.parentElement;
    if (!cursorEl || !section) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pointer = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    const offsets = IDLE.map(([x, y]) => ({ x, y }));
    let target: HTMLElement | null = null;
    let angle = 0;
    let scale = 1;
    let pressed = false;
    let inside = false;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      // The cursor eases onto the pointer quickly; the corners follow more slowly, which gives the parallax.
      at.x += (pointer.x - at.x) * 0.45;
      at.y += (pointer.y - at.y) * 0.45;
      if (target) {
        angle = 0;
        const r = target.getBoundingClientRect();
        const goals = [
          [r.left - BORDER, r.top - BORDER],
          [r.right + BORDER - CORNER, r.top - BORDER],
          [r.right + BORDER - CORNER, r.bottom + BORDER - CORNER],
          [r.left - BORDER, r.bottom + BORDER - CORNER],
        ];
        goals.forEach(([gx, gy], i) => {
          offsets[i].x += (gx - at.x - offsets[i].x) * 0.22;
          offsets[i].y += (gy - at.y - offsets[i].y) * 0.22;
        });
      } else {
        angle = (angle + SPIN_DEG_PER_MS * dt) % 360;
        IDLE.forEach(([ix, iy], i) => {
          offsets[i].x += (ix - offsets[i].x) * 0.25;
          offsets[i].y += (iy - offsets[i].y) * 0.25;
        });
      }
      scale += ((pressed ? 0.9 : 1) - scale) * 0.3;
      cursorEl.style.transform = `translate(${at.x}px, ${at.y}px) rotate(${angle}deg) scale(${scale})`;
      corners.current.forEach((corner, i) => {
        if (corner) corner.style.transform = `translate(${offsets[i].x}px, ${offsets[i].y}px)`;
      });
      frame = inside ? requestAnimationFrame(tick) : 0;
    };

    const findTarget = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>(`[${CURSOR_TARGET_ATTR}]`) : null;

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      inside = true;
      pointer.x = at.x = event.clientX;
      pointer.y = at.y = event.clientY;
      section.dataset.targetCursor = "on";
      cursorEl.dataset.visible = "true";
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!inside) onEnter(event);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const next = findTarget(event.target);
      if (next !== target) {
        target = next;
        cursorEl.dataset.tone = next?.getAttribute(CURSOR_TARGET_ATTR) === "hired" ? "hired" : "default";
      }
    };
    const onLeave = () => {
      inside = false;
      target = null;
      delete section.dataset.targetCursor;
      cursorEl.dataset.visible = "false";
    };
    const onDown = () => (pressed = true);
    const onUp = () => (pressed = false);

    section.addEventListener("pointerenter", onEnter);
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    section.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(frame);
      section.removeEventListener("pointerenter", onEnter);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      delete section.dataset.targetCursor;
    };
  }, []);

  return (
    <div
      ref={cursor}
      aria-hidden="true"
      data-visible="false"
      data-tone="default"
      className="group/cursor pointer-events-none fixed top-0 left-0 z-(--pf-z-dropdown) size-0 opacity-0 transition-opacity duration-150 data-[visible=true]:opacity-100"
    >
      <span
        ref={dot}
        className="absolute size-1 -translate-1/2 rounded-pill bg-primary transition-colors duration-150 group-data-[tone=hired]/cursor:bg-accent-edge"
      />
      {CORNER_CLASSES.map((classes, i) => (
        <span
          key={i}
          ref={(el) => {
            corners.current[i] = el;
          }}
          style={{ transform: `translate(${IDLE[i][0]}px, ${IDLE[i][1]}px)` }}
          className={cn(
            "absolute top-0 left-0 size-3 border-primary transition-colors duration-150 group-data-[tone=hired]/cursor:border-accent-edge",
            classes,
          )}
        />
      ))}
    </div>
  );
}

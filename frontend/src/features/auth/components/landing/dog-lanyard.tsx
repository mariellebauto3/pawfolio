"use client";

import Image from "next/image";
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { CARD_HINT_HOLD_MS, CARD_HINT_MS } from "./landing-motion";
import {
  type Lanyard,
  NECK_CLIP,
  PICTURE,
  STEP_SECONDS,
  cardAngle,
  createLanyard,
  motion,
  setCardHeight,
  step,
  strapPath,
} from "./lanyard-physics";

/** Card height in picture pixels until the real size is measured: 30 % of the picture's width, clasp + 3:4 body. */
const DEFAULT_CARD_HEIGHT = PICTURE.width * 0.3 * (0.12 + 4 / 3);

/** The first paint, shared by the server and the browser (the simulation is deterministic, so they agree). */
const RESTING = createLanyard(DEFAULT_CARD_HEIGHT);
const RESTING_CLIP = RESTING.points[RESTING.clip];

const FACE =
  "absolute inset-0 flex flex-col items-center rounded-control px-[8%] pt-[16%] pb-[9%] " +
  "text-center backface-hidden";

type Drag = { offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean };

/**
 * The lanyard the hero dog wears (AU-01). A strap comes out from under its collar to an ID card that says "Hired"
 * and, on the back, "Furever home". The card swings, can be dragged and springs back, and turns over when clicked,
 * tapped or pressed. Once the paw trail has walked in it turns over once and back, so people see it can be flipped.
 * It sits over the dog picture and uses its pixel grid (lanyard-physics.ts).
 *
 * Layers, bottom to top: the picture (drawn by the hero), the strap and its soft shadow, a copy of the picture clipped
 * to the head and neck fur (so the strap goes behind the neck), then the card.
 */
type Props = {
  /** The dog picture, drawn again over the strap for the head and neck. */
  pictureSrc: string;
};

export function DogLanyard({ pictureSrc }: Props) {
  const shadowId = `${useId()}-strap-shadow`;
  const [showingBack, setShowingBack] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLButtonElement>(null);
  const straps = useRef<Array<SVGPathElement | null>>([]);
  const ring = useRef<SVGCircleElement>(null);
  const lanyard = useRef<Lanyard | null>(null);
  const hold = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const wasDragged = useRef(false);
  const touched = useRef(false);
  const flipTarget = useRef(0);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    const overlayEl = overlay.current;
    const cardEl = card.current;
    if (!overlayEl || !cardEl) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sim = createLanyard(DEFAULT_CARD_HEIGHT);
    lanyard.current = sim;
    let flipAngle = 0;
    let flipSpeed = 0;
    let frame = 0;
    let last = 0;
    let carry = 0;
    let stillFrames = 0;

    // The card's height on screen, in picture pixels. The card has a minimum size, so on phones it is relatively
    // longer than on desktop.
    const measure = () => {
      const scale = overlayEl.clientWidth / PICTURE.width;
      if (scale > 0) setCardHeight(sim, cardEl.offsetHeight / scale);
    };

    const render = () => {
      const clip = sim.points[sim.clip];
      const swing = (clip.x - clip.px) / STEP_SECONDS;
      // Turning a little toward the swing gives the flat card some depth.
      const turn = reduceMotion ? 0 : Math.max(-35, Math.min(35, swing * 0.04));
      cardEl.style.left = `${(clip.x / PICTURE.width) * 100}%`;
      cardEl.style.top = `${(clip.y / PICTURE.height) * 100}%`;
      cardEl.style.transform = `translateX(-50%) rotate(${cardAngle(sim).toFixed(2)}deg)`;
      cardEl.style.setProperty("--card-turn", `${(flipAngle + turn).toFixed(2)}deg`);
      const paths = [strapPath(sim, sim.left), strapPath(sim, sim.right)];
      straps.current.forEach((path, index) => path?.setAttribute("d", paths[index % 2]));
      ring.current?.setAttribute("cx", clip.x.toFixed(1));
      ring.current?.setAttribute("cy", clip.y.toFixed(1));
    };

    const tick = (now: number) => {
      carry += Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      for (; carry >= STEP_SECONDS; carry -= STEP_SECONDS) {
        step(sim, hold.current);
        // The flip is a spring as well, so it overshoots a touch and settles like a real card.
        if (reduceMotion) flipAngle = flipTarget.current;
        else {
          flipSpeed += ((flipTarget.current - flipAngle) * 140 - flipSpeed * 16) * STEP_SECONDS;
          flipAngle += flipSpeed * STEP_SECONDS;
        }
      }
      render();
      const resting = !hold.current && motion(sim) < 0.05 && Math.abs(flipTarget.current - flipAngle) < 0.2;
      stillFrames = resting ? stillFrames + 1 : 0;
      // The loop stops once everything hangs still; any interaction starts it again.
      frame = stillFrames > 30 ? 0 : requestAnimationFrame(tick);
    };

    kick.current = () => {
      stillFrames = 0;
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    measure();
    const resize = new ResizeObserver(() => {
      measure();
      kick.current();
    });
    resize.observe(overlayEl);

    // Entrance: the card swings while the paw trail walks across, then shows its back for a moment and turns back to
    // Hired, unless someone has already played with it. Reduced motion skips both.
    const timers: number[] = [];
    const showBack = (back: boolean) => {
      if (touched.current) return;
      flipTarget.current = back ? 180 : 0;
      setShowingBack(back);
      kick.current();
    };
    if (!reduceMotion) {
      sim.points[sim.clip].px -= 9;
      timers.push(window.setTimeout(() => showBack(true), CARD_HINT_MS));
      timers.push(window.setTimeout(() => showBack(false), CARD_HINT_MS + CARD_HINT_HOLD_MS));
    }
    kick.current();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      lanyard.current = null;
    };
  }, []);

  function toPicture(event: PointerEvent) {
    const rect = overlay.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * PICTURE.width,
      y: ((event.clientY - rect.top) / rect.height) * PICTURE.height,
    };
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !lanyard.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = toPicture(event);
    const clip = lanyard.current.points[lanyard.current.clip];
    // Keep the card under the pointer where it was grabbed.
    drag.current = { offsetX: at.x - clip.x, offsetY: at.y - clip.y, startX: event.clientX, startY: event.clientY, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return;
    current.moved = true;
    const at = toPicture(event);
    hold.current = { x: at.x - current.offsetX, y: at.y - current.offsetY };
    kick.current();
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    wasDragged.current = drag.current?.moved ?? false;
    drag.current = null;
    hold.current = null;
    kick.current();
  }

  function onClick() {
    // A drag ends with a click too; only a tap, a click without moving, or Enter/Space turns the card over.
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    touched.current = true;
    flipTarget.current = showingBack ? 0 : 180;
    setShowingBack(!showingBack);
    kick.current();
  }

  // Left and right arrows give the card a push, so it can be played with from the keyboard too.
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!direction || !lanyard.current) return;
    event.preventDefault();
    lanyard.current.points[lanyard.current.clip].px -= direction * 8;
    kick.current();
  }

  return (
    <div ref={overlay} className="absolute inset-0">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${PICTURE.width} ${PICTURE.height}`}
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* A soft shadow under the strap, so it lies on the jacket instead of floating over it. */}
          {[RESTING.left, RESTING.right].map((indexes, index) => (
            <path
              key={`shadow-${index}`}
              ref={(path) => {
                straps.current[index + 4] = path;
              }}
              d={strapPath(RESTING, indexes)}
              strokeWidth={26}
              transform="translate(5 8)"
              filter={`url(#${shadowId})`}
              className="stroke-gray-900 opacity-35"
            />
          ))}
          {[RESTING.left, RESTING.right].map((indexes, index) => (
            <path
              key={`strap-${index}`}
              ref={(path) => {
                straps.current[index] = path;
              }}
              d={strapPath(RESTING, indexes)}
              strokeWidth={24}
              className="stroke-blue-700"
            />
          ))}
          {/* Stitching down the middle of the strap. */}
          {[RESTING.left, RESTING.right].map((indexes, index) => (
            <path
              key={`stitch-${index}`}
              ref={(path) => {
                straps.current[index + 2] = path;
              }}
              d={strapPath(RESTING, indexes)}
              strokeWidth={3}
              strokeDasharray="9 7"
              className="stroke-blue-300"
            />
          ))}
        </g>
        <circle ref={ring} cx={RESTING_CLIP.x} cy={RESTING_CLIP.y} r={12} strokeWidth={6} className="fill-none stroke-gray-400" />
      </svg>

      {/* The head and neck again, over the strap: the strap disappears behind the neck fur. */}
      <Image
        src={pictureSrc}
        width={PICTURE.width}
        height={PICTURE.height}
        alt=""
        aria-hidden="true"
        sizes="(min-width: 768px) 570px, 160px"
        draggable={false}
        style={{ clipPath: NECK_CLIP }}
        className="pointer-events-none absolute inset-0 size-full max-w-none select-none"
      />

      {/* The card is 30 % of the dog's width at every size, so it stays in proportion from phone to desktop. Its
          3.25rem floor only applies on the smallest screens, where it keeps "Hired" (26cqw) at 13 px or more. */}
      <button
        ref={card}
        type="button"
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onKeyDown}
        style={{
          left: `${(RESTING_CLIP.x / PICTURE.width) * 100}%`,
          top: `${(RESTING_CLIP.y / PICTURE.height) * 100}%`,
          transform: "translateX(-50%)",
        }}
        className="@container absolute z-10 block w-[max(3.25rem,30%)] origin-top cursor-grab touch-none rounded-control font-display font-bold select-none active:cursor-grabbing"
      >
        <span className="sr-only">Flip the lanyard card. It says: </span>
        {/* Metal clip from the strap's ring to the card. */}
        <span aria-hidden="true" className="mx-auto block h-[12cqw] w-[20cqw] rounded-b-badge border-[1.5px] border-t-0 border-gray-500 bg-gray-200" />
        <span className="block aspect-3/4 perspective-normal">
          <span className="relative block size-full transform-3d [transform:rotateY(var(--card-turn,0deg))]">
            <span aria-hidden={showingBack} className={cn(FACE, "border-2 border-accent-edge bg-accent text-accent-ink shadow-raised")}>
              <CardSlot />
              <Icon name="check" className="mt-auto size-[24cqw] shrink-0" strokeWidth={3} />
              <span className="mt-[4%] mb-auto text-[30cqw] leading-none">Hired</span>
            </span>
            <span aria-hidden={!showingBack} className={cn(FACE, "rotate-y-180 border-2 border-primary-hover bg-primary text-primary-ink shadow-raised")}>
              <CardSlot />
              <Icon name="home" className="mt-auto size-[24cqw] shrink-0" strokeWidth={2.5} />
              <span className="mt-[5%] mb-auto text-[22cqw] leading-[1.05]">Furever home</span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}

/** The punched slot at the top of an ID card, showing the page behind it. */
function CardSlot() {
  return <span aria-hidden="true" className="absolute top-[6%] left-1/2 h-[4%] w-[30%] -translate-x-1/2 rounded-pill bg-canvas" />;
}

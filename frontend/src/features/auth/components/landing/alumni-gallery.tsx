"use client";

import { type CSSProperties, type KeyboardEvent, useId, useRef, useState } from "react";
import { ApiImage } from "@/components/ui/api-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
import type { RecentlyHiredPet } from "../../types/recently-hired";
import { PawMark } from "./landing-illustrations";

const HIRED_MONTH = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" });

/** Share of the row the open panel takes (as reactbits.dev "Accordion Gallery": expandRatio 0.52). */
const EXPAND_RATIO = 0.52;
/** How far closed panels turn away from the open one, in degrees (desktop only). */
const TILT_DEG = 6;

type Props = {
  pets: readonly RecentlyHiredPet[];
};

/**
 * Recently Hired as an accordion gallery, after reactbits.dev "Accordion Gallery" (AU-01), without GSAP. One panel is
 * open: it takes about half the row, in colour, with the pet's name and Hired month on a yellow bar. The others are
 * narrow grey strips that turn slightly away from it. Hovering with a mouse, focusing, tapping or the arrow keys
 * open another panel. On phones the panels stack as rows instead of columns.
 *
 * Each panel is a button with aria-expanded, and its name and month are always in the accessible name, so screen
 * readers get every pet whichever panel is open. Reduced motion keeps the layout without the transitions.
 */
export function AlumniGallery({ pets }: Props) {
  const id = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const grow = pets.length > 1 ? (EXPAND_RATIO * (pets.length - 1)) / (1 - EXPAND_RATIO) : 1;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = pets.length - 1;
    const next = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowDown: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      ArrowUp: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <ul className="mt-8 flex h-[34rem] flex-col gap-2 md:mt-10 md:h-[clamp(22rem,36vw,28rem)] md:flex-row md:gap-2.5 md:perspective-[1400px]">
      {pets.map((pet, i) => {
        const isActive = i === active;
        const tilt = isActive ? 0 : i < active ? TILT_DEG : -TILT_DEG;
        const month = HIRED_MONTH.format(new Date(pet.hired_at));
        // A pet without a photo, or one whose photo can't be loaded after a second try, shows the paw instead.
        const paw = (
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-sky-soft">
            <PawMark className="w-1/4 max-w-24 fill-blue-200" />
          </span>
        );
        return (
          <li
            key={`${pet.name}-${pet.hired_at}`}
            style={{ flexGrow: isActive ? grow : 1, "--tilt": `${tilt}deg` } as CSSProperties}
            className={cn(
              "relative min-h-0 min-w-0 basis-0 overflow-hidden rounded-dialog bg-blue-950 shadow-raised",
              "transition-[flex-grow,transform] duration-600 ease-out md:transform-[rotateY(var(--tilt))]",
            )}
          >
            <button
              ref={(button) => {
                buttons.current[i] = button;
              }}
              id={`${id}-${i}`}
              type="button"
              aria-expanded={isActive}
              onClick={() => setActive(i)}
              onFocus={() => setActive(i)}
              onPointerEnter={(event) => event.pointerType === "mouse" && setActive(i)}
              onKeyDown={(event) => onKeyDown(event, i)}
              className="group absolute inset-0 block size-full overflow-hidden rounded-dialog text-left"
            >
              {pet.photo_url ? (
                <ApiImage
                  src={pet.photo_url}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 560px, 100vw"
                  fallback={paw}
                  className={cn(
                    "object-cover transition-[filter,scale] duration-600 ease-out",
                    isActive ? "scale-100 grayscale-0" : "scale-110 grayscale",
                  )}
                />
              ) : (
                paw
              )}

              {/* Dim on closed panels, and a dark-blue fade at the bottom so the label stays readable on any photo. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 bg-linear-to-t from-blue-950/85 via-blue-950/10 to-transparent transition-colors duration-600",
                  !isActive && "bg-blue-950/35",
                )}
              />

              {/* Closed rows on phones are too short for the badge as well as the name: there it shows on the open panel only. */}
              <StatusBadge status="Hired" className={cn("absolute top-3 left-3", !isActive && "max-md:hidden")} />

              <span
                className={cn(
                  "absolute inset-x-4 bottom-4 flex items-center gap-3 transition-[opacity,translate] duration-400 ease-out md:inset-x-5 md:bottom-5",
                  isActive
                    ? "translate-x-0 opacity-100"
                    : "max-md:top-1/2 max-md:bottom-auto max-md:-translate-y-1/2 md:-translate-x-3.5 md:opacity-0",
                )}
              >
                <span aria-hidden="true" className={cn("h-7 w-1 shrink-0 rounded-pill bg-accent", !isActive && "max-md:hidden")} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-xl font-bold text-ink-inverse md:text-2xl">
                    {pet.name}
                  </span>
                  <span className={cn("block text-sm text-blue-100", !isActive && "max-md:sr-only")}>
                    Hired in <time dateTime={pet.hired_at}>{month}</time>
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

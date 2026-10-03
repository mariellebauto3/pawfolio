import { cn } from "@/lib/utils/cn";
import { PawMark } from "./landing-illustrations";

/** Prints in one copy of the loop, 5 rem apart: 32 × 80 px = 2560 px, wider than the widest screen we plan for. */
const PRINTS_PER_LOOP = 32;

type Props = {
  /** Must position the trail (`absolute …`). */
  className: string;
};

// The hero's paw trail (AU-01): left and right prints walking to the right without end, like a logo marquee
// (reactbits.dev "Logo Loop"). The track holds the prints twice and slides by one copy, so the loop has no seam; the
// edges fade out. It pauses while the pointer is over it, and stands still with reduced motion. Decorative only.
export function PawTrail({ className }: Props) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div className="flex w-max animate-paw-loop hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex">
            {Array.from({ length: PRINTS_PER_LOOP }, (_, index) => (
              <span key={index} className="flex h-10 w-20 items-start justify-center">
                <PawMark
                  className={cn(
                    "size-5 rotate-90 fill-blue-300 md:size-6",
                    // Left and right feet: every other print sits lower, as a dog walks.
                    index % 2 === 1 && "translate-y-4",
                  )}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

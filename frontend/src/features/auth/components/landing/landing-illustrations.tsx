import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// Small decorative drawings for the landing page (AU-01), drawn in the brand ramps (blue, yellow, gray), which the
// HiFi rules keep for illustrations. All are decorative: screen readers skip them.

type ArtProps = { className?: string };

function Art({ viewBox, className, style, children }: ArtProps & { viewBox: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox={viewBox} className={className} style={style}>
      {children}
    </svg>
  );
}

/**
 * An organic blob for the hero's backdrop: a soft bulge at the top, a gentle wave down its left side and a rounded
 * bottom. Colour it with a fill-* class. On wide screens the hero clips its bottom so it seems to run off the edge;
 * on phones, where text follows the dog, its rounded bottom shows. 300 × 300.
 */
export function Blob({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 300 300" className={className}>
      <path d="M128 8c46-12 104 6 136 46 30 38 36 96 36 150 0 56-40 92-104 96-60 4-120 6-160-20-34-22-36-56-24-86 14-34 40-44 38-84-2-44 26-92 78-104Z" />
    </Art>
  );
}

/** A four-pointed sparkle. */
export function Sparkle({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 24 24" className={cn("fill-yellow-400", className)}>
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12C7 11 11 7 12 0Z" />
    </Art>
  );
}

/** A filled paw print; colour it with a fill-* class. */
export function PawMark({ className, style }: ArtProps & { style?: CSSProperties }) {
  return (
    <Art viewBox="0 0 24 24" className={className} style={style}>
      <PawPath />
    </Art>
  );
}

/* ---------- How it works (one picture per step, 120 × 90) ---------- */

/** Step 1: a resume with the pet's photo and a gold star sticker. */
export function ResumeArt({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 120 90" className={className}>
      <g transform="rotate(-6 60 45)">
        <rect x="32" y="10" width="56" height="72" rx="6" className="fill-surface stroke-blue-200" strokeWidth="2" />
        <circle cx="60" cy="30" r="11" className="fill-blue-100" />
        <g transform="translate(52 22) scale(0.66)" className="fill-blue-600">
          <PawPath />
        </g>
        <rect x="42" y="48" width="36" height="5" rx="2.5" className="fill-blue-600" />
        <rect x="42" y="58" width="30" height="4" rx="2" className="fill-blue-200" />
        <rect x="42" y="66" width="34" height="4" rx="2" className="fill-blue-200" />
      </g>
      <path d="M90 14c.7 5 3.3 7.6 8.3 8.3-5 .7-7.6 3.3-8.3 8.3-.7-5-3.3-7.6-8.3-8.3 5-.7 7.6-3.3 8.3-8.3Z" className="fill-yellow-400" />
    </Art>
  );
}

/** Step 2: a match card with a heart and a yellow match meter. */
export function MatchArt({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 120 90" className={className}>
      <rect x="22" y="16" width="76" height="58" rx="8" className="fill-surface stroke-blue-200" strokeWidth="2" />
      <path
        d="M60 50c-9-7-14-11-14-17a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 6-5 10-14 17Z"
        className="fill-blue-600"
      />
      <rect x="34" y="58" width="52" height="7" rx="3.5" className="fill-blue-100" />
      <rect x="34" y="58" width="44" height="7" rx="3.5" className="fill-yellow-400 stroke-yellow-600" strokeWidth="1" />
      <circle cx="96" cy="20" r="9" className="fill-yellow-400" />
      <path d="m92 20 3 3 5-6" className="fill-none stroke-gray-900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Art>
  );
}

/** Step 3: a calendar with the Meet & Greet day marked by a paw. */
export function MeetArt({ className }: ArtProps) {
  const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return (
    <Art viewBox="0 0 120 90" className={className}>
      <rect x="28" y="14" width="64" height="62" rx="7" className="fill-surface stroke-blue-200" strokeWidth="2" />
      <path d="M28 21a7 7 0 0 1 7-7h50a7 7 0 0 1 7 7v7H28Z" className="fill-blue-600" />
      <rect x="40" y="8" width="5" height="12" rx="2.5" className="fill-blue-800" />
      <rect x="75" y="8" width="5" height="12" rx="2.5" className="fill-blue-800" />
      {days.map((day) => (
        <circle key={day} cx={40 + (day % 4) * 13.3} cy={40 + Math.floor(day / 4) * 12} r="3" className="fill-blue-100" />
      ))}
      <circle cx="66.6" cy="52" r="8" className="fill-blue-600" />
      <g transform="translate(61.4 46.6) scale(0.44)" className="fill-surface">
        <PawPath />
      </g>
    </Art>
  );
}

/** Step 4 and the trust band: the yellow Hired ID card on its lanyard, as the hero dog wears it. */
export function HiredCardArt({ className }: ArtProps) {
  return (
    <Art viewBox="0 0 120 90" className={className}>
      <path d="M40 0 58 34M80 0 62 34" className="fill-none stroke-blue-700" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 0 58 34M80 0 62 34" className="fill-none stroke-blue-300" strokeWidth="1" strokeDasharray="3 3" />
      <rect x="55" y="32" width="10" height="7" rx="1.5" className="fill-gray-200 stroke-gray-500" strokeWidth="1" />
      <g transform="rotate(-5 60 62)">
        <rect x="40" y="38" width="40" height="50" rx="5" className="fill-yellow-400 stroke-yellow-600" strokeWidth="2" />
        <rect x="53" y="42" width="14" height="3" rx="1.5" className="fill-yellow-200" />
        <path d="m52 62 6 6 11-12" className="fill-none stroke-gray-900" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Art>
  );
}

function PawPath() {
  return (
    <>
      <ellipse cx="4.6" cy="10.4" rx="2.2" ry="2.8" transform="rotate(-24 4.6 10.4)" />
      <ellipse cx="9.1" cy="5.2" rx="2.3" ry="3" transform="rotate(-8 9.1 5.2)" />
      <ellipse cx="14.9" cy="5.2" rx="2.3" ry="3" transform="rotate(8 14.9 5.2)" />
      <ellipse cx="19.4" cy="10.4" rx="2.2" ry="2.8" transform="rotate(24 19.4 10.4)" />
      <path d="M12 11.2c3.6 0 6.6 3.4 6.6 6.4 0 2.4-2 3.6-3.9 3.6-1.1 0-1.7-.5-2.7-.5s-1.6.5-2.7.5c-1.9 0-3.9-1.2-3.9-3.6 0-3 3-6.4 6.6-6.4Z" />
    </>
  );
}

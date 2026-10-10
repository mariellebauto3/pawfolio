import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type TilesProps = {
  /** What the numbers are about: "Your resume in numbers". Read by screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
};

// A row of stat tiles (KPIs): two across on phones, four from `lg`. One list of terms and values, so a screen
// reader reads each number with what it counts.
export function StatTiles({ label, className, children }: TilesProps) {
  return (
    <dl aria-label={label} className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", className)}>
      {children}
    </dl>
  );
}

type TileProps = {
  /** What is counted: "Profile views". */
  label: string;
  /** The number, already written: "148", "23.5". */
  value: ReactNode;
  /** What the number doesn't say on its own: "+32 this week", or a link to where it leads. */
  note?: ReactNode;
  className?: string;
};

// One number with its name (LoFi UI kit, "Stat tile"; AN-01…AN-03). The number is the loudest thing on the tile;
// the label and the note stay quiet. Inside <StatTiles>.
export function StatTile({ label, value, note, className }: TileProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface p-4 md:p-5", className)}>
      <dt className="text-sm font-bold text-ink-muted">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="font-display text-4xl leading-none font-bold tabular-nums">{value}</span>
        {note && <span className="text-sm text-ink-muted">{note}</span>}
      </dd>
    </div>
  );
}

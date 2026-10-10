import { cn } from "@/lib/utils/cn";
import { type Bar, niceMax } from "../schemas/stats";
import { BAR_FILLS } from "./bar-list";

type Props = {
  /** What the columns count: "Adoptions per month". Read by screen readers. */
  label: string;
  /** What one unit is, for screen readers: "adoption" reads "Oct: 3 adoptions". */
  unit: string;
  columns: Bar[];
  className?: string;
};

// Counts in an order that matters (months, score bands), as columns standing on one baseline with each value
// written above its column. The columns touch, so their bottom edges make one unbroken baseline. A list, so a screen
// reader reads "Oct: 3 adoptions" in order.
export function ColumnChart({ label, unit, columns, className }: Props) {
  const top = niceMax(columns.map((column) => column.value));

  return (
    <ol aria-label={label} className={cn("grid h-48 items-end", className)} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((column) => (
        <li key={column.id} className="flex h-full min-w-0 flex-col items-center gap-1">
          <span className="sr-only">
            {column.label}: {column.value} {column.value === 1 ? unit : `${unit}s`}
          </span>
          <span aria-hidden="true" className="flex w-full flex-1 flex-col items-center justify-end gap-1 border-b border-line-strong px-1 md:px-1.5">
            <span className="text-sm font-bold tabular-nums">{column.value}</span>
            {/* The value's own line (1.5rem) is taken off the height, so the tallest column never pushes it out. */}
            {column.value > 0 && <span className={cn("min-h-1 w-full max-w-10 rounded-t-badge", BAR_FILLS[column.tone ?? "primary"])} style={{ height: `calc((100% - 1.5rem) * ${column.value / top})` }} />}
          </span>
          <span aria-hidden="true" className="text-center text-xs text-ink-muted">
            {column.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

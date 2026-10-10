import { cn } from "@/lib/utils/cn";
import type { Bar, BarTone } from "../schemas/stats";

type Props = {
  /** What the bars compare: "Views by where they came from". Read by screen readers. */
  label: string;
  bars: Bar[];
  className?: string;
};

export const BAR_FILLS: Record<BarTone, string> = {
  primary: "bg-primary",
  // Yellow is a fill with an edge, never on its own against white (HiFi rule 4).
  accent: "border border-accent-edge bg-accent",
  muted: "bg-ink-subtle",
};

// A few counts side by side, as bars from one baseline with every value written at its end, so the bar is never the
// only carrier of the number. A list, so a screen reader reads "Search: 12" row by row.
export function BarList({ label, bars, className }: Props) {
  const largest = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <ul aria-label={label} className={cn("flex flex-col gap-3", className)}>
      {bars.map((bar) => (
        <li key={bar.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
          <span className="text-sm md:order-1">{bar.label}</span>
          <span className="min-w-[3ch] text-right text-sm font-bold tabular-nums md:order-3">{bar.value}</span>
          <span aria-hidden="true" className="col-span-2 block h-3 rounded-badge bg-surface-sunken md:order-2 md:col-span-1">
            {bar.value > 0 && <span className={cn("block h-full min-w-1 rounded-badge", BAR_FILLS[bar.tone ?? "primary"])} style={{ width: `${(bar.value / largest) * 100}%` }} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

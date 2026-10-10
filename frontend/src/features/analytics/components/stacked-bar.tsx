import { cn } from "@/lib/utils/cn";

type Segment = { id: string; label: string; value: number };

type Props = {
  /** What the whole bar is: "Accounts by status". Read by screen readers. */
  label: string;
  /** Largest first reads best; five at most, one fill each. */
  segments: Segment[];
  className?: string;
};

// From the one that matters most (blue) down to what is over (grays). The list beside the bar names every part
// with its count, so a sliver too thin to see is still read.
const FILLS = ["bg-blue-600", "bg-blue-300", "bg-gray-500", "bg-gray-700", "bg-gray-300"];

// Parts of one whole (AN-03, accounts by status): one bar split by share, with a gap between the parts, and a list
// that carries every label and count. The bar is decoration for a screen reader; the list is the data.
export function StackedBar({ label, segments, className }: Props) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div aria-hidden="true" className="flex h-6 gap-0.5 overflow-hidden rounded-badge bg-surface-sunken">
        {segments.map(
          (segment, index) => segment.value > 0 && <span key={segment.id} className={cn("h-full min-w-1", FILLS[index % FILLS.length])} style={{ width: `${(segment.value / Math.max(total, 1)) * 100}%` }} />,
        )}
      </div>
      <ul aria-label={label} className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {segments.map((segment, index) => (
          <li key={segment.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-badge", FILLS[index % FILLS.length])} />
              {segment.label}
            </span>
            <span className="font-bold tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { cn } from "@/lib/utils/cn";

type Props = {
  value: number;
  max?: number;
  /** What is measured, for screen readers: "Match with Ana Santos", "Activity level". */
  label: string;
  /**
   * `lg`: the match score on a match card or profile, a big number over the bar.
   * `sm`: a row in the match breakdown, the bar with the value at its end.
   */
  size?: "sm" | "lg";
  /** `match` fills yellow (good news, HiFi rule 4). `neutral` fills blue, for counts that aren't a match. */
  tone?: "match" | "neutral";
  /** `percent` shows "86%"; `fraction` shows "12 / 15" (breakdown points). */
  format?: "percent" | "fraction";
  /** Word after the big number on `lg`. Default "match". */
  unit?: string;
  className?: string;
};

// Match % (MT-02, MT-03). The value is always written out, so the bar is never the only carrier of meaning.
export function Meter({
  value,
  max = 100,
  label,
  size = "lg",
  tone = "match",
  format = "percent",
  unit = "match",
  className,
}: Props) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const text = format === "fraction" ? `${clamped} / ${max}` : `${percent}%`;
  const valueText = size === "lg" ? `${text} ${unit}` : text;

  const bar = (
    <span className={cn("block overflow-hidden rounded-pill bg-surface-sunken", size === "lg" ? "h-3" : "h-2")}>
      <span
        className={cn(
          "block h-full rounded-pill",
          tone === "match" ? "border border-accent-edge bg-accent" : "bg-primary",
          percent === 0 && "border-0",
        )}
        style={{ width: `${percent}%` }}
      />
    </span>
  );

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      className={cn(
        size === "lg" ? "flex flex-col gap-2" : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
        className,
      )}
    >
      {size === "lg" ? (
        <>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-4xl leading-none font-bold tabular-nums">{text}</span>
            <span className="text-sm font-bold text-ink-muted">{unit}</span>
          </span>
          {bar}
        </>
      ) : (
        <>
          {bar}
          <span className="min-w-[4.5ch] text-right text-sm font-bold tabular-nums">{text}</span>
        </>
      )}
    </div>
  );
}

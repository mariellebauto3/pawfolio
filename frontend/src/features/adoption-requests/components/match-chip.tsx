type Props = {
  /** The match, 0 to 100. Nothing shows when there isn't a real number. */
  score?: number;
};

// The match between a pet and a home, beside an invite: the same yellow as the tab on a match card, the one place
// yellow is used on these screens (HiFi rule 4), and always written out as "86% match".
export function MatchChip({ score }: Props) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;

  return (
    <p className="flex shrink-0 items-baseline gap-1 rounded-control border border-accent-edge bg-accent px-2.5 py-1 text-accent-ink">
      <span className="font-display text-xl leading-none font-bold tabular-nums">{Math.round(score)}%</span>
      <span className="text-xs font-bold">match</span>
    </p>
  );
}

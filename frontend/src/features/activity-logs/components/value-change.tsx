import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";
import { valueLabel, valueStatus } from "../schemas/activity-logs";

type Props = {
  before: string | null;
  after: string | null;
  className?: string;
};

function Value({ value }: { value: string }) {
  const status = valueStatus(value);
  // A status wears its badge; anything else is what was kept, as text (a name, a number, a person's own words).
  return status ? <StatusBadge status={status} /> : <span className="wrap-break-word">{valueLabel(value)}</span>;
}

// What a change went from and to ("Looking for a Home" to "In Process"), read from the log and never set here
// (FR27). Nothing is drawn for an entry that changed no value.
export function ValueChange({ before, after, className }: Props) {
  if (!before && !after) return null;

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5 text-sm font-normal", className)}>
      {before && <Value value={before} />}
      {before && after && (
        <>
          <Icon name="chevron-right" aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
          <span className="sr-only">to</span>
        </>
      )}
      {after && <Value value={after} />}
    </span>
  );
}

import { cn } from "@/lib/utils/cn";
import { formatMeetingTime, meetingTimeParts } from "@/lib/utils/format-date";

type Props = {
  /** When the slot starts, as the API sends it. Shown in Philippine time. */
  at: string;
  /**
   * How settled the day is, in the language of the status badges: `open` a plain outline, `pending` a dashed one
   * (booked, waiting for the human), `confirmed` the yellow fill that good news gets.
   */
  tone?: "open" | "pending" | "confirmed";
  className?: string;
};

const TONES = {
  open: "border-[1.5px] border-line bg-surface text-ink",
  pending: "border-[1.5px] border-dashed border-line-strong bg-surface text-ink",
  confirmed: "border-[1.5px] border-accent-edge bg-accent text-accent-ink",
};

// The day of a Meet & Greet as a leaf torn off a calendar: weekday, day, month. It marks every slot and meeting, so
// the day is found at a glance wherever one is shown. The parts are decoration for the eye; the whole date and time
// is read out once.
export function DateLeaf({ at, tone = "open", className }: Props) {
  const parts = meetingTimeParts(at);
  if (!parts) return null;

  return (
    <time dateTime={at} className={cn("flex w-14 shrink-0 flex-col items-center rounded-control py-1.5 leading-none", TONES[tone], className)}>
      <span className="sr-only">{formatMeetingTime(at)}</span>
      <span aria-hidden="true" className="text-xs font-bold">
        {parts.weekday}
      </span>
      <span aria-hidden="true" className="font-display text-2xl font-bold">
        {parts.day}
      </span>
      <span aria-hidden="true" className="text-xs">
        {parts.month}
      </span>
    </time>
  );
}

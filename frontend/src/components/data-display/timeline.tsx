import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { type BadgeTone, STATUS_TONES, type StatusName } from "@/constants/status-badges";
import { cn } from "@/lib/utils/cn";

export type TimelineEvent = {
  id: string | number;
  /** What happened, in plain words: "Approved by Ana Santos". */
  title: ReactNode;
  /** Display date, already formatted for the user: "Sep 24, 2026, 3:10 PM". */
  when: string;
  /** Machine-readable date (ISO 8601) for the <time> element. */
  dateTime?: string;
  description?: ReactNode;
  /** The status this event moved the request to. Shows the badge and sets the dot's shape. */
  status?: StatusName;
  /** Dot shape without a status badge. Ignored when `status` is set. */
  tone?: BadgeTone;
  /** A step that hasn't happened yet, e.g. "Decision due Oct 8". */
  upcoming?: boolean;
};

// The dots follow the badge language: hollow = still moving (like the outlined badges), solid yellow = Adopted,
// solid blue = someone must act, solid dark gray = closed. Plain events are a blue ring; steps still to come are
// dotted. (A dashed 16 px ring reads as a loading spinner, so "moving" is a plain gray ring here.)
// The badge or title always says it in words too.
const DOTS: Record<BadgeTone | "event" | "upcoming", string> = {
  event: "border-2 border-primary bg-surface",
  progress: "border-2 border-line-strong bg-surface",
  celebrate: "border-2 border-accent-edge bg-accent",
  attention: "border-2 border-primary bg-primary",
  closed: "border-2 border-surface-inverse bg-surface-inverse",
  upcoming: "border-2 border-dotted border-line-strong bg-canvas",
};

type Props = {
  events: TimelineEvent[];
  /** Name of the list for screen readers: "Request history". */
  label?: string;
  className?: string;
};

// History of a request or adoption (RQ, AL, admin request detail), oldest first.
export function Timeline({ events, label = "History", className }: Props) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {events.map((event) => {
        const tone = event.upcoming ? "upcoming" : event.status ? STATUS_TONES[event.status] : (event.tone ?? "event");
        return (
          <li
            key={event.id}
            className={cn(
              "relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0",
              // The line joining this dot to the next one.
              "before:absolute before:top-6 before:bottom-1 before:left-[calc(0.5rem-1px)] before:w-0.5 before:bg-line",
              "last:before:hidden",
            )}
          >
            <span aria-hidden="true" className={cn("mt-1 size-4 rounded-pill", DOTS[tone])} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={cn("font-bold", event.upcoming && "text-ink-muted")}>{event.title}</p>
                {event.status && <StatusBadge status={event.status} />}
              </div>
              <time dateTime={event.dateTime} className="text-sm text-ink-muted">
                {event.upcoming && <span className="sr-only">Upcoming: </span>}
                {event.when}
              </time>
              {event.description && <div className="max-w-[65ch] text-sm text-ink">{event.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { cn } from "@/lib/utils/cn";
import { formatNavCount } from "./nav-config";

type Props = {
  count: number | undefined;
  /** Words read after the number: "unread", "waiting". */
  noun: string;
  className?: string;
};

// Small count next to a nav item (unread alerts, queue sizes). Blue means "someone must act" (HiFi palette). The
// number is drawn for sighted users and read as a phrase, e.g. "3 unread", by screen readers.
export function NavCount({ count, noun, className }: Props) {
  const text = formatNavCount(count);
  if (!text) return null;
  return (
    <span className={cn("min-w-5 rounded-pill bg-primary px-1.5 text-center text-xs leading-5 font-bold text-primary-ink tabular-nums", className)}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">
        , {text} {noun}
      </span>
    </span>
  );
}

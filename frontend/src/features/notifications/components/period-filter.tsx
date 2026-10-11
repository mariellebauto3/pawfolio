import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { NOTIFICATION_PERIODS, type NotificationPeriod } from "../schemas/history";
import { type NotificationTab, notificationsHref } from "../schemas/tabs";

type Props = {
  /** The open tab: a period narrows that tab, and choosing one starts from its first page. */
  tab: NotificationTab;
  period: NotificationPeriod;
};

// "All · Last 7 days · Earlier" above the list (NT-02, NT-03): the way straight to older notifications, which are
// kept however long ago they arrived. Links, so each view has its own address and works without JavaScript; the
// open one is marked for screen readers as well as drawn filled.
export function PeriodFilter({ tab, period }: Props) {
  return (
    <nav aria-label="Notifications by age" className="flex flex-wrap items-center gap-2">
      {NOTIFICATION_PERIODS.map(({ id, label }) => {
        const selected = id === period;
        return (
          <Link
            key={id}
            href={notificationsHref(tab, 1, id)}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border-[1.5px] px-4 text-sm font-bold no-underline transition-colors duration-200 ease-out md:min-h-9",
              selected ? "border-primary bg-primary-soft text-primary-soft-ink" : "border-line-strong bg-surface text-ink hover:border-primary hover:bg-primary-soft",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

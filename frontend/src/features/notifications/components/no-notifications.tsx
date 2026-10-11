import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/types/statuses";
import type { NotificationPeriod } from "../schemas/history";
import { type NotificationTab, notificationsHref } from "../schemas/tabs";

const TAB_COPY: Record<Exclude<NotificationTab, "all">, { title: string; pet: string; human: string }> = {
  requests: {
    title: "No request notifications yet",
    pet: "Invites to Apply and answers to the requests you send show up here.",
    human: "New adoption requests and what happens to them show up here.",
  },
  "meet-and-greets": {
    title: "No Meet & Greet notifications yet",
    pet: "Confirmations, changes and reminders for your Meet & Greets show up here.",
    human: "Bookings, reminders and decisions that are due show up here.",
  },
  account: {
    title: "No account notifications yet",
    pet: "Messages about your account and Pawfolio announcements show up here.",
    human: "Messages about your account and Pawfolio announcements show up here.",
  },
  announcements: {
    title: "No announcements yet",
    pet: "News from the Pawfolio team shows up here as soon as it is published.",
    human: "News from the Pawfolio team shows up here as soon as it is published.",
  },
};

type Props = {
  tab: NotificationTab;
  role: Role;
  /** The age the list is narrowed to; leave out for every age. */
  period?: NotificationPeriod;
};

// A tab of the Notifications page with nothing on it (NT-02, NT-03). With no notifications at all, the way forward
// is what brings the first one: a pet applies to a home, a human invites a pet. With a period chosen, the way
// forward is the other notifications, which are still there.
export function NoNotifications({ tab, role, period = "all" }: Props) {
  if (period !== "all") {
    const earlier = period === "earlier";
    return (
      <EmptyState
        icon="bell"
        title={earlier ? "Nothing older than 7 days" : "Nothing in the last 7 days"}
        description={
          earlier
            ? "Notifications move here once they are a week old, and stay for as long as you have your account."
            : "Older notifications are kept. You’ll find them under Earlier."
        }
        action={
          <Link href={notificationsHref(tab, 1, earlier ? "all" : "earlier")} className={buttonClasses({ variant: "primary" })}>
            {earlier ? "See all notifications" : "See earlier notifications"}
          </Link>
        }
      />
    );
  }

  if (tab !== "all") {
    const copy = TAB_COPY[tab];
    return <EmptyState icon="bell" title={copy.title} description={role === "pet" ? copy.pet : copy.human} />;
  }

  return (
    <EmptyState
      icon="bell"
      title="No notifications yet"
      description={
        role === "pet"
          ? "When a human invites you to apply or answers a request, you’ll read it here."
          : "When a pet sends you a request or books a Meet & Greet, you’ll read it here."
      }
      action={
        role === "admin" ? undefined : (
          <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
            {role === "pet" ? "See Homes for You" : "See Pets for You"}
          </Link>
        )
      }
    />
  );
}

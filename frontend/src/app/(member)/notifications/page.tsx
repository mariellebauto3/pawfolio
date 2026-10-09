import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { getNotifications } from "@/features/notifications/api/notifications";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NoNotifications } from "@/features/notifications/components/no-notifications";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { NOTIFICATION_TABS, categoryForTab, notificationTabFromUrl, notificationsHref } from "@/features/notifications/schemas/tabs";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";
import { formatTimeAgo } from "@/lib/utils/format-date";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Notifications" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DESCRIPTIONS = {
  pet: "Invites, answers to your requests, Meet & Greet reminders and messages about your account.",
  human: "Requests from pets, Meet & Greets, messages about your account and announcements.",
  admin: "Messages about your account and announcements.",
} as const;

// NT-02 Notifications (human) and NT-03 (pet): everything the account was told, newest first, by tab. The tab and
// the page live in the URL (?tab=requests&page=2). The API lists only the caller's own notifications (FR15, FR31),
// and each row links to what it is about: a request, an invite, a post.
export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await requireAccount(ROUTES.notifications);
  const tab = notificationTabFromUrl(params.tab);

  const notifications = await getNotifications(await getServerApi(), { category: categoryForTab(tab), page: pageFromUrl(params.page) });
  const { meta } = notifications;
  // A page past the end, such as an address kept from when the list was longer: the last page there is now.
  if (notifications.data.length === 0 && meta.total > 0 && meta.current_page > meta.last_page) redirect(notificationsHref(tab, meta.last_page));

  const now = new Date();
  const rows = notifications.data.map((notification) => ({ notification, when: formatTimeAgo(notification.created_at, now) }));
  const list =
    meta.total === 0 ? (
      <NoNotifications tab={tab} role={account.role} />
    ) : (
      <div className="flex flex-col gap-6">
        <NotificationList rows={rows} />
        <Pagination page={meta.current_page} totalPages={meta.last_page} searchParams={params} label="Pages of notifications" />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title="Notifications"
        description={DESCRIPTIONS[account.role]}
        actions={
          // One row at every width: the header would otherwise stack the two under a long description.
          <div className="flex items-center gap-1">
            <MarkAllReadButton />
            <Link href={ROUTES.settings} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
              Settings
            </Link>
          </div>
        }
      />

      <Tabs label="Notifications" tabs={NOTIFICATION_TABS.map(({ id, label }) => ({ id, label, content: id === tab ? list : undefined }))} />

      <p className="mt-6 flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        Notifications reach you here in Pawfolio only. We don’t send emails or text messages yet.
      </p>
    </div>
  );
}

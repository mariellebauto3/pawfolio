import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { getAnnouncements } from "@/features/notifications/api/announcements";
import { AnnouncementList } from "@/features/notifications/components/announcement-list";
import { AnnouncementForm } from "@/features/notifications/forms/announcement-form";
import { ANNOUNCEMENTS_PAGE_PARAM, ANNOUNCEMENTS_PAGE_SIZE } from "@/features/notifications/schemas/announcements";
import { getServerApi } from "@/lib/api/server";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Announcements" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// NT-04 Announcements, with the Publish announcement dialog (NT-05) on it: the form on the left, what was published
// and what is scheduled on the right (below it on smaller screens). The list's page lives in the URL (?page=2). The
// API checks the admin role itself (SEC-AUTHZ-07).
export default async function AnnouncementsPage({ searchParams }: Props) {
  const params = await searchParams;
  const announcements = await getAnnouncements(await getServerApi(), pageFromUrl(params[ANNOUNCEMENTS_PAGE_PARAM]), ANNOUNCEMENTS_PAGE_SIZE);

  // A page past the end: go to the page that is the last one now.
  if (announcements.data.length === 0 && announcements.meta.total > 0 && announcements.meta.current_page > announcements.meta.last_page) {
    redirect(announcements.meta.last_page > 1 ? `${ROUTES.adminAnnouncements}?${ANNOUNCEMENTS_PAGE_PARAM}=${announcements.meta.last_page}` : ROUTES.adminAnnouncements);
  }

  const { total } = announcements.meta;

  return (
    <>
      <PageHeader title="Announcements" description="Platform-wide messages. Each one reaches its audience’s Alerts and shows beside the feed." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Card title="New announcement">
          <AnnouncementForm counts={announcements.audienceCounts} />
        </Card>
        <Card title="Past announcements" description={total > 0 ? `${total} in all, newest first. One that hasn’t gone out yet is marked Scheduled.` : undefined}>
          <AnnouncementList announcements={announcements} searchParams={params} />
        </Card>
      </div>
    </>
  );
}

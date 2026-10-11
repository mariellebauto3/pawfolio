import { Pagination } from "@/components/navigation/pagination";
import { Badge } from "@/components/ui/badge";
import { ANNOUNCEMENTS_PAGE_PARAM, announcementMeta } from "../schemas/announcements";
import type { AnnouncementPage } from "../types/announcements";

type Props = {
  announcements: AnnouncementPage;
  /** The page's own query, so the page links keep it. */
  searchParams: Record<string, string | string[] | undefined>;
};

// "Past announcements" beside the form (NT-04): what was published and what is waiting for its time, newest first,
// each with when, to whom and by which admin. Only one that hasn't gone out yet carries a badge: it is still
// moving, so it gets the outlined one. The title and the message are an admin's words, rendered as text
// (SEC-FE-01). There is nothing to press here: an announcement is never edited or deleted.
export function AnnouncementList({ announcements, searchParams }: Props) {
  if (announcements.data.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing has been announced yet. An announcement shows up here as soon as it is published or scheduled.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line">
        {announcements.data.map((announcement) => (
          <li key={announcement.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-sans text-base font-bold wrap-break-word">{announcement.title}</h3>
              {announcement.status === "scheduled" && <Badge tone="progress">Scheduled</Badge>}
            </div>
            <p className="text-sm wrap-break-word whitespace-pre-line">{announcement.message}</p>
            <p className="text-sm text-ink-muted">
              {announcement.status === "scheduled" ? "Goes out " : ""}
              {announcementMeta(announcement)}
            </p>
          </li>
        ))}
      </ul>
      <Pagination page={announcements.meta.current_page} totalPages={announcements.meta.last_page} searchParams={searchParams} param={ANNOUNCEMENTS_PAGE_PARAM} label="Pages of announcements" />
    </div>
  );
}

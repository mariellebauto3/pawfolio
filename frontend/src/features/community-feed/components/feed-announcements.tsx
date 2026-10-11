import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format-date";
import type { Announcement } from "../types/feed";

type Props = {
  /** The latest announcements for this account's role, newest first, as the feed carried them. */
  announcements: Announcement[];
  /** Show only the first few: one, above the feed on a phone, where the side rail is hidden. */
  limit?: number;
  className?: string;
};

// Announcements from the Pawfolio team, beside the feed (FD-01, FD-02). An admin wrote them, and they are still
// rendered as text only (SEC-FE-01). Nothing is shown when there are none.
export function FeedAnnouncements({ announcements, limit, className }: Props) {
  const shown = limit === undefined ? announcements : announcements.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <Card title={shown.length === 1 ? "Announcement" : "Announcements"} titleAs="h2" className={className}>
      <ul className="flex flex-col gap-4">
        {shown.map((announcement) => (
          <li key={announcement.id} className="flex flex-col gap-1">
            <h3 className="font-sans text-base font-bold wrap-break-word">{announcement.title}</h3>
            <p className="text-sm wrap-break-word whitespace-pre-line">{announcement.message}</p>
            {announcement.published_at && (
              <time dateTime={announcement.published_at} className="text-xs text-ink-muted">
                {formatDate(announcement.published_at)}
              </time>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

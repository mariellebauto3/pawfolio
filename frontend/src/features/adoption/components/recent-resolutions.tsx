import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RESOLUTION_ACTION_LABELS } from "@/constants/adoption-resolutions";
import { adminRequestPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { Resolution } from "@/types/adoption-resolution";
import { resolutionParties } from "../schemas/resolutions";

type Props = {
  /** Newest first; null when the API couldn't be asked. */
  resolutions: Resolution[] | null;
  /** How many there are in all, when there are more than the ones shown. */
  total?: number;
};

// "Recent resolutions" beside the form (AL-07): every manual change, with who made it, when and why (NFR9). The
// full trail is the activity log's; this is the short list an admin checks before changing the same pet twice. The
// reason is an admin's own words and is rendered as text (SEC-FE-01).
export function RecentResolutions({ resolutions, total }: Props) {
  return (
    <Card title="Recent resolutions" description={resolutions && total && total > resolutions.length ? `The latest ${resolutions.length} of ${total}.` : undefined}>
      {resolutions === null ? (
        <p className="text-sm text-ink-muted">We couldn’t load the recent resolutions. Reload the page to try again.</p>
      ) : resolutions.length === 0 ? (
        <p className="text-sm text-ink-muted">No status has been changed by hand yet. A change made here is listed with its reason.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {resolutions.map((resolution) => (
            <li key={resolution.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <span className="font-bold wrap-break-word">
                {RESOLUTION_ACTION_LABELS[resolution.action]}: {resolutionParties(resolution)}
              </span>
              <span className="wrap-break-word whitespace-pre-line">{resolution.reason}</span>
              <span className="flex flex-wrap gap-x-3 text-ink-muted">
                <span>
                  <time dateTime={resolution.created_at}>{formatDate(resolution.created_at)}</time>
                  {resolution.admin_name && ` by ${resolution.admin_name}`}
                </span>
                {resolution.adoption_request_id !== null && (
                  <Link href={adminRequestPath(resolution.adoption_request_id)} className="font-bold text-primary underline hover:text-primary-hover">
                    View request<span className="sr-only"> #{resolution.adoption_request_id}</span>
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

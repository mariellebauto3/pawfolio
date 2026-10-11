import Link from "next/link";
import type { ReactNode } from "react";
import { PostPhotos } from "@/components/data-display/post-photos";
import { Table, type TableColumn } from "@/components/data-display/table";
import { Alert } from "@/components/feedback/alert";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { POST_TYPE_LABELS } from "@/constants/posts";
import { ROUTES, adminAccountPath, homeProfilePath, petPath } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS, REPORT_STATUS_LABELS } from "@/constants/statuses";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import { REPORT_REASON_LABELS, TARGET_TYPE_LABELS, countReports, reportedItemName } from "../schemas/reports";
import type { ItemReport, ReportDetail, ReportedAccount } from "../types/reports";
import { ReportDecision } from "./report-decision";

type Props = {
  report: ReportDetail;
};

const BACK_LINK = "inline-flex min-h-11 items-center gap-1 font-bold text-primary underline hover:text-primary-hover md:min-h-0";

const REPORT_COLUMNS: TableColumn<ItemReport>[] = [
  { key: "reporter", header: "Reporter", rowHeader: true, cell: (item) => item.reporter_name ?? "An account that is gone" },
  { key: "reason", header: "Reason", wrap: true, cell: (item) => REPORT_REASON_LABELS[item.reason] },
  {
    key: "details",
    header: "Details",
    wrap: true,
    // The reporter's own words, as text (SEC-FE-01).
    cell: (item) => (item.details ? <span className="wrap-break-word whitespace-pre-line">“{item.details}”</span> : <span className="text-ink-muted">None given</span>),
  },
  {
    key: "when",
    header: "When",
    // An item reported again after it was resolved lists both rounds; the earlier ones say so.
    cell: (item) => (
      <span className="flex flex-col">
        <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
        {item.status === "resolved" && <span className="text-sm text-ink-muted">Resolved</span>}
      </span>
    ),
  },
];

/** Where the reported account's public profile is, while there is one to open: only an Active account's is shown. */
function publicProfilePath(account: ReportedAccount): string | null {
  if (account.status !== "active" || account.profile_id === null) return null;
  if (account.role === "pet") return petPath(account.profile_id);
  return account.role === "human" ? homeProfilePath(account.profile_id) : null;
}

/** A member's words as they wrote them: text only, with their line breaks, never made into markup or links (SEC-FE-01, SEC-FE-02). */
function Quoted({ children }: { children: ReactNode }) {
  return <p className="wrap-break-word whitespace-pre-line">{children}</p>;
}

function Removed({ what }: { what: string }) {
  return (
    <Alert tone="warning" title={`This ${what} is removed`}>
      Nobody but admins can see it. It can be restored from this page.
    </Alert>
  );
}

function ReportedContent({ report }: Props) {
  const { post, comment } = report.content_preview;
  const account = report.reported_user;
  const name = account?.display_name ?? "An account that is gone";
  const profilePath = account && publicProfilePath(account);

  if (!post && !comment) {
    // A profile or an account: there are no words to quote, so the admin is sent to what members see.
    return (
      <div className="flex flex-col gap-3">
        <p>
          {report.target_type === "profile"
            ? `Members reported ${name}’s ${account?.role === "pet" ? "resume" : "Home Profile"}: what it says and shows.`
            : `Members reported ${name}’s account: how it behaves, not one post or comment.`}
        </p>
        {profilePath ? (
          <Link href={profilePath} className={buttonClasses({ size: "sm", className: "self-start" })}>
            View public profile
          </Link>
        ) : (
          <p className="text-sm text-ink-muted">The profile is hidden: the account isn’t Active.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} alt="" size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="font-bold wrap-break-word">{name}</span>
          <span className="text-sm text-ink-muted">
            {comment ? "Comment" : post?.type ? POST_TYPE_LABELS[post.type] : "Post"}
            {(comment ?? post)?.created_at && `, ${formatDateTime((comment ?? post)?.created_at ?? "")}`}
          </span>
        </div>
      </div>

      {comment ? (
        <>
          {comment.is_removed && <Removed what="comment" />}
          <Quoted>{comment.body}</Quoted>
          {post && (
            <div className="flex flex-col gap-1 rounded-card bg-surface-sunken p-3 text-sm">
              <p className="font-bold">On this post{post.is_removed ? " (removed)" : post.is_deleted ? " (deleted by its author)" : ""}</p>
              {post.title && <p className="font-bold wrap-break-word">{post.title}</p>}
              <p className="line-clamp-4 wrap-break-word whitespace-pre-line text-ink-muted">{post.body}</p>
            </div>
          )}
        </>
      ) : (
        post && (
          <>
            {post.is_removed && <Removed what="post" />}
            {post.is_deleted && (
              <Alert tone="info" title="The author deleted this post">
                It is kept here for the record and can’t be restored.
              </Alert>
            )}
            {post.title && <h3 className="text-lg wrap-break-word">{post.title}</h3>}
            <Quoted>{post.body}</Quoted>
            {post.photos.length > 0 && (
              <div className="overflow-hidden rounded-card border border-line">
                <PostPhotos author={name} photos={post.photos} sizes="(min-width: 1280px) 640px, 100vw" />
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// Review one reported item (RP-04): what was reported and every report on it on the left, the account behind it
// and the decision on the right, and below them on smaller screens. Once resolved, the same page shows what was
// decided, and offers Restore for content that was removed. Everything members wrote is rendered as text.
export function ReportReviewScreen({ report }: Props) {
  const account = report.reported_user;
  const latest = report.sibling_reports[0]?.created_at ?? report.created_at;

  return (
    <>
      <nav aria-label="Reports" className="mb-4 text-sm">
        <Link href={report.status === "open" ? ROUTES.adminReports : `${ROUTES.adminReports}?tab=resolved`} className={BACK_LINK}>
          <Icon name="chevron-left" className="size-4 shrink-0" />
          {report.status === "open" ? "Reports" : "Resolved reports"}
        </Link>
      </nav>

      <PageHeader
        title={`Report: ${reportedItemName(report)}`}
        description={`${TARGET_TYPE_LABELS[report.target_type]}, ${countReports(report.sibling_reports.length || report.reports_count)}, latest ${formatDateTime(latest)}`}
        actions={<StatusBadge status={REPORT_STATUS_LABELS[report.status]} />}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Reported content">
            <ReportedContent report={report} />
          </Card>

          <Card title={`Reports (${report.sibling_reports.length})`} description="Every report members filed on this item, newest first.">
            <Table caption="Reports on this item" columns={REPORT_COLUMNS} rows={report.sibling_reports} rowKey={(item) => item.id} />
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-8">
          <ReportDecision key={`${report.id}-${report.status}`} report={report} />

          <Card title="Reported account">
            {account ? (
              <div className="flex flex-col gap-3">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink-muted">Account</dt>
                  <dd className="font-bold wrap-break-word">{account.display_name}</dd>
                  <dt className="text-ink-muted">Type</dt>
                  <dd>{account.role === "pet" ? "Pet" : "Human"}</dd>
                  <dt className="text-ink-muted">Status</dt>
                  <dd>
                    <StatusBadge status={ACCOUNT_STATUS_LABELS[account.status]} />
                  </dd>
                  {account.reports_against_count !== null && (
                    <>
                      <dt className="text-ink-muted">Reported</dt>
                      <dd>{account.reports_against_count === 1 ? "Once, by this report" : `${account.reports_against_count} times in all`}</dd>
                    </>
                  )}
                  {account.joined_at && (
                    <>
                      <dt className="text-ink-muted">Joined</dt>
                      <dd>
                        <time dateTime={account.joined_at}>{formatDate(account.joined_at)}</time>
                      </dd>
                    </>
                  )}
                </dl>
                <Link href={adminAccountPath(account.id)} className={buttonClasses({ size: "sm", className: "self-start" })}>
                  Open account
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">The account behind this report is gone.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { Timeline } from "@/components/data-display/timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { PET_STATUS_NAMES } from "@/constants/pets";
import { ROUTES, adminReportPath, adminVerificationReviewPath, homeProfilePath, petPath } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS, REPORT_STATUS_LABELS, REQUEST_STATUS_LABELS } from "@/constants/statuses";
import { VERIFICATION_DOCUMENT_LABELS } from "@/constants/verification";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import { activityLabel, statusHistory } from "../schemas/accounts";
import type { AccountDetail } from "../types/accounts";
import { AccountActions } from "./account-actions";
import { ChangeRequestsCard } from "./change-requests-card";

type Props = {
  account: AccountDetail;
};

const BACK_LINK = "inline-flex min-h-11 items-center gap-1 font-bold text-primary underline hover:text-primary-hover md:min-h-0";
const TEXT_LINK = "font-bold text-primary underline hover:text-primary-hover";
const TARGET_LABELS = { profile: "Profile", post: "Post", comment: "Comment", account: "Account" } as const;

function Verification({ account }: Props) {
  const { verification } = account;
  if (!verification) return <p className="text-sm text-ink-muted">Nothing was submitted for verification.</p>;

  const by = verification.reviewed_by ? ` by ${verification.reviewed_by}` : "";
  const outcome =
    verification.status === "pending"
      ? `Waiting for review${verification.submitted_at ? ` since ${formatDate(verification.submitted_at)}` : ""}`
      : `${verification.status === "approved" ? "Approved" : "Denied"}${verification.reviewed_at ? ` ${formatDate(verification.reviewed_at)}` : ""}${by}`;
  const documents = verification.documents.map((document) => (VERIFICATION_DOCUMENT_LABELS as Record<string, string>)[document.type] ?? "Document");

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Review</dt>
        <dd>{outcome}</dd>
        <dt className="text-ink-muted">Documents</dt>
        <dd>{documents.length > 0 ? documents.join(", ") : "None"}</dd>
      </dl>
      {/* The files themselves are opened on the review page, from memory (SEC-PRIV-01, SEC-FE-09). */}
      <Link href={adminVerificationReviewPath(account.id)} className={buttonClasses({ size: "sm", className: "self-start" })}>
        Open verification review
      </Link>
    </div>
  );
}

// Everything about one account, and the actions on it (AC-07): its status and what can be done about it at the
// top, then its history and requests on the left, and what an admin is asked to decide or may want to check on the
// right. Contact numbers and addresses aren't part of this page (SEC-PRIV-02). Everything an owner wrote is
// rendered as text (SEC-FE-01).
export function AccountDetailScreen({ account }: Props) {
  const isPet = account.role === "pet";
  const city = account.pet?.city ?? account.home_profile?.city;
  const profilePath = account.status === "active" && account.profile_id !== null ? (isPet ? petPath(account.profile_id) : homeProfilePath(account.profile_id)) : null;
  const suspension = account.status === "suspended" ? (account.account_actions.find((action) => action.action === "suspend") ?? null) : null;
  const history = statusHistory(account);
  const { reports_against: reports } = account;

  return (
    <>
      <nav aria-label="Accounts" className="mb-4 text-sm">
        <Link href={ROUTES.adminAccounts} className={BACK_LINK}>
          <Icon name="chevron-left" className="size-4 shrink-0" />
          Accounts
        </Link>
      </nav>

      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <Avatar name={account.display_name} src={account.avatar_url ?? undefined} alt="" size="lg" />
            <span className="min-w-0 wrap-break-word">{account.display_name}</span>
          </span>
        }
        description={
          <span className="flex flex-col gap-2">
            <span>{[isPet ? "Pet account" : "Human account", city, account.caretaker_name && `caretaker ${account.caretaker_name}`, account.email].filter(Boolean).join(", ")}</span>
            <span className="flex flex-wrap gap-2">
              <StatusBadge status={ACCOUNT_STATUS_LABELS[account.status]} />
              {account.pet?.status && <StatusBadge status={PET_STATUS_NAMES[account.pet.status]} />}
              {account.home_profile?.is_furparent && <StatusBadge status="Furparent" />}
            </span>
          </span>
        }
        actions={
          <>
            {profilePath && (
              <Link href={profilePath} className={buttonClasses({ size: "sm" })}>
                View public profile
              </Link>
            )}
            <AccountActions key={account.status} account={account} suspension={suspension} />
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Status history">
            <Timeline
              label={`Status history of ${account.display_name}`}
              events={history.map((event) => ({ id: event.id, title: event.title, when: formatDateTime(event.when), dateTime: event.when, status: event.status, description: event.description }))}
            />
          </Card>

          <Card title={isPet ? "Adoption requests" : "Requests received"} description={account.requests.length > 0 ? "The latest ten, newest first." : undefined}>
            {account.requests.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {account.requests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
                    <span className="wrap-break-word">
                      {request.pet_name ?? "A pet"} to {request.home_name ?? "a home"}
                      <span className="text-ink-muted">
                        , sent <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
                      </span>
                    </span>
                    <StatusBadge status={REQUEST_STATUS_LABELS[request.status]} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{isPet ? "This pet hasn’t sent a request yet." : "No pet has sent this home a request yet."}</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ChangeRequestsCard ownerName={account.display_name} requests={account.detail_change_requests} />

          <Card title="Verification">
            <Verification account={account} />
          </Card>

          <Card title="Reports against this account">
            {reports.total === 0 ? (
              <p className="text-sm text-ink-muted">None.</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <p>
                  {reports.total} {reports.total === 1 ? "report" : "reports"}, {reports.open} open
                </p>
                <ul className="flex flex-col gap-2">
                  {reports.latest.map((report) => (
                    <li key={report.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link href={adminReportPath(report.id)} className={TEXT_LINK}>
                        {TARGET_LABELS[report.target_type]}, <time dateTime={report.created_at}>{formatDate(report.created_at)}</time>
                      </Link>
                      <StatusBadge status={REPORT_STATUS_LABELS[report.status]} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Recent activity">
            <div className="flex flex-col gap-3 text-sm">
              {account.recent_activity.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {account.recent_activity.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap justify-between gap-x-4">
                      <span>{activityLabel(entry)}</span>
                      <time dateTime={entry.created_at} className="text-ink-muted">
                        {formatDateTime(entry.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">Nothing logged yet.</p>
              )}
              <Link href={ROUTES.adminActivityLogs} className={`${TEXT_LINK} self-start`}>
                Full activity log
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

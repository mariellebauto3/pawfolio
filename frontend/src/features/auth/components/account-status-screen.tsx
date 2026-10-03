import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon, type IconName } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { HELP_CENTER_PATH, ROUTES } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS } from "@/constants/statuses";
import { canEditSubmission, summarizeDocuments } from "@/lib/auth/account-status";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Account } from "@/types/account";
import type { AccountStatusInfo } from "@/types/account-status";
import type { AccountStatus } from "@/types/statuses";
import { AdminReason } from "./admin-reason";

type Props = {
  account: Account;
  info: AccountStatusInfo;
};

type Screen = { icon: IconName; title: string; body: string };

// Copy from the LoFi (AU-18, AU-20, AU-21) and proposal §5.1. An account closed while signed in gets the last one.
const SCREENS: Record<Exclude<AccountStatus, "active">, Screen> = {
  pending_verification: {
    icon: "clock",
    title: "Your account is pending approval",
    body: "An admin is reviewing your details. This usually takes 1 to 2 days. You can't browse, post, send or receive anything until you're approved.",
  },
  denied: {
    icon: "circle-x",
    title: "Your account wasn't approved",
    body: "Correct your details and resubmit. Your account goes back to Pending Verification.",
  },
  suspended: {
    icon: "ban",
    title: "Your account is suspended",
    body: "Your profile is hidden from everyone. Only an admin can reactivate it. If you think this is a mistake, contact support.",
  },
  deactivated: {
    icon: "lock",
    title: "This account was closed",
    body: "Your profile is hidden, and you can't browse, post, send or receive anything. Records are kept for adoption history. To restore the account, contact support.",
  },
};

const ROW_LABEL = "text-sm text-ink-muted md:pt-0.5";
const ROW_VALUE = "-mt-1.5 break-words md:mt-0";

// The only screen an account that isn't Active can use (FR2, FR19, NFR2): what its status is, why, and the one
// thing its owner can do about it. The API blocks everything else on its own; nothing here unlocks a feature.
export function AccountStatusScreen({ account, info }: Props) {
  if (info.status === "active") return null;

  const { icon, title, body } = SCREENS[info.status];
  const pending = info.status === "pending_verification";
  const canEdit = canEditSubmission({ role: account.role, status: info.status });
  const documents = summarizeDocuments(info.documents);

  return (
    <section
      aria-labelledby="account-status-title"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-dialog border border-line bg-surface p-6 text-center md:p-8"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-20 place-items-center rounded-pill",
          pending ? "bg-primary-soft text-primary" : "bg-surface-sunken text-ink-muted",
        )}
      >
        <Icon name={icon} className="size-9" />
      </span>

      <div className="flex flex-col items-center gap-3">
        <StatusBadge status={ACCOUNT_STATUS_LABELS[info.status]} />
        <h1 id="account-status-title" className="text-2xl md:text-3xl">
          {title}
        </h1>
        <p className="max-w-[65ch] text-ink-muted">{body}</p>
      </div>

      {(info.status === "denied" || info.status === "suspended") && <AdminReason info={info} className="w-full text-left" />}

      {pending && (
        <dl className="grid w-full gap-x-6 gap-y-2 rounded-card border border-line p-4 text-left md:grid-cols-[8rem_1fr]">
          <dt className={ROW_LABEL}>Account</dt>
          <dd className={ROW_VALUE}>
            {account.role === "pet" ? "Pet" : "Human"} · {account.display_name}
          </dd>
          {info.submitted_at && (
            <>
              <dt className={ROW_LABEL}>{info.is_resubmission ? "Resubmitted" : "Submitted"}</dt>
              <dd className={ROW_VALUE}>
                <time dateTime={info.submitted_at}>{formatDateTime(info.submitted_at)}</time>
              </dd>
            </>
          )}
          {documents.length > 0 && (
            <>
              <dt className={ROW_LABEL}>Documents</dt>
              <dd className={ROW_VALUE}>
                <ul className="flex flex-col gap-1">
                  {documents.map((document) => (
                    <li key={document} className="flex items-center gap-2">
                      <Icon name="circle-check" className="size-4 shrink-0 text-primary" />
                      {document}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {canEdit ? (
          <Link href={ROUTES.accountEdit} className={buttonClasses({ variant: pending ? "secondary" : "primary" })}>
            {pending ? "Edit submitted details" : "Correct and resubmit"}
          </Link>
        ) : (
          // No support channel exists yet: the Help center link is the same one the bar above shows.
          <Link href={HELP_CENTER_PATH} className={buttonClasses({ variant: "secondary" })}>
            Contact support
          </Link>
        )}
      </div>
    </section>
  );
}

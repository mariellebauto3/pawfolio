import Link from "next/link";
import type { ReactNode } from "react";
import { Timeline } from "@/components/data-display/timeline";
import { Alert } from "@/components/feedback/alert";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { slotPlaceKind } from "@/constants/meet-and-greet";
import { PET_STATUS_NAMES } from "@/constants/pets";
import { ROUTES, adminAccountPath, adminResolvePath } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS } from "@/constants/statuses";
import { formatDateTime } from "@/lib/utils/format-date";
import type { AccountStatus } from "@/types/statuses";
import { adminRequestTimeline, meetingLines, noReminderLine, overdueNote, reminderSideName, waitingOnLine } from "../schemas/admin-requests";
import type { MonitoredRequestDetail } from "../types/admin-requests";
import { RequestLetter } from "./request-content";
import { RequestHeader } from "./request-header";
import { SendReminderButton } from "./send-reminder-button";

type Props = {
  request: MonitoredRequestDetail;
};

const BACK_LINK = "inline-flex min-h-11 items-center gap-1 font-bold text-primary underline hover:text-primary-hover md:min-h-0";
const FACTS = "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm";

type PartyProps = {
  name: string;
  photo: string | null;
  /** "Pet" or "Human". */
  kind: string;
  email: string | null;
  accountId: number | null;
  accountStatus: AccountStatus | null;
  /** The pet's adoption status, or the human's Furparent label. */
  badge?: ReactNode;
};

function Party({ name, photo, kind, email, accountId, accountStatus, badge }: PartyProps) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      {/* The name is written beside it, so the photo isn't read out as well. */}
      <Avatar name={name} src={photo ?? undefined} alt="" size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold wrap-break-word">{name}</span>
        <span className="text-sm text-ink-muted">{kind}</span>
        {email && <span className="text-sm break-all text-ink-muted">{email}</span>}
        <span className="flex flex-wrap gap-1">
          {badge}
          {/* An Active account is the rule; any other status is why a request may be stuck. */}
          {accountStatus && accountStatus !== "active" && <StatusBadge status={ACCOUNT_STATUS_LABELS[accountStatus]} />}
        </span>
      </div>
      {accountId !== null && (
        <Link href={adminAccountPath(accountId)} className={buttonClasses({ size: "sm", className: "shrink-0" })}>
          Account<span className="sr-only">: {name}</span>
        </Link>
      )}
    </li>
  );
}

// One request's record as an admin reads it (RQ-19, FR36): where it stands and who it waits on first, then its
// timeline and the cover letter, the two accounts and the Meet & Greet. Read-only: the status is the system's
// (FR27), a reminder nudges whoever has the next step, and anything that needs fixing goes through Resolve adoption
// issue (AL-07). No phone number or address is on this page (SEC-PRIV-02), and what a pet or a human wrote is
// rendered as text (SEC-FE-01). There is no request thread to read (ui-guidelines §6).
export function AdminRequestScreen({ request }: Props) {
  const { pet, home_profile: home, parties, reminder, meeting } = request;
  const events = adminRequestTimeline(request).map(({ at, ...event }) => ({ ...event, when: formatDateTime(at), dateTime: at }));
  const waiting = waitingOnLine(request);
  const lines = meetingLines(request);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Requests" className="text-sm">
        <Link href={request.is_overdue ? `${ROUTES.adminRequests}?tab=overdue` : ROUTES.adminRequests} className={BACK_LINK}>
          <Icon name="chevron-left" className="size-4 shrink-0" />
          {request.is_overdue ? "Overdue decisions" : "Requests & Meet & Greets"}
        </Link>
      </nav>

      <RequestHeader request={request} title={`${pet.name} to ${home.full_name}`} facts={`Request #${request.id}`} />

      {/* The follow-up card is first in the page's order, so a phone, a keyboard and a screen reader reach it before
          the timeline; from xl it sits beside it. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-1">
          <Card title="Follow up">
            {request.is_overdue && (
              <Alert tone="warning" title="Overdue for a decision">
                {[overdueNote(request), `Remind ${home.full_name}, or resolve it if they can’t decide.`].filter(Boolean).join(". ")}
              </Alert>
            )}
            <p className="text-sm">{waiting ?? noReminderLine(request)}</p>
            {waiting && !reminder.can_send && <p className="text-sm text-ink-muted">{noReminderLine(request)}</p>}
            {reminder.last_sent_at && (
              <p className="text-sm text-ink-muted">
                Last reminder sent <time dateTime={reminder.last_sent_at}>{formatDateTime(reminder.last_sent_at)}</time>.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {reminder.can_send && reminder.waiting_on && <SendReminderButton requestId={request.id} recipientName={reminderSideName(reminder.waiting_on, request)} />}
              <Link href={adminResolvePath(pet.id, request.id)} className={buttonClasses({ size: "sm", variant: "primary" })}>
                Resolve issue
              </Link>
            </div>
            <p className="text-sm text-ink-muted">Resolving is the only way to change a status by hand. It needs a reason and is logged.</p>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Card title="Timeline" description="What happened to this request, oldest first.">
            {events.length > 0 ? <Timeline label="Request timeline" events={events} /> : <p className="text-sm text-ink-muted">Nothing is recorded for this request yet.</p>}
          </Card>
          <RequestLetter request={request} />
        </div>

        <div className="flex min-w-0 flex-col gap-4 xl:col-start-2 xl:row-start-2">
          <Card title="Parties">
            <ul className="flex flex-col divide-y divide-line">
              <Party
                name={pet.name}
                photo={pet.photo_url}
                kind="Pet"
                email={parties.pet_email}
                accountId={parties.pet_user_id}
                accountStatus={parties.pet_account_status}
                badge={<StatusBadge status={PET_STATUS_NAMES[pet.status]} />}
              />
              <Party
                name={home.full_name}
                photo={home.profile_photo_url}
                kind="Human"
                email={parties.human_email}
                accountId={parties.human_user_id}
                accountStatus={parties.human_account_status}
                badge={home.is_furparent ? <StatusBadge status="Furparent" /> : undefined}
              />
            </ul>
          </Card>

          <Card title="Meet & Greet">
            {lines && meeting?.slot ? (
              <dl className={FACTS}>
                <dt className="text-ink-muted">When</dt>
                <dd>
                  <time dateTime={meeting.slot.starts_at}>{lines.when}</time>
                </dd>
                <dt className="text-ink-muted">Where</dt>
                {/* The place a human typed, as text (SEC-FE-01). */}
                <dd className="wrap-break-word">{[lines.where, slotPlaceKind(meeting.slot)].filter(Boolean).join(", ")}</dd>
                <dt className="text-ink-muted">Booking</dt>
                <dd>{lines.state}</dd>
                {meeting.confirmed_at && (
                  <>
                    <dt className="text-ink-muted">Confirmed</dt>
                    <dd>
                      <time dateTime={meeting.confirmed_at}>{formatDateTime(meeting.confirmed_at)}</time>
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">No Meet & Greet has been booked for this request.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

import { Alert } from "@/components/feedback/alert";
import { formatMeetingTime } from "@/lib/utils/format-date";
import { type BookingNotice as Notice, DIDNT_HAPPEN_LABELS, type MeetReader, didntHappenTold } from "../schemas/meetings";
import { slotPlace } from "../schemas/slots";

type Props = {
  notice: Notice;
  reader: MeetReader;
  petName: string;
  homeName: string;
};

/** The other side's own words, as plain text (SEC-FE-01). */
function Quote({ children }: { children: string }) {
  return <blockquote className="mt-1 rounded-control bg-surface px-3 py-2 font-display wrap-break-word whitespace-pre-line">“{children}”</blockquote>;
}

// Why booking is open again, told to whoever is reading: the human offered another time (MG-06), one side called
// the meeting off (MG-10), or it was reported as not having happened (MG-13). Present when the page loads, so it
// isn't announced.
export function BookingNotice({ notice, reader, petName, homeName }: Props) {
  const other = reader === "pet" ? homeName : petName;

  if (notice.kind === "proposed") {
    const when = `${formatMeetingTime(notice.slot.starts_at)} at ${slotPlace(notice.slot)}`;
    return (
      <Alert tone="info" title={notice.byReader ? "You proposed another time" : `${other} proposed another time`}>
        <p>{notice.byReader ? `You offered ${when}. ${petName} books it, or picks another of your open slots.` : `They offered ${when}.`}</p>
        {notice.message && <Quote>{notice.message}</Quote>}
      </Alert>
    );
  }

  if (notice.kind === "cancelled") {
    return (
      <Alert tone="warning" title={notice.byReader ? "You cancelled the Meet & Greet" : `${other} cancelled the Meet & Greet`}>
        <p>
          {notice.was && `It was set for ${formatMeetingTime(notice.was.starts_at)}. `}
          Reason: {notice.reason}.
        </p>
        {notice.details && <Quote>{notice.details}</Quote>}
      </Alert>
    );
  }

  // What the human reported (MG-13): in their own words to them, and with their name to the pet's side.
  const reported = notice.reason && (reader === "human" ? `You reported: ${DIDNT_HAPPEN_LABELS[notice.reason]}.` : didntHappenTold(notice.reason, homeName));

  return (
    <Alert tone="warning" title="The Meet & Greet didn’t happen">
      <p>
        {notice.was && `It was set for ${formatMeetingTime(notice.was.starts_at)}. `}
        {reported && `${reported} `}
        Booking is open again.
      </p>
      {notice.details && <Quote>{notice.details}</Quote>}
    </Alert>
  );
}

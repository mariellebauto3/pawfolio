import Link from "next/link";
import { Alert } from "@/components/feedback/alert";
import { buttonClasses } from "@/components/ui/button-styles";
import { REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { AdoptionRequest } from "@/types/adoption-request";
import { BookSlotForm } from "../forms/book-slot-form";
import { type MeetReader, type MeetStage, bookingNotice, slotsWithOfferFirst } from "../schemas/meetings";
import type { RequestMeeting } from "../types/meetings";
import { BookingNotice } from "./booking-notice";
import { MeetActions } from "./meet-actions";
import { MeetCard } from "./meet-card";
import { SlotLine } from "./slot-line";

type Props = {
  reader: MeetReader;
  /** Where the Meet & Greet stands (`meetStage`); the page shows this section only when there is one. */
  stage: MeetStage;
  request: Pick<AdoptionRequest, "id" | "expires_at" | "pet" | "home_profile">;
  meeting: RequestMeeting;
};

/** What stands in for a section when the API's answer doesn't hold together: the status is still told by the badge. */
function Unreadable() {
  return <p className="text-sm text-ink-muted">The Meet & Greet couldn’t be loaded. Reload the page to see it.</p>;
}

// The Meet & Greet of an approved request, inside the request's action panel, for whoever is reading (FR11, FR26):
// the pet books a slot (MG-03) and waits for the human (MG-04); the human waits for a booking, then confirms or
// proposes another time (MG-05); once confirmed both read the meeting and the other side's contact details (MG-07,
// MG-08). Everything shown is the API's; the buttons only offer what it allows at this step (SEC-FE-05).
export function MeetSection({ reader, stage, request, meeting }: Props) {
  const pet = request.pet.name;
  const home = request.home_profile.full_name;
  const expires = request.expires_at ? formatDate(request.expires_at) : "";
  const booked = meeting.active?.slot ?? null;
  const actions = booked && stage !== "book" && (
    <MeetActions reader={reader} stage={stage} requestId={request.id} petName={pet} homeName={home} current={booked} slots={meeting.slots} />
  );

  if (stage === "book") {
    const notice = bookingNotice(meeting.latest, reader);
    const shown = notice && <BookingNotice notice={notice} reader={reader} petName={pet} homeName={home} />;

    if (reader === "pet") {
      const { slots, offeredId } = slotsWithOfferFirst(meeting.slots, notice);
      return (
        <>
          <p className="wrap-break-word">
            <strong>Approved!</strong> Pick one of {home}’s open slots for your Meet & Greet.
          </p>
          {shown}
          <BookSlotForm requestId={request.id} homeName={home} slots={slots} offeredId={offeredId} />
          <p className="text-sm text-ink-muted">
            {expires ? `Book by ${expires}, or the request expires.` : `The request expires after ${REQUEST_EXPIRY_DAYS} days without a booking.`} {home}{" "}
            confirms the slot you book.
          </p>
        </>
      );
    }

    const open = meeting.slots.length;
    return (
      <>
        <p className="wrap-break-word">Waiting for {pet} to book one of your Meet & Greet slots.</p>
        {shown}
        {open === 0 ? (
          <Alert
            tone="warning"
            title="You have no open slots"
            action={
              <Link href={ROUTES.availability} className={buttonClasses({ variant: "primary", size: "sm" })}>
                Add a slot
              </Link>
            }
          >
            {pet} can’t book a Meet & Greet until you add one.
          </Alert>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              You have {open} open {open === 1 ? "slot" : "slots"}.{expires && ` ${pet} has until ${expires} to book.`}
            </p>
            <Link href={ROUTES.availability} className={buttonClasses({ size: "sm", className: "self-start" })}>
              Manage availability
            </Link>
          </>
        )}
      </>
    );
  }

  if (!booked) return <Unreadable />;

  if (stage === "booked") {
    return (
      <>
        <p className="wrap-break-word">
          {reader === "pet" ? (
            <>
              <strong>Slot booked.</strong> Waiting for {home} to confirm.
            </>
          ) : (
            <>
              <strong>{pet} booked a slot.</strong> Confirm it, or propose another time.
            </>
          )}
        </p>
        <div className="rounded-card border border-line p-3">
          <SlotLine slot={booked} tone="pending" />
        </div>
        {actions}
        <p className="text-sm text-ink-muted">
          {reader === "pet"
            ? `${home} can also propose another time. Contact details are shared once the slot is confirmed.`
            : `Confirming shares your phone number and exact address with ${pet}’s caretaker, and theirs with you.`}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="wrap-break-word">
        <strong>Meet & Greet confirmed.</strong> {reader === "pet" ? `You’re meeting ${home}.` : `You’re meeting ${pet}.`}
      </p>
      <MeetCard reader={reader} slot={booked} contacts={meeting.contacts} petName={pet} />
      {actions}
    </>
  );
}

import { Icon } from "@/components/ui/icon";
import type { MeetContacts, MeetGreetSlot } from "@/types/meet-and-greet";
import type { MeetReader } from "../schemas/meetings";
import { ContactDetails } from "./contact-details";
import { SlotLine } from "./slot-line";

type Props = {
  reader: MeetReader;
  slot: MeetGreetSlot;
  /** What the confirmed meeting opened. Null when the API didn't send it: nothing is shown in its place. */
  contacts: MeetContacts | null;
  petName: string;
  /** `ahead`: the meeting is confirmed and still to come. `past`: its time has come and the human is deciding. */
  when?: "ahead" | "past";
};

// MG-07 and MG-08, the confirmed Meet & Greet, and the same meeting once its time has passed (MG-11, MG-12): when
// and where, and the other side's contact details, which appear here only while the meeting stands or the decision
// is open (NFR4, SEC-PRIV-02). They come with the page from the API and are rendered as plain text; nothing here
// keeps them in browser storage or puts them in a link (SEC-FE-01, SEC-FE-04). The human is told what of theirs the
// caretaker can see.
export function MeetCard({ reader, slot, contacts, petName, when = "ahead" }: Props) {
  const why = when === "ahead" ? "Shared with you because the meeting is confirmed." : "Still shared with you while the decision is open.";

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="bg-surface-sunken p-3">
        {/* The yellow leaf is for a meeting to look forward to; one that has passed is a plain date again. */}
        <SlotLine slot={slot} tone={when === "ahead" ? "confirmed" : "open"} />
      </div>

      {contacts ? (
        <ContactDetails reader={reader} contacts={contacts} petName={petName} className="flex flex-col gap-2 border-t border-dashed border-line-strong p-3 text-sm" />
      ) : (
        <p className="border-t border-dashed border-line-strong p-3 text-sm text-ink-muted">Contact details couldn’t be loaded. Reload the page to see them.</p>
      )}

      <p className="flex items-start gap-2 border-t border-line px-3 py-2 text-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        <span>
          {why}{" "}
          {reader === "pet"
            ? "Your caretaker’s name and number are shared the same way."
            : `${petName}’s caretaker can see your phone number and exact address.`}
          {when === "ahead" && " Reminders go out 1 day and 1 hour before."}
        </span>
      </p>
    </div>
  );
}

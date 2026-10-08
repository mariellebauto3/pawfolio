import { Icon } from "@/components/ui/icon";
import type { MeetContacts, MeetGreetSlot } from "@/types/meet-and-greet";
import type { MeetReader } from "../schemas/meetings";
import { SlotLine } from "./slot-line";

type Props = {
  reader: MeetReader;
  slot: MeetGreetSlot;
  /** What the confirmed meeting opened. Null when the API didn't send it: nothing is shown in its place. */
  contacts: MeetContacts | null;
  petName: string;
};

const ROW = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3";

// MG-07 and MG-08, the confirmed Meet & Greet: when and where, and the other side's contact details, which appear
// here and nowhere else, and only while the meeting stands (NFR4, SEC-PRIV-02). They come with the page from the
// API and are rendered as plain text; nothing here keeps them in browser storage or puts them in a link
// (SEC-FE-01, SEC-FE-04). The pet's caretaker reads the human's number and exact address; the human reads the
// caretaker's name and number, and is told what of theirs the caretaker can see.
export function MeetCard({ reader, slot, contacts, petName }: Props) {
  const address = contacts ? [contacts.human_street_address, contacts.human_city, contacts.human_province].filter(Boolean).join(", ") : "";

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <div className="bg-surface-sunken p-3">
        <SlotLine slot={slot} tone="confirmed" />
      </div>

      {contacts ? (
        <dl className="flex flex-col gap-2 border-t border-dashed border-line-strong p-3 text-sm">
          {reader === "pet" ? (
            <>
              <div className={ROW}>
                <dt className="text-ink-muted">Contact</dt>
                <dd className="wrap-break-word">
                  {contacts.human_full_name}
                  {contacts.human_contact_number && <span className="block font-bold">{contacts.human_contact_number}</span>}
                </dd>
              </div>
              {address && (
                <div className={ROW}>
                  <dt className="text-ink-muted">Exact address</dt>
                  <dd className="wrap-break-word">{address}</dd>
                </div>
              )}
            </>
          ) : (
            <div className={ROW}>
              <dt className="text-ink-muted">Contact</dt>
              <dd className="wrap-break-word">
                {contacts.caretaker_name ? `${contacts.caretaker_name}, ${petName}’s caretaker` : `${petName}’s caretaker`}
                {contacts.caretaker_contact_number && <span className="block font-bold">{contacts.caretaker_contact_number}</span>}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="border-t border-dashed border-line-strong p-3 text-sm text-ink-muted">Contact details couldn’t be loaded. Reload the page to see them.</p>
      )}

      <p className="flex items-start gap-2 border-t border-line px-3 py-2 text-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        <span>
          {reader === "pet"
            ? "Shared with you because the meeting is confirmed. Your caretaker’s name and number are shared the same way."
            : `Shared with you because the meeting is confirmed. ${petName}’s caretaker can see your phone number and exact address.`}{" "}
          Reminders go out 1 day and 1 hour before.
        </span>
      </p>
    </div>
  );
}

import { Icon } from "@/components/ui/icon";
import type { MeetContacts } from "@/types/meet-and-greet";
import type { MeetReader } from "../schemas/meetings";
import { ContactDetails } from "./contact-details";

type Props = {
  reader: MeetReader;
  /** What the API still sends once a request is Adopted. Null when it sent none: nothing is shown. */
  contacts: MeetContacts | null;
  petName: string;
};

// The other side's contact details on an Adopted request (AL-04): the two met through a confirmed Meet & Greet,
// and they still have a pet to hand over, with no other way to reach each other here. Shown only to the two sides of
// the request, from the page's own answer, as plain text (SEC-PRIV-02, SEC-FE-01, SEC-FE-04).
export function HandoverContact({ reader, contacts, petName }: Props) {
  if (!contacts) return null;

  return (
    <div className="overflow-hidden rounded-card border border-line">
      <p className="bg-surface-sunken px-3 py-2 text-sm font-bold">{reader === "pet" ? "Arranging the move" : `Bringing ${petName} home`}</p>
      <ContactDetails reader={reader} contacts={contacts} petName={petName} className="flex flex-col gap-2 border-t border-dashed border-line-strong p-3 text-sm" />
      <p className="flex items-start gap-2 border-t border-line px-3 py-2 text-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        <span>
          {reader === "pet"
            ? "Only you and your Furparent see each other’s details."
            : `Only you and ${petName}’s caretaker see each other’s details.`}
        </span>
      </p>
    </div>
  );
}

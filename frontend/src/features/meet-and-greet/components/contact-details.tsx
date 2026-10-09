import type { MeetContacts } from "@/types/meet-and-greet";
import type { MeetReader } from "../schemas/meetings";

type Props = {
  reader: MeetReader;
  contacts: MeetContacts;
  petName: string;
  className?: string;
};

const ROW = "grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3";

// The other side's contact details, as the API sent them with the page: the pet's caretaker reads the human's
// name, number and exact address; the human reads the caretaker's name and number. Plain text only, kept nowhere
// and never put in a link (NFR4, SEC-PRIV-02, SEC-FE-01, SEC-FE-04).
export function ContactDetails({ reader, contacts, petName, className }: Props) {
  const address = [contacts.human_street_address, contacts.human_city, contacts.human_province].filter(Boolean).join(", ");

  return (
    <dl className={className}>
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
  );
}

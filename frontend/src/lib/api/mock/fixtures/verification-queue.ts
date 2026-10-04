import { MOCK_VERIFICATIONS } from "@/lib/api/mock/fixtures/verification";
import type { HumanSubmission, PetSubmission, Submission, SubmittedDocument } from "@/types/account-status";
import type { IsoDateTime } from "@/types/api";
import type { Species } from "@/types/pet";
import type { PreviousDenial } from "@/types/verification-review";
import type { IdType } from "@/types/verification";

// The accounts the mock admin finds waiting for review (AU-22). Three are personas you can sign in as (Kulit, Bea
// Navarro and Carla Mendoza, who resubmitted after a denial), so a decision made here can be seen from the owner's
// side. The rest only fill the queue, enough for a second page. Everyone is made up (SEC-PRIV-06): the numbers use
// the 0917 000 01xx range.

export type MockQueueEntry = {
  account_id: number;
  submitted_at: IsoDateTime;
  previous_denial?: PreviousDenial;
  submission: Submission;
};

const MB = 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const FIRST_SENT = Date.parse("2026-09-30T01:10:00Z");
/** Each made-up account signed up this long after the one before it. */
const SIGN_UP_GAP_HOURS = 3.6;

type PetRow = [name: string, species: Species, breed: string, months: number, at: string, city: string, province: string, caretaker: string];
type HumanRow = [name: string, birthdate: string, city: string, province: string, id: IdType];

const PETS: PetRow[] = [
  ["Pepper", "dog", "Shih Tzu mix", 60, "Foster home", "Quezon City", "Metro Manila", "Liza Ramos"],
  ["Tofu", "cat", "Puspin", 14, "Rescuer's home", "Marikina", "Metro Manila", "Ben Yu"],
  ["Bantay", "dog", "Aspin", 36, "Barangay shelter", "Antipolo", "Rizal", "Nora Castillo"],
  ["Mingming", "cat", "Puspin", 5, "With the finder", "Cebu City", "Cebu", "Paolo Uy"],
  ["Choco", "dog", "Labrador mix", 24, "Foster home", "Davao City", "Davao del Sur", "Irene Bautista"],
  ["Snow", "cat", "Persian mix", 48, "Owner's home", "Taguig", "Metro Manila", "Dennis Chua"],
  ["Bruno", "dog", "Aspin", 9, "Rescue center", "San Fernando", "Pampanga", "Grace Villanueva"],
  ["Luna", "cat", "Siamese mix", 18, "Foster home", "Iloilo City", "Iloilo", "Karen Sy"],
  ["Tagpi", "dog", "Aspin", 72, "With the finder", "Calamba", "Laguna", "Ramon Aquino"],
  ["Oreo", "other", "Rabbit", 12, "Owner's home", "Bacoor", "Cavite", "Mylene Torres"],
];

const HUMANS: HumanRow[] = [
  ["Rico Dela Paz", "1995-01-12", "Pasig", "Metro Manila", "passport"],
  ["Miguel Tan", "1990-03-04", "Makati", "Metro Manila", "drivers_license"],
  ["Sofia Lim", "1998-07-19", "Cebu City", "Cebu", "national_id_philsys"],
  ["Andrea Cruz", "1985-12-01", "Quezon City", "Metro Manila", "umid"],
  ["Paulo Garcia", "2001-05-23", "Baguio", "Benguet", "postal_id"],
  ["Hannah Flores", "1993-09-14", "Davao City", "Davao del Sur", "passport"],
  ["Jerome Ocampo", "1979-02-28", "Imus", "Cavite", "drivers_license"],
  ["Trisha Gomez", "1999-11-05", "Bacolod", "Negros Occidental", "national_id_philsys"],
  ["Carlo Mercado", "1988-06-17", "Santa Rosa", "Laguna", "umid"],
  ["Elena Pascual", "1972-04-09", "Malolos", "Bulacan", "passport"],
];

function file(document_type: SubmittedDocument["document_type"], uploaded_at: IsoDateTime, pdf = false, id_type: IdType | null = null): SubmittedDocument {
  return {
    document_type,
    id_type,
    mime_type: pdf ? "application/pdf" : "image/jpeg",
    size_bytes: Math.round((pdf ? 0.4 : 1.8) * MB),
    uploaded_at,
  };
}

/** Pets and humans take turns; `n` counts from 0 in sign-up order. */
function madeUp(n: number): MockQueueEntry {
  const row = Math.floor(n / 2);
  const submitted_at = new Date(FIRST_SENT + n * SIGN_UP_GAP_HOURS * HOUR).toISOString();
  const number = `091700001${String(n).padStart(2, "0")}`;

  if (n % 2 === 0) {
    const [name, species, breed, approximate_age_months, currently_at, city, province, caretaker_name] = PETS[row];
    const submission: PetSubmission = {
      role: "pet",
      name,
      species,
      breed,
      approximate_age_months,
      currently_at,
      city,
      province,
      caretaker_name,
      caretaker_contact_number: number,
      documents: [
        file("valid_id", submitted_at),
        // One to three photos, and a vet record for every other pet.
        ...Array.from({ length: (row % 3) + 1 }, () => file("pet_photo", submitted_at)),
        ...(row % 2 === 0 ? [file("vet_record_or_certificate", submitted_at, true)] : []),
      ],
    };
    return { account_id: 101 + n, submitted_at, submission };
  }

  const [full_name, birthdate, city, province, idType] = HUMANS[row];
  const submission: HumanSubmission = {
    role: "human",
    full_name,
    birthdate,
    contact_number: number,
    city,
    province,
    street_address: `${10 + n} Mabini St, Barangay Example`,
    // Every third human scanned their ID as a PDF.
    documents: [file("valid_id", submitted_at, row % 3 === 2, idType)],
  };
  // The LoFi's AU-24: Rico was denied once and sent his details again.
  const previous_denial: PreviousDenial | undefined =
    row === 0
      ? {
          denial_reason: "id_expired",
          message_to_owner: "The passport you uploaded expired in 2024. Please upload an ID that is still valid.",
          reviewed_at: "2026-09-29T08:30:00.000Z",
        }
      : undefined;
  return { account_id: 101 + n, submitted_at, previous_denial, submission };
}

function persona(accountId: number): MockQueueEntry {
  const { submitted_at, resubmitted_at, denial, submission } = MOCK_VERIFICATIONS[accountId];
  if (!resubmitted_at || !denial) return { account_id: accountId, submitted_at, submission };
  return {
    account_id: accountId,
    submitted_at: resubmitted_at,
    previous_denial: { denial_reason: denial.reason, message_to_owner: denial.message, reviewed_at: "2026-09-28T03:40:00.000Z" },
    submission,
  };
}

export const MOCK_QUEUE: readonly MockQueueEntry[] = [
  persona(4),
  persona(8),
  persona(5),
  ...Array.from({ length: PETS.length + HUMANS.length }, (_, n) => madeUp(n)),
];

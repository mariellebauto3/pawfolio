import type { Submission, SubmittedDocument } from "@/types/account-status";
import type { IsoDateTime } from "@/types/api";
import type { DenialReason, IdType, VerificationDocumentType } from "@/types/verification";

// What each persona that isn't Active sent for verification, by account id (personas.ts). Everything is made up
// (SEC-PRIV-06): the numbers use the 0917 000 00xx range and the addresses don't exist.

export type MockVerification = {
  submitted_at: IsoDateTime;
  /** When the details were sent again, for the persona that resubmitted after a denial. */
  resubmitted_at?: IsoDateTime;
  denial?: { reason: DenialReason; message: string };
  suspension_reason?: string;
  submission: Submission;
};

const MB = 1024 * 1024;

function document(
  document_type: VerificationDocumentType,
  uploaded_at: IsoDateTime,
  { pdf = false, id_type = null }: { pdf?: boolean; id_type?: IdType | null } = {},
): SubmittedDocument {
  return {
    document_type,
    id_type,
    mime_type: pdf ? "application/pdf" : "image/jpeg",
    size_bytes: Math.round((pdf ? 0.4 : 1.8) * MB),
    uploaded_at,
  };
}

const KULIT_SENT = "2026-09-29T06:48:00.000000Z";
const CARLA_SENT = "2026-09-27T02:15:00.000000Z";
const BISCUIT_SENT = "2026-08-18T03:30:00.000000Z";
const JUN_SENT = "2026-08-05T09:00:00.000000Z";
const BEA_SENT = "2026-10-02T11:20:00.000000Z";

export const MOCK_VERIFICATIONS: Record<number, MockVerification> = {
  // "pet-pending"
  4: {
    submitted_at: KULIT_SENT,
    submission: {
      role: "pet",
      name: "Kulit",
      species: "cat",
      breed: "Puspin",
      approximate_age_months: 8,
      currently_at: "With the finder",
      city: "Pasig",
      province: "Metro Manila",
      caretaker_name: "Joy Lim",
      caretaker_contact_number: "09170000014",
      documents: [
        document("valid_id", KULIT_SENT),
        document("pet_photo", KULIT_SENT),
        document("pet_photo", KULIT_SENT),
        document("vet_record_or_certificate", KULIT_SENT, { pdf: true }),
      ],
    },
  },
  // "human-denied", and "human-resubmitted" once the details are sent again.
  5: {
    submitted_at: CARLA_SENT,
    resubmitted_at: "2026-10-03T01:05:00.000000Z",
    denial: {
      reason: "id_photo_unreadable",
      message: "The ID photo is blurry and the name can't be read. Please upload a clearer photo.",
    },
    submission: {
      role: "human",
      full_name: "Carla Mendoza",
      birthdate: "1994-11-22",
      contact_number: "09170000015",
      city: "Pasig",
      province: "Metro Manila",
      street_address: "Unit 4B, 18 Sampaguita St, Barangay Example",
      documents: [document("valid_id", CARLA_SENT, { id_type: "umid" })],
    },
  },
  // "pet-suspended"
  6: {
    submitted_at: BISCUIT_SENT,
    suspension_reason: "Multiple confirmed reports of misleading profile information.",
    submission: {
      role: "pet",
      name: "Biscuit",
      species: "dog",
      breed: "Shih Tzu mix",
      approximate_age_months: 60,
      currently_at: "Foster home",
      city: "Makati",
      province: "Metro Manila",
      caretaker_name: "Marco Dizon",
      caretaker_contact_number: "09170000016",
      documents: [document("valid_id", BISCUIT_SENT), document("pet_photo", BISCUIT_SENT)],
    },
  },
  // "human-closed"
  7: {
    submitted_at: JUN_SENT,
    submission: {
      role: "human",
      full_name: "Jun Reyes",
      birthdate: "1988-02-09",
      contact_number: "09170000017",
      city: "Makati",
      province: "Metro Manila",
      street_address: "27 Narra St, Barangay Example",
      documents: [document("valid_id", JUN_SENT, { id_type: "passport" })],
    },
  },
  // "human-pending"
  8: {
    submitted_at: BEA_SENT,
    submission: {
      role: "human",
      full_name: "Bea Navarro",
      birthdate: "1997-06-30",
      contact_number: "09170000018",
      city: "Quezon City",
      province: "Metro Manila",
      street_address: "5 Ilang-Ilang St, Barangay Example",
      documents: [document("valid_id", BEA_SENT, { id_type: "drivers_license" })],
    },
  },
};

import type { IdType } from "@/types/verification";

// Display names for the API's verification values, as the LoFi words them (AU-16).

export const ID_TYPE_LABELS = {
  drivers_license: "Driver's license",
  passport: "Passport",
  umid: "UMID",
  national_id_philsys: "National ID (PhilSys)",
  postal_id: "Postal ID",
} as const satisfies Record<IdType, string>;

import type { HomeProfile } from "@/types/home-profile";

// What `GET /me/home-profile` and the other Home Profile endpoints answer (docs/api/profiles-and-matching.md,
// PR-11…PR-20): the human's own Home Profile with what only the owner sees. The API also sends the contact number,
// street address and birthdate; these screens don't show them, so they aren't read here (SEC-FE-04).

export type OwnHomeProfile = HomeProfile & {
  /** Matches are limited to this province; never shown publicly (SEC-PRIV-03). */
  province: string;
  views_count: number;
  /** Meet & Greet slots still open for booking (MG-01), for the profile checklist. */
  open_slots_count: number;
};

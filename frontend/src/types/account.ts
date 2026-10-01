import type { AccountStatus, Role } from "@/types/statuses";

/**
 * The signed-in account, as returned by `GET /api/v1/auth/me` (docs/api/README.md). It carries only what every screen
 * needs to pick a shell and guard actions; profile details are loaded from the pet or Home Profile endpoints.
 * Kept in memory only, never in browser storage (SEC-FE-04).
 */
export type Account = {
  id: number;
  role: Role;
  status: AccountStatus;
  email: string;
  /** Pet name, the human's full name, or the admin display name (e.g. "admin.jess"). */
  display_name: string;
  avatar_url: string | null;
  /** The pet's id (role `pet`) or the Home Profile's id (role `human`); null for admins. */
  profile_id: number | null;
};

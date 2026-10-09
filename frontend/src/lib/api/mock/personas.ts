import type { Account } from "@/types/account";

// Who you are signed in as in mock mode. The choice lives in a plain cookie (MOCK_PERSONA_COOKIE in transport.ts) so
// both the browser and proxy.ts see it.
// Switch persona by signing in with a persona's email and MOCK_PASSWORD, or from the browser console:
//   document.cookie = "pf_mock_persona=human; path=/"
// All people here are made up (SEC-PRIV-06).

export const MOCK_PASSWORD = "password";

export type MockPersonaId =
  | "pet"
  | "human"
  | "admin"
  | "pet-pending"
  | "human-pending"
  | "human-denied"
  | "human-resubmitted"
  | "pet-suspended"
  | "human-closed"
  | "pet-hired"
  | "signed-out";

export const DEFAULT_MOCK_PERSONA: MockPersonaId = "pet";

export const MOCK_PERSONAS: Record<MockPersonaId, Account | null> = {
  pet: {
    id: 1,
    role: "pet",
    status: "active",
    email: "mochi@example.com",
    display_name: "Mochi",
    avatar_url: null,
    profile_id: 1,
  },
  human: {
    id: 2,
    role: "human",
    status: "active",
    email: "ana.santos@example.com",
    display_name: "Ana Santos",
    avatar_url: null,
    profile_id: 1,
  },
  admin: {
    id: 3,
    role: "admin",
    status: "active",
    email: "admin@example.com",
    display_name: "admin.jess",
    avatar_url: null,
    profile_id: null,
  },
  "pet-pending": {
    id: 4,
    role: "pet",
    status: "pending_verification",
    email: "kulit@example.com",
    display_name: "Kulit",
    avatar_url: null,
    profile_id: 2,
  },
  // Who a human sign-up becomes in mock mode (AU-17 → AU-18); a pet sign-up becomes "pet-pending".
  "human-pending": {
    id: 8,
    role: "human",
    status: "pending_verification",
    email: "bea.navarro@example.com",
    display_name: "Bea Navarro",
    avatar_url: null,
    profile_id: 4,
  },
  "human-denied": {
    id: 5,
    role: "human",
    status: "denied",
    email: "carla.mendoza@example.com",
    display_name: "Carla Mendoza",
    avatar_url: null,
    profile_id: 2,
  },
  // The denied human after "Save and resubmit" (AU-19): the same account, Pending Verification again. Signing in
  // with her email gives "human-denied", so the denial can be replayed.
  "human-resubmitted": {
    id: 5,
    role: "human",
    status: "pending_verification",
    email: "carla.mendoza@example.com",
    display_name: "Carla Mendoza",
    avatar_url: null,
    profile_id: 2,
  },
  "pet-suspended": {
    id: 6,
    role: "pet",
    status: "suspended",
    email: "biscuit@example.com",
    display_name: "Biscuit",
    avatar_url: null,
    profile_id: 3,
  },
  // Deactivated: signing in answers "This account was closed." (AU-03), so this persona is never the session.
  "human-closed": {
    id: 7,
    role: "human",
    status: "deactivated",
    email: "jun.reyes@example.com",
    display_name: "Jun Reyes",
    avatar_url: null,
    profile_id: 3,
  },
  // Luna, adopted by Ana Santos: an alumni profile on "/me", and "You got Hired" (AL-03) on request 6.
  "pet-hired": {
    id: 9,
    role: "pet",
    status: "active",
    email: "luna@example.com",
    display_name: "Luna",
    avatar_url: null,
    profile_id: 4,
  },
  "signed-out": null,
};

export function isMockPersonaId(value: string | null): value is MockPersonaId {
  return value !== null && Object.hasOwn(MOCK_PERSONAS, value);
}

export function resolveMockAccount(personaId: string | null): Account | null {
  return MOCK_PERSONAS[isMockPersonaId(personaId) ? personaId : DEFAULT_MOCK_PERSONA];
}

/** The persona for one account in one status, e.g. the denied human once she is Pending again. */
export function findMockPersona(accountId: number, status: Account["status"]): MockPersonaId | null {
  const match = Object.entries(MOCK_PERSONAS).find(([, account]) => account?.id === accountId && account.status === status);
  return match ? (match[0] as MockPersonaId) : null;
}

export function findMockPersonaByEmail(email: string): MockPersonaId | null {
  const normalized = email.trim().toLowerCase();
  const match = Object.entries(MOCK_PERSONAS).find(([, account]) => account?.email === normalized);
  return match ? (match[0] as MockPersonaId) : null;
}

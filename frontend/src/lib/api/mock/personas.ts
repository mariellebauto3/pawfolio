import type { Account } from "@/types/account";

// Who you are signed in as in mock mode. The choice lives in a plain cookie (MOCK_PERSONA_COOKIE in transport.ts) so
// both the browser and proxy.ts see it.
// Switch persona by signing in with a persona's email and MOCK_PASSWORD, or from the browser console:
//   document.cookie = "pf_mock_persona=human; path=/"
// All people here are made up (SEC-PRIV-06).

export const MOCK_PASSWORD = "password";

export type MockPersonaId = "pet" | "human" | "admin" | "pet-pending" | "human-denied" | "pet-suspended" | "signed-out";

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
  "human-denied": {
    id: 5,
    role: "human",
    status: "denied",
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
  "signed-out": null,
};

export function isMockPersonaId(value: string | null): value is MockPersonaId {
  return value !== null && Object.hasOwn(MOCK_PERSONAS, value);
}

export function resolveMockAccount(personaId: string | null): Account | null {
  return MOCK_PERSONAS[isMockPersonaId(personaId) ? personaId : DEFAULT_MOCK_PERSONA];
}

export function findMockPersonaByEmail(email: string): MockPersonaId | null {
  const normalized = email.trim().toLowerCase();
  const match = Object.entries(MOCK_PERSONAS).find(([, account]) => account?.email === normalized);
  return match ? (match[0] as MockPersonaId) : null;
}

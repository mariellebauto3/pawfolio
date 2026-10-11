import type { Account } from "@/types/account";
import type { IsoDateTime } from "@/types/api";
import { DENIAL_REASONS, type DenialReason } from "@/types/verification";

// What the mock admin decided (AU-23…AU-26), kept in a cookie like the persona, so the pages rendered on the server,
// the calls made in the browser and a later sign-in as the owner all see the same decision. Clear the cookie
// (MOCK_DECISIONS_COOKIE in transport.ts) to get the fixture queue back.

export type MockDecision = {
  status: "approved" | "denied";
  /** When the admin decided, and their display name. */
  at: IsoDateTime;
  by: string;
  /** Denied only. */
  reason?: DenialReason;
  message?: string | null;
  /** When the owner sent their details again after this denial: the account is Pending Verification once more. */
  resubmitted_at?: IsoDateTime;
};

/** By account id. */
export type MockDecisions = Record<number, MockDecision>;

// A cookie holds about 4 KB once encoded. The oldest decisions make way, and a long message is cut short.
const MAX_ENCODED_LENGTH = 3000;
const MAX_STORED_MESSAGE = 300;

export function parseMockDecisions(cookie: string | null): MockDecisions {
  if (!cookie) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(cookie);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};

  const decisions: MockDecisions = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (isDecision(value) && /^\d+$/.test(id)) decisions[Number(id)] = value;
  }
  return decisions;
}

export function encodeMockDecisions(decisions: MockDecisions): string {
  const entries = Object.entries(decisions)
    .map(([id, decision]): [string, MockDecision] => [
      id,
      decision.message ? { ...decision, message: decision.message.slice(0, MAX_STORED_MESSAGE) } : decision,
    ])
    // Oldest decision first (ISO dates sort as text), so those are the ones dropped below.
    .sort(([, a], [, b]) => a.at.localeCompare(b.at));
  const encode = () => JSON.stringify(Object.fromEntries(entries));
  while (entries.length > 1 && encodeURIComponent(encode()).length > MAX_ENCODED_LENGTH) entries.shift();
  return encode();
}

/** The account as the decisions leave it: Active once approved, Denied once denied, Pending again once resubmitted. */
export function withMockDecision(account: Account | null, decisions: MockDecisions): Account | null {
  const decision = account && account.role !== "admin" ? decisions[account.id] : undefined;
  if (!account || !decision) return account;
  if (decision.resubmitted_at) return { ...account, status: "pending_verification" };
  return { ...account, status: decision.status === "approved" ? "active" : "denied" };
}

function isDecision(value: unknown): value is MockDecision {
  if (typeof value !== "object" || value === null) return false;
  const { status, at, by, reason } = value as Record<string, unknown>;
  if (typeof at !== "string" || typeof by !== "string") return false;
  if (status === "approved") return true;
  return status === "denied" && (DENIAL_REASONS as readonly unknown[]).includes(reason);
}

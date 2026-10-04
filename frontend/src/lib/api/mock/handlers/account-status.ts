import type { MockDecisions } from "@/lib/api/mock/decisions";
import { MOCK_VERIFICATIONS } from "@/lib/api/mock/fixtures/verification";
import { humanDetailErrors, petDetailErrors } from "@/lib/api/mock/handlers/sign-up";
import { findMockPersona, resolveMockAccount } from "@/lib/api/mock/personas";
import { type MockRoute, fail, ok, route, validationFailed } from "@/lib/api/mock/router";
import { canEditSubmission } from "@/lib/auth/account-status";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import type { Account } from "@/types/account";
import type { AccountStatusInfo } from "@/types/account-status";

// Mirrors the account-status endpoints in docs/api/auth.md (BE-06, AU-18…AU-21). Try it in mock mode with the
// personas "pet-pending", "human-pending", "human-denied", "pet-suspended" and "human-closed". Saving the edit form
// as "human-denied" signs you in as "human-resubmitted" (Pending again); what was typed isn't stored. What the mock
// admin decided since (handlers/admin-verification.ts) comes first: their reason on the Denied screen, and a
// resubmission that puts the account back in their queue.

export const NOT_EDITABLE = "Only accounts waiting for verification can edit their submitted details.";
const CLOSED = "This account was closed.";

function statusInfo(account: Account, decisions: MockDecisions): AccountStatusInfo {
  const record = MOCK_VERIFICATIONS[account.id];
  const info: AccountStatusInfo = {
    status: account.status,
    denial_reason: null,
    reason: null,
    submitted_at: record?.submitted_at ?? null,
    is_resubmission: false,
    documents: record?.submission.documents ?? [],
  };
  if (account.status === "deactivated") return { ...info, reason: CLOSED };
  if (!record) return info;
  if (account.status === "suspended") return { ...info, reason: record.suspension_reason ?? null };

  const decision = decisions[account.id];
  if (decision?.resubmitted_at) return { ...info, is_resubmission: true, submitted_at: decision.resubmitted_at };
  if (decision?.status === "denied") return { ...info, denial_reason: decision.reason ?? "other", reason: decision.message ?? null };
  if (decision) return info;

  if (!record.denial) return info;
  if (account.status === "denied") return { ...info, denial_reason: record.denial.reason, reason: record.denial.message };
  // Pending again after a denial: the details were sent a second time.
  if (account.status === "pending_verification") {
    return { ...info, is_resubmission: true, submitted_at: record.resubmitted_at ?? record.submitted_at };
  }
  return info;
}

export const accountStatusRoutes: MockRoute[] = [
  // Like /auth/me, open to every signed-in account whatever its status (SEC-AUTHZ-06).
  route("GET", AUTH_ENDPOINTS.accountStatus, ({ account, decisions }) => (account ? ok(statusInfo(account, decisions)) : fail(401, "Unauthenticated.")), "signed-in"),

  route(
    "GET",
    AUTH_ENDPOINTS.submission,
    ({ account }) => {
      const record = account && canEditSubmission(account) ? MOCK_VERIFICATIONS[account.id] : undefined;
      return record ? ok(record.submission) : fail(403, NOT_EDITABLE);
    },
    "signed-in",
  ),

  // 200 with the account, Pending Verification again and back in the review queue.
  route(
    "PATCH",
    AUTH_ENDPOINTS.submission,
    ({ body, account, decisions }) => {
      if (!account || !canEditSubmission(account)) return fail(403, NOT_EDITABLE);
      const form = body instanceof FormData ? body : new FormData();
      const errors = account.role === "pet" ? petDetailErrors(form, "optional") : humanDetailErrors(form, "optional");
      if (Object.keys(errors).length) return validationFailed(errors);
      const persona = findMockPersona(account.id, "pending_verification");
      if (!persona) return fail(403, NOT_EDITABLE);
      // Denied by the mock admin: sending the details again puts the account back in their queue.
      const decision = decisions[account.id];
      const resubmitted = decision && { ...decisions, [account.id]: { ...decision, resubmitted_at: new Date().toISOString() } };
      return { ...ok(resolveMockAccount(persona)), persona, decisions: resubmitted };
    },
    "signed-in",
  ),
];

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
// as "human-denied" signs you in as "human-resubmitted" (Pending again); what was typed isn't stored.

export const NOT_EDITABLE = "Only accounts waiting for verification can edit their submitted details.";
const CLOSED = "This account was closed.";

function statusInfo(account: Account): AccountStatusInfo {
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
  route("GET", AUTH_ENDPOINTS.accountStatus, ({ account }) => (account ? ok(statusInfo(account)) : fail(401, "Unauthenticated.")), "signed-in"),

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
    ({ body, account }) => {
      if (!account || !canEditSubmission(account)) return fail(403, NOT_EDITABLE);
      const form = body instanceof FormData ? body : new FormData();
      const errors = account.role === "pet" ? petDetailErrors(form, "optional") : humanDetailErrors(form, "optional");
      if (Object.keys(errors).length) return validationFailed(errors);
      const persona = findMockPersona(account.id, "pending_verification");
      return persona ? { ...ok(resolveMockAccount(persona)), persona } : fail(403, NOT_EDITABLE);
    },
    "signed-in",
  ),
];

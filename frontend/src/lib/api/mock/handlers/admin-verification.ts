import type { MockDecision, MockDecisions } from "@/lib/api/mock/decisions";
import { mockDocumentFile } from "@/lib/api/mock/fixtures/document-files";
import { MOCK_QUEUE, type MockQueueEntry } from "@/lib/api/mock/fixtures/verification-queue";
import { type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import { QUEUE_SEARCH_MAX, denialProblems, isDenialReason } from "@/lib/auth/verification-review";
import type { AccountStatus, VerificationStatus } from "@/types/statuses";
import type { PreviousDenial, ReviewDocument, VerificationQueueItem, VerificationReview } from "@/types/verification-review";

// Mirrors the admin verification endpoints in docs/api/auth.md (BE-08, AU-22…AU-26). Try it in mock mode as the
// "admin" persona. The queue is fixtures/verification-queue.ts; a decision is remembered in a cookie (decisions.ts),
// so approving Kulit and then signing in as kulit@example.com lands in the member shell, and denying Bea Navarro
// shows her your reason on the Denied screen (AU-20).

export const VERIFICATION_NOT_FOUND = "We couldn't find that account.";
export const ALREADY_REVIEWED_CODE = "verification_already_reviewed";
const QUEUE_PATH = "/admin/verifications";

const ACCOUNT_STATUS: Record<VerificationStatus, AccountStatus> = {
  pending: "pending_verification",
  approved: "active",
  denied: "denied",
};

type Round = Pick<
  VerificationReview,
  "status" | "submitted_at" | "is_resubmission" | "previous_denial" | "reviewed_at" | "reviewed_by" | "denial_reason" | "message_to_owner"
>;

/** The account's latest review round: the fixture's, then whatever the admin and the owner did since. */
function roundOf(entry: MockQueueEntry, decisions: MockDecisions): Round {
  const previous_denial = entry.previous_denial ?? null;
  const pending = { status: "pending" as const, reviewed_at: null, reviewed_by: null, denial_reason: null, message_to_owner: null };
  const decision = decisions[entry.account_id];
  if (!decision) return { ...pending, submitted_at: entry.submitted_at, is_resubmission: previous_denial !== null, previous_denial };

  const denial: PreviousDenial | null =
    decision.status === "denied"
      ? { denial_reason: decision.reason ?? "other", message_to_owner: decision.message ?? null, reviewed_at: decision.at }
      : null;
  if (decision.resubmitted_at) {
    return { ...pending, submitted_at: decision.resubmitted_at, is_resubmission: true, previous_denial: denial ?? previous_denial };
  }
  return {
    status: decision.status,
    submitted_at: entry.submitted_at,
    is_resubmission: previous_denial !== null,
    previous_denial,
    reviewed_at: decision.at,
    reviewed_by: decision.by,
    denial_reason: denial?.denial_reason ?? null,
    message_to_owner: denial?.message_to_owner ?? null,
  };
}

type Waiting = { entry: MockQueueEntry; round: Round };

/** Everyone still waiting, newest first (AU-22). */
function waiting(decisions: MockDecisions): Waiting[] {
  return MOCK_QUEUE.map((entry) => ({ entry, round: roundOf(entry, decisions) }))
    .filter(({ round }) => round.status === "pending")
    .sort((a, b) => Date.parse(b.round.submitted_at) - Date.parse(a.round.submitted_at));
}

const displayName = ({ submission }: MockQueueEntry) => (submission.role === "pet" ? submission.name : submission.full_name);
const caretakerName = ({ submission }: MockQueueEntry) => (submission.role === "pet" ? submission.caretaker_name : null);

function queueItem({ entry, round }: Waiting): VerificationQueueItem {
  return {
    account_id: entry.account_id,
    role: entry.submission.role,
    display_name: displayName(entry),
    caretaker_name: caretakerName(entry),
    submitted_at: round.submitted_at,
    is_resubmission: round.is_resubmission,
    documents: entry.submission.documents,
  };
}

const documentsOf = (entry: MockQueueEntry): ReviewDocument[] =>
  entry.submission.documents.map((document, index) => ({ ...document, id: entry.account_id * 10 + index + 1 }));

function without<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

function detailsOf({ submission }: MockQueueEntry): VerificationReview["details"] {
  if (submission.role === "pet") return without(submission, "documents");
  // The street address stays on the server: the review doesn't need it (SEC-PRIV-04).
  return without(submission, "documents", "street_address");
}

function review(entry: MockQueueEntry, decisions: MockDecisions): VerificationReview {
  const round = roundOf(entry, decisions);
  const queue = waiting(decisions);
  const index = queue.findIndex((item) => item.entry === entry);
  // The account listed under this one, or the newest when this one is last. A decided account sits where its time
  // puts it.
  const others = queue.filter((item) => item.entry !== entry);
  const next = others.find((item) => Date.parse(item.round.submitted_at) < Date.parse(round.submitted_at)) ?? others[0];
  return {
    account_id: entry.account_id,
    display_name: displayName(entry),
    account_status: ACCOUNT_STATUS[round.status],
    ...round,
    details: detailsOf(entry),
    documents: documentsOf(entry),
    queue: { position: index === -1 ? null : index + 1, total: queue.length, next_account_id: next?.entry.account_id ?? null },
  };
}

const find = (accountId: string) => MOCK_QUEUE.find((entry) => String(entry.account_id) === accountId);

/** Records a decision on a pending round and answers with the review as it stands now. */
function decide(entry: MockQueueEntry, decisions: MockDecisions, decision: MockDecision): MockResult {
  const round = roundOf(entry, decisions);
  if (round.status !== "pending") {
    return fail(409, `This account was already ${round.status} by ${round.reviewed_by ?? "another admin"}.`, { code: ALREADY_REVIEWED_CODE });
  }
  const next = { ...decisions, [entry.account_id]: decision };
  return { ...ok(review(entry, next)), decisions: next };
}

export const adminVerificationRoutes: MockRoute[] = [
  route(
    "GET",
    QUEUE_PATH,
    ({ query, decisions }) => {
      const role = query.role || undefined;
      if (role !== undefined && role !== "pet" && role !== "human") return validationFailed({ role: "Choose Pet or Human." });
      const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
      if (search.length > QUEUE_SEARCH_MAX) return validationFailed({ search: `Search for ${QUEUE_SEARCH_MAX} characters or fewer.` });

      const matches = (name: string | null) => Boolean(name?.toLowerCase().includes(search));
      const items = waiting(decisions)
        .filter(({ entry }) => !role || entry.submission.role === role)
        .filter(({ entry }) => !search || matches(displayName(entry)) || matches(caretakerName(entry)))
        .map(queueItem);
      return { status: 200, body: paginate(items, query, `/api/v1${QUEUE_PATH}`) };
    },
    "admin",
  ),

  route(
    "GET",
    `${QUEUE_PATH}/:accountId`,
    ({ params, decisions }) => {
      const entry = find(params.accountId);
      return entry ? ok(review(entry, decisions)) : fail(404, VERIFICATION_NOT_FOUND);
    },
    "admin",
  ),

  // The file itself, never a link to it (SEC-PRIV-01). A document of another account answers 404 like a missing one.
  route(
    "GET",
    `${QUEUE_PATH}/:accountId/documents/:documentId`,
    ({ params }) => {
      const entry = find(params.accountId);
      const document = entry && documentsOf(entry).find(({ id }) => String(id) === params.documentId);
      if (!entry || !document) return fail(404, "We couldn't find that document.");
      return { status: 200, file: mockDocumentFile(document, document.id, displayName(entry)) };
    },
    "admin",
  ),

  route(
    "POST",
    `${QUEUE_PATH}/:accountId/approve`,
    ({ params, decisions, account }) => {
      const entry = find(params.accountId);
      if (!entry) return fail(404, VERIFICATION_NOT_FOUND);
      return decide(entry, decisions, { status: "approved", at: new Date().toISOString(), by: account?.display_name ?? "admin" });
    },
    "admin",
  ),

  route(
    "POST",
    `${QUEUE_PATH}/:accountId/deny`,
    ({ params, body, decisions, account }) => {
      const entry = find(params.accountId);
      if (!entry) return fail(404, VERIFICATION_NOT_FOUND);
      // Only the two documented fields are read; `status`, `reviewed_by` and the rest are ignored (SEC-INPUT-04).
      const { denial_reason, message_to_owner } = (body ?? {}) as { denial_reason?: unknown; message_to_owner?: unknown };
      const errors = denialProblems({ denial_reason, message_to_owner });
      if (Object.keys(errors).length || !isDenialReason(denial_reason)) return validationFailed(errors);
      const message = typeof message_to_owner === "string" ? message_to_owner.trim() : "";
      return decide(entry, decisions, {
        status: "denied",
        at: new Date().toISOString(),
        by: account?.display_name ?? "admin",
        reason: denial_reason,
        message: message || null,
      });
    },
    "admin",
  ),
];

import { ID_TYPE_LABELS, VERIFICATION_DOCUMENT_LABELS } from "@/constants/verification";
import type { FieldErrors } from "@/lib/api/errors";
import type { SubmittedDocument } from "@/types/account-status";
import { DENIAL_REASONS, type DenialReason } from "@/types/verification";
import type { VerifiedRole } from "@/types/verification-review";

export { formatAgeMonths } from "@/lib/utils/format-age";
export { formatFileSize } from "@/lib/utils/format-file-size";

// Admin verification rules (AU-22…AU-26) shared by the deny dialog's checks and the mock API, mirroring the deny
// Form Request and its messages (docs/api/auth.md), plus how a review writes out what was submitted. The checks give
// quick feedback; the API is the authority.

/** The only kinds of file a verification document may be shown as (SEC-FILE-01, SEC-FE-09). */
export const DOCUMENT_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

/** Longest message to the owner the API accepts (AU-25). */
export const DENIAL_MESSAGE_MAX = 500;

/** Longest name the queue search accepts (AU-22). */
export const QUEUE_SEARCH_MAX = 100;

export const DENIAL_REASON_REQUIRED = "Choose a reason.";
export const DENIAL_MESSAGE_REQUIRED = "Write a message so the owner knows what to correct.";
export const DENIAL_MESSAGE_TOO_LONG = `Keep the message to ${DENIAL_MESSAGE_MAX} characters or fewer.`;

export function isDenialReason(value: unknown): value is DenialReason {
  return (DENIAL_REASONS as readonly unknown[]).includes(value);
}

/**
 * What is wrong with a denial, by API field. A reason is always required (FR33, SEC-AUTHZ-07); "Other" says nothing
 * on its own, so it also needs the message the owner will read.
 */
export function denialProblems(input: { denial_reason: unknown; message_to_owner: unknown }): FieldErrors {
  const errors: FieldErrors = {};
  if (!isDenialReason(input.denial_reason)) errors.denial_reason = DENIAL_REASON_REQUIRED;
  const message = typeof input.message_to_owner === "string" ? input.message_to_owner.trim() : "";
  if (message.length > DENIAL_MESSAGE_MAX) errors.message_to_owner = DENIAL_MESSAGE_TOO_LONG;
  else if (!message && input.denial_reason === "other") errors.message_to_owner = DENIAL_MESSAGE_REQUIRED;
  return errors;
}

/**
 * A name for each document, in the order given: "Valid ID (UMID)", "Vet record", and "Pet photo 1", "Pet photo 2"
 * when there are several of a kind.
 */
export function documentLabels(documents: readonly SubmittedDocument[]): string[] {
  const seen = new Map<string, number>();
  return documents.map(({ document_type, id_type }) => {
    const label = VERIFICATION_DOCUMENT_LABELS[document_type];
    const count = documents.filter((other) => other.document_type === document_type).length;
    const position = (seen.get(document_type) ?? 0) + 1;
    seen.set(document_type, position);
    if (count > 1) return `${label} ${position}`;
    return id_type ? `${label} (${ID_TYPE_LABELS[id_type]})` : label;
  });
}

/** "0917 123 4567" from the stored "09171234567"; anything else is returned as it is. */
export function formatContactNumber(number: string): string {
  const match = /^(\d{4})(\d{3})(\d{4})$/.exec(number);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : number;
}

/** The queue page's query parameters (AU-22): `?tab=pet&q=carla&page=2`. */
export const QUEUE_TAB_PARAM = "tab";
export const QUEUE_SEARCH_PARAM = "q";
export const QUEUE_PAGE_PARAM = "page";

type UrlParams = Record<string, string | string[] | undefined>;

/**
 * What the queue page asks the API for, read from its URL. Anything that isn't a known tab, a name or a page number
 * is dropped, so a hand-edited URL shows the whole queue instead of an error.
 */
export function queueFiltersFromUrl(params: UrlParams): { role?: VerifiedRole; search?: string; page?: number } {
  const one = (name: string) => {
    const value = params[name];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const tab = one(QUEUE_TAB_PARAM);
  const search = one(QUEUE_SEARCH_PARAM).trim().slice(0, QUEUE_SEARCH_MAX);
  const page = /^\d{1,6}$/.test(one(QUEUE_PAGE_PARAM)) ? Number(one(QUEUE_PAGE_PARAM)) : 0;
  return {
    role: tab === "pet" || tab === "human" ? tab : undefined,
    search: search || undefined,
    page: page > 1 ? page : undefined,
  };
}

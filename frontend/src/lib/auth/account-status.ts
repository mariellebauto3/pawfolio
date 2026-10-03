import { ID_TYPE_LABELS, VERIFICATION_DOCUMENT_LABELS } from "@/constants/verification";
import type { Account } from "@/types/account";
import type { SubmittedDocument } from "@/types/account-status";
import { VERIFICATION_DOCUMENT_TYPES } from "@/types/verification";

/**
 * Only Pending and Denied owners may edit what they submitted (proposal §5.1): a Suspended or closed account sees
 * its reason only. This picks what to show; the API refuses the edit on its own (SEC-FE-05).
 */
export function canEditSubmission({ role, status }: Pick<Account, "role" | "status">): boolean {
  return role !== "admin" && (status === "pending_verification" || status === "denied");
}

/**
 * What was sent for review, one line per kind of document in a fixed order: "Valid ID (UMID)", "2 pet photos",
 * "Vet record" (AU-18).
 */
export function summarizeDocuments(documents: readonly SubmittedDocument[]): string[] {
  return VERIFICATION_DOCUMENT_TYPES.flatMap((type) => {
    const ofType = documents.filter((document) => document.document_type === type);
    if (ofType.length === 0) return [];
    const label = VERIFICATION_DOCUMENT_LABELS[type];
    if (ofType.length > 1) return [`${ofType.length} ${label.toLowerCase()}s`];
    const idType = ofType[0].id_type;
    const idLabel = idType ? ID_TYPE_LABELS[idType] : undefined;
    return [idLabel ? `${label} (${idLabel})` : label];
  });
}

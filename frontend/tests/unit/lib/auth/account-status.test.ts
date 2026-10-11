import { describe, expect, it } from "vitest";
import { canEditSubmission, summarizeDocuments } from "@/lib/auth/account-status";
import type { SubmittedDocument } from "@/types/account-status";

const document = (document_type: SubmittedDocument["document_type"], id_type: SubmittedDocument["id_type"] = null): SubmittedDocument => ({
  document_type,
  id_type,
  mime_type: "image/jpeg",
  size_bytes: 1000,
  uploaded_at: "2026-09-29T06:48:00.000000Z",
});

describe("canEditSubmission (proposal §5.1)", () => {
  it("lets pending and denied pets and humans edit what they submitted", () => {
    for (const role of ["pet", "human"] as const) {
      expect(canEditSubmission({ role, status: "pending_verification" })).toBe(true);
      expect(canEditSubmission({ role, status: "denied" })).toBe(true);
    }
  });

  it.each(["active", "suspended", "deactivated"] as const)("doesn't offer the edit to %s accounts", (status) => {
    expect(canEditSubmission({ role: "pet", status })).toBe(false);
    expect(canEditSubmission({ role: "human", status })).toBe(false);
  });

  it("never offers it to admins, who don't sign up", () => {
    expect(canEditSubmission({ role: "admin", status: "pending_verification" })).toBe(false);
  });
});

describe("summarizeDocuments", () => {
  it("lists each kind once, in a fixed order, counting photos", () => {
    const documents = [document("pet_photo"), document("vet_record_or_certificate"), document("valid_id"), document("pet_photo")];
    expect(summarizeDocuments(documents)).toEqual(["Valid ID", "2 pet photos", "Vet record"]);
  });

  it("names the kind of ID a human sent", () => {
    expect(summarizeDocuments([document("valid_id", "national_id_philsys")])).toEqual(["Valid ID (National ID (PhilSys))"]);
  });

  it("is empty when nothing was sent, and skips kinds it doesn't know", () => {
    expect(summarizeDocuments([])).toEqual([]);
    expect(summarizeDocuments([{ ...document("valid_id"), document_type: "selfie" as never }])).toEqual([]);
  });
});

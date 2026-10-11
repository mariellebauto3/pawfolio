import { describe, expect, it } from "vitest";
import {
  DENIAL_MESSAGE_MAX,
  denialProblems,
  documentLabels,
  formatAgeMonths,
  formatContactNumber,
  formatFileSize,
  isDenialReason,
  queueFiltersFromUrl,
} from "@/lib/auth/verification-review";
import type { SubmittedDocument } from "@/types/account-status";
import { DENIAL_REASONS } from "@/types/verification";

describe("denialProblems (AU-25)", () => {
  it("accepts every listed reason on its own, except Other", () => {
    for (const denial_reason of DENIAL_REASONS.filter((reason) => reason !== "other")) {
      expect(denialProblems({ denial_reason, message_to_owner: "" })).toEqual({});
      expect(denialProblems({ denial_reason, message_to_owner: null })).toEqual({});
    }
  });

  it("requires a reason from the list", () => {
    for (const denial_reason of [undefined, null, "", "suspended", 3]) {
      expect(denialProblems({ denial_reason, message_to_owner: "Blurry." })).toEqual({ denial_reason: "Choose a reason." });
      expect(isDenialReason(denial_reason)).toBe(false);
    }
  });

  it("requires a message with Other, since Other says nothing on its own", () => {
    const required = { message_to_owner: "Write a message so the owner knows what to correct." };
    expect(denialProblems({ denial_reason: "other", message_to_owner: "" })).toEqual(required);
    expect(denialProblems({ denial_reason: "other", message_to_owner: "  \n " })).toEqual(required);
    expect(denialProblems({ denial_reason: "other", message_to_owner: "The photo shows a different pet." })).toEqual({});
  });

  it("limits the message, counted after trimming", () => {
    const longest = "x".repeat(DENIAL_MESSAGE_MAX);
    expect(denialProblems({ denial_reason: "id_expired", message_to_owner: `  ${longest}  ` })).toEqual({});
    expect(denialProblems({ denial_reason: "id_expired", message_to_owner: `${longest}x` })).toEqual({
      message_to_owner: "Keep the message to 500 characters or fewer.",
    });
  });
});

describe("how a review writes out what was submitted", () => {
  it("writes a pet's age in months, years or both", () => {
    expect(formatAgeMonths(1)).toBe("1 month");
    expect(formatAgeMonths(8)).toBe("8 months");
    expect(formatAgeMonths(12)).toBe("1 year");
    expect(formatAgeMonths(14)).toBe("1 year 2 months");
    expect(formatAgeMonths(25)).toBe("2 years 1 month");
    expect(formatAgeMonths(60)).toBe("5 years");
    expect(formatAgeMonths(-3)).toBe("");
    expect(formatAgeMonths(Number.NaN)).toBe("");
  });

  it("groups a mobile number, and leaves anything else as it is", () => {
    expect(formatContactNumber("09170000014")).toBe("0917 000 0014");
    expect(formatContactNumber("+639170000014")).toBe("+639170000014");
    expect(formatContactNumber("")).toBe("");
  });

  it("writes a file size in KB or MB", () => {
    expect(formatFileSize(300)).toBe("1 KB");
    expect(formatFileSize(430_080)).toBe("420 KB");
    expect(formatFileSize(1_887_437)).toBe("1.8 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatFileSize(-1)).toBe("");
  });
});

describe("documentLabels", () => {
  const document = (document_type: SubmittedDocument["document_type"], id_type: SubmittedDocument["id_type"] = null): SubmittedDocument => ({
    document_type,
    id_type,
    mime_type: "image/jpeg",
    size_bytes: 1,
    uploaded_at: "2026-09-29T06:48:00.000000Z",
  });

  it("names each document, and numbers the ones that come in several", () => {
    const documents = [document("valid_id"), document("pet_photo"), document("pet_photo"), document("vet_record_or_certificate")];
    expect(documentLabels(documents)).toEqual(["Valid ID", "Pet photo 1", "Pet photo 2", "Vet record"]);
  });

  it("says which ID a human sent", () => {
    expect(documentLabels([document("valid_id", "national_id_philsys")])).toEqual(["Valid ID (National ID (PhilSys))"]);
    expect(documentLabels([])).toEqual([]);
  });
});

describe("queueFiltersFromUrl (AU-22)", () => {
  it("reads the tab, the search and the page", () => {
    expect(queueFiltersFromUrl({ tab: "pet", q: "  Joy Lim ", page: "2" })).toEqual({ role: "pet", search: "Joy Lim", page: 2 });
    expect(queueFiltersFromUrl({ tab: "human" })).toEqual({ role: "human", search: undefined, page: undefined });
  });

  it("shows the whole queue for anything it doesn't know", () => {
    const everything = { role: undefined, search: undefined, page: undefined };
    expect(queueFiltersFromUrl({})).toEqual(everything);
    expect(queueFiltersFromUrl({ tab: "all", q: "   ", page: "1" })).toEqual(everything);
    expect(queueFiltersFromUrl({ tab: "admin", page: "-3" })).toEqual(everything);
    expect(queueFiltersFromUrl({ page: "2; drop table" })).toEqual(everything);
    expect(queueFiltersFromUrl({ page: "1e3" })).toEqual(everything);
  });

  it("takes the first of a repeated parameter and cuts a long search", () => {
    expect(queueFiltersFromUrl({ tab: ["human", "pet"], q: ["carla", "bea"] })).toMatchObject({ role: "human", search: "carla" });
    expect(queueFiltersFromUrl({ q: "x".repeat(300) }).search).toHaveLength(100);
  });
});

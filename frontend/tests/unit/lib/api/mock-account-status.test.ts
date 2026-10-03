import { describe, expect, it } from "vitest";
import { getAccountStatus, getSubmission, updateSubmission } from "@/features/auth/api/account-status";
import { createApiClient } from "@/lib/api/core";
import { NOT_EDITABLE } from "@/lib/api/mock/handlers/account-status";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { fetchSession } from "@/lib/auth/session";

function client(start: string) {
  let persona: string | null = start;
  return createApiClient(
    createMockTransport({
      readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null),
      writePersona: (next) => {
        persona = next;
      },
      latencyMs: 0,
    }),
  );
}

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

function form(fields: Record<string, string | File | File[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.set(key, value);
  }
  return data;
}

const PET = {
  name: "Kulit",
  species: "cat",
  breed: "Puspin",
  approximate_age_months: "8",
  currently_at: "With the finder",
  city: "Pasig",
  province: "Metro Manila",
  caretaker_name: "Joy Lim",
  caretaker_contact_number: "09170000014",
};

const HUMAN = {
  full_name: "Carla Mendoza",
  birthdate: "1994-11-22",
  contact_number: "09170000015",
  city: "Pasig",
  province: "Metro Manila",
  street_address: "Unit 4B, 18 Sampaguita St",
  id_type: "umid",
};

describe("mock account-status handlers follow docs/api/auth.md", () => {
  it("tells a pending account when its details were sent and which documents", async () => {
    const info = await getAccountStatus(client("pet-pending"));
    expect(info).toMatchObject({ status: "pending_verification", denial_reason: null, reason: null, is_resubmission: false });
    expect(info.submitted_at).toBe("2026-09-29T06:48:00.000000Z");
    expect(info.documents.map((document) => document.document_type)).toEqual([
      "valid_id",
      "pet_photo",
      "pet_photo",
      "vet_record_or_certificate",
    ]);
  });

  it("gives the admin's reason to denied and suspended accounts, and the closed message", async () => {
    await expect(getAccountStatus(client("human-denied"))).resolves.toMatchObject({
      status: "denied",
      denial_reason: "id_photo_unreadable",
      reason: expect.stringContaining("blurry"),
    });
    await expect(getAccountStatus(client("pet-suspended"))).resolves.toMatchObject({
      status: "suspended",
      denial_reason: null,
      reason: expect.stringContaining("confirmed reports"),
    });
    await expect(getAccountStatus(client("human-closed"))).resolves.toMatchObject({
      status: "deactivated",
      reason: "This account was closed.",
    });
  });

  it("answers active accounts too, and nobody who is signed out (SEC-AUTHZ-06)", async () => {
    await expect(getAccountStatus(client("pet"))).resolves.toMatchObject({ status: "active", submitted_at: null, documents: [] });
    await expect(getAccountStatus(client("admin"))).resolves.toMatchObject({ status: "active" });
    await expect(getAccountStatus(client("signed-out"))).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("never sends a link to a document, only what it is (SEC-PRIV-01)", async () => {
    const submission = await getSubmission(client("human-denied"));
    expect(submission.documents).toEqual([
      { document_type: "valid_id", id_type: "umid", mime_type: "image/jpeg", size_bytes: expect.any(Number), uploaded_at: expect.any(String) },
    ]);
  });

  it("lets only pending and denied owners read and edit their submission", async () => {
    await expect(getSubmission(client("pet-pending"))).resolves.toMatchObject({ role: "pet", name: "Kulit", caretaker_name: "Joy Lim" });
    await expect(getSubmission(client("human-denied"))).resolves.toMatchObject({ role: "human", full_name: "Carla Mendoza" });

    for (const persona of ["pet-suspended", "human-closed", "pet", "admin"]) {
      await expect(getSubmission(client(persona))).rejects.toMatchObject({ kind: "forbidden", message: NOT_EDITABLE });
      await expect(updateSubmission(client(persona), form(PET))).rejects.toMatchObject({ kind: "forbidden", status: 403 });
    }
    await expect(getSubmission(client("signed-out"))).rejects.toMatchObject({ kind: "unauthenticated" });
    await expect(updateSubmission(client("signed-out"), form(PET))).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("returns a denied account to Pending Verification when it resubmits (FR2)", async () => {
    const api = client("human-denied");
    await expect(updateSubmission(api, form({ ...HUMAN, valid_id: file("umid.jpg", "image/jpeg") }))).resolves.toMatchObject({
      id: 5,
      role: "human",
      status: "pending_verification",
    });
    await expect(fetchSession(api)).resolves.toMatchObject({ id: 5, status: "pending_verification" });
    await expect(getAccountStatus(api)).resolves.toMatchObject({
      status: "pending_verification",
      is_resubmission: true,
      denial_reason: null,
      reason: null,
    });
  });

  it("keeps a pending account pending, with the files left as they were", async () => {
    const api = client("pet-pending");
    await expect(updateSubmission(api, form(PET))).resolves.toMatchObject({ id: 4, status: "pending_verification" });
    await expect(fetchSession(api)).resolves.toMatchObject({ id: 4, display_name: "Kulit" });
  });

  it("checks the details like sign-up, with the files optional", async () => {
    const bad = { ...PET, name: " ", species: "dragon", approximate_age_months: "0", caretaker_contact_number: "12345" };
    await expect(updateSubmission(client("pet-pending"), form(bad))).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: {
        name: "Enter the pet's name.",
        species: "Choose a species.",
        approximate_age_months: expect.stringContaining("whole number"),
        caretaker_contact_number: "Enter a mobile number like 0917 123 4567.",
      },
    });

    const files = { valid_id: file("id.svg", "image/svg+xml"), "photos[]": [file("kulit.pdf", "application/pdf")] };
    await expect(updateSubmission(client("pet-pending"), form({ ...PET, ...files }))).rejects.toMatchObject({
      fieldErrors: { valid_id: "Upload a JPG, PNG or PDF file.", "photos.0": "Upload a JPG or PNG photo." },
    });

    const year = new Date().getFullYear() - 17;
    await expect(updateSubmission(client("human-denied"), form({ ...HUMAN, birthdate: `${year}-01-01`, id_type: "" }))).rejects.toMatchObject({
      fieldErrors: { birthdate: "You must be 18 or older to adopt on Pawfolio.", id_type: "Choose the type of ID." },
    });
  });

  it("ignores a role or status sent in the body (SEC-INPUT-04)", async () => {
    const api = client("human-denied");
    await expect(updateSubmission(api, form({ ...HUMAN, role: "admin", status: "active" }))).resolves.toMatchObject({
      role: "human",
      status: "pending_verification",
    });
  });

  it("is a PATCH sent as POST with _method, the way Laravel takes uploads", async () => {
    const api = client("pet-pending");
    // A plain POST isn't the endpoint; the same form with `_method` is.
    await expect(api.post(AUTH_ENDPOINTS.submission, form(PET))).rejects.toMatchObject({ kind: "not_found" });
    await expect(api.post(AUTH_ENDPOINTS.submission, form({ ...PET, _method: "PATCH" }))).resolves.toMatchObject({
      data: { status: "pending_verification" },
    });
  });
});
